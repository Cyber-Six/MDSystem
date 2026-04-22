const express = require('express');
const router = express.Router();
const db = require('../../config/query.js');
const { jwtProtect } = require('../../config/middleware/jwtProtect.js');
const logger = require('../../utils/logger.js');
const notificationsRouter = require('./notifications.js');
const { getStaffBranch } = require('../../services/permit.js');

// Helper function to get user ID via identifier
async function getUserIDViaIdentifier(identifier, branch) {
    const query = `
        SELECT uc.id as "userId", up.first_name, up.middle_name, up.last_name, up.identifier
        FROM "UserCredentials" uc
        INNER JOIN "UsersPersonal" up ON uc.id = up.id
        WHERE up.identifier::text ILIKE '%' || $1 || '%' AND 
        (up.branch = $2 OR up.branch = 'Both' OR $2 = 'Both')
    `;
    const result = await db.query(query, [identifier, branch]);
    return result.rows;
}

async function getUserIdViaName(name, branch) {
    const tags = name
        .split(/\s+/)
        .map(t => t.trim())
        .filter(Boolean);

    if (!tags.length) return [];

    const scoreClauses = [];
    const searchConditions = [];
    const params = [];

    tags.forEach((tag, i) => {
        const paramIndex = i + 1;
        params.push(`%${tag}%`);
        // Score weighting: first=3, middle=1, last=2
        scoreClauses.push(`(CASE WHEN up.first_name ILIKE $${paramIndex} THEN 3 ELSE 0 END +
                           CASE WHEN up.middle_name ILIKE $${paramIndex} THEN 1 ELSE 0 END +
                           CASE WHEN up.last_name ILIKE $${paramIndex} THEN 2 ELSE 0 END)`);
        // Each word must match at least one name field
        searchConditions.push(`(up.first_name ILIKE $${paramIndex} OR up.middle_name ILIKE $${paramIndex} OR up.last_name ILIKE $${paramIndex})`);
    });

    const branchIndex = params.length + 1;
    params.push(branch);

    const query = `
        SELECT DISTINCT uc.id AS "userId",
               up.first_name, up.middle_name, up.last_name, up.identifier,
               (${scoreClauses.join(' + ')}) AS score
        FROM "UserCredentials" uc
        JOIN "UsersPersonal" up ON uc.id = up.id
        WHERE (${searchConditions.join(' AND ')})
          AND (up.branch = $${branchIndex} OR up.branch = 'Both' OR $${branchIndex} = 'Both')
        ORDER BY score DESC
        LIMIT 50
    `;

    const result = await db.query(query, params);
    return result.rows;
}

// Helper function to get user ID via email
async function getUserIdViaEmail(email, branch) {
    const query = `
        SELECT uc.id as "userId", uc.email, up.first_name, up.middle_name, up.last_name, up.identifier
        FROM "UserCredentials" uc
        LEFT JOIN "UsersPersonal" up ON uc.id = up.id
        WHERE LOWER(uc.email) LIKE '%' || LOWER($1) || '%' AND 
        (up.branch = $2 OR up.branch = 'Both' OR $2 = 'Both' OR up.branch IS NULL)
    `;
    const result = await db.query(query, [email, branch]);
    return result.rows;
}

// Unified patient search — name, identifier, and email in one query
async function searchPatients(query, branch) {
    const param = `%${query}%`;
    const sql = `
        SELECT DISTINCT uc.id AS "userId", uc.email,
               up.first_name, up.middle_name, up.last_name, up.identifier,
               p.profile::text AS profile_type,
               spd.label AS program,
               sp.year,
               ep.department,
               ep.role
        FROM "UserCredentials" uc
        LEFT JOIN "UsersPersonal" up ON uc.id = up.id
        LEFT JOIN "Patients" p ON p.id = uc.id
        LEFT JOIN LATERAL (
            SELECT pr2.id
            FROM "profileRecord" pr2
            JOIN "patientUpdateLog" pul2 ON pul2.id = pr2.id
            WHERE pul2."patientId" = uc.id
            ORDER BY pul2.created_at DESC
            LIMIT 1
        ) pr ON true
        LEFT JOIN "student_profile" sp ON sp."profileId" = pr.id
        LEFT JOIN "student_programs" spd ON spd.id = sp."programId"
        LEFT JOIN "employee_profile" ep ON ep."profileId" = pr.id
        WHERE (
            up.first_name  ILIKE $1 OR
            up.middle_name ILIKE $1 OR
            up.last_name   ILIKE $1 OR
            LOWER(uc.email) LIKE LOWER($1) OR
            up.identifier::text ILIKE $1
        )
        AND (up.branch = $2 OR up.branch = 'Both' OR $2 = 'Both' OR up.branch IS NULL)
        LIMIT 50
    `;
    const result = await db.query(sql, [param, branch]);
    return result.rows;
}

// Route: Get current staff's own profile info
router.get('/me/profile', jwtProtect("medical"), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
               uc.email,
               up.first_name, up.middle_name, up.last_name,
               mp.role AS personnel_role,
               mp.designation AS branch,
               mp.is_active
             FROM "UserCredentials" uc
             LEFT JOIN "UsersPersonal" up ON up.id = uc.id
             LEFT JOIN "MedicalPersonnel" mp ON mp.id = uc.id
             WHERE uc.id = $1`,
            [req.user.id]
        );

        // A valid JWT guarantees this user exists in UserCredentials
        if (result.rows.length === 0) {
            return res.status(500).json({ error: 'Unexpected: authenticated user not found in credentials' });
        }

        const row = result.rows[0];
        const nameParts = [
            row.first_name,
            row.middle_name ? `${row.middle_name[0]}.` : null,
            row.last_name,
        ].filter(Boolean);

        res.json({
            email: row.email || null,
            name: nameParts.length > 0 ? nameParts.join(' ') : null,
            firstName: row.first_name || null,
            lastName: row.last_name || null,
            role: row.personnel_role || null,
            branch: row.branch || null,
            isActive: row.is_active ?? true,
        });
    } catch (error) {
        logger.error('Error fetching own profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route: Get current user's module permissions
router.get('/me/permissions', jwtProtect("medical"), async (req, res) => {
    try {
        const {
            getStaffModulePermissions,
            getStaffPermissions,
            isMedicalPermitted,
            permissions: permKeys,
            getStaffBranch: getStaffDesignation,
        } = require('../../services/permit.js');
        const modulePerms = await getStaffModulePermissions(req.user.id);
        const granularPerms = await getStaffPermissions(req.user.id);
        const {permitted: isAdmin} = await isMedicalPermitted(req.user.id, permKeys.is_admin);
        const branch = await getStaffDesignation(req.user.id);

        const granularByKey = {};
        for (const perm of granularPerms?.permissions || []) {
            if (!perm?.key) continue;
            granularByKey[perm.key] = Boolean(perm.enabled);
        }

        const searchPatientPermissions = {
            profile_allow_view: Boolean(granularByKey.profile_allow_view),
            emr_allow_view: Boolean(granularByKey.emr_allow_view),
            emr_allow_set_vital_sign: Boolean(granularByKey.emr_allow_set_vital_sign),
            emr_allow_set_dental_record: Boolean(granularByKey.emr_allow_set_dental_record),
            consultation_allow_view: Boolean(granularByKey.consultation_allow_view),
            consultation_allow_edit: Boolean(granularByKey.consultation_allow_edit),
            appointment_allow_view_records: Boolean(granularByKey.appointment_allow_view_records),
            inventory_allow_manage_requests: Boolean(granularByKey.inventory_allow_manage_requests),
            document_allow_view: Boolean(granularByKey.document_allow_view),
            document_allow_manage: Boolean(granularByKey.document_allow_manage),
            document_allow_generate: Boolean(granularByKey.document_allow_generate),
        };

        res.json({
            modules: modulePerms.modules,
            isAdmin: !!isAdmin,
            branch: branch || 'Both',
            searchPatientPermissions,
        });
    } catch (error) {
        logger.error('Error fetching own permissions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route: Unified patient search by name, identifier, or email
router.get('/id/search', jwtProtect("medical"), async (req, res) => {
    try {
        const { query, branch } = req.query;

        if (!query || !branch) {
            return res.status(400).json({ error: 'query and branch params are required' });
        }

        const medicalBranch = await getStaffBranch(req.user.id);
        if (medicalBranch !== 'Both' && medicalBranch !== branch) {
            return res.status(403).json({ error: `Forbidden: Access to this branch \`${branch}\` is denied` });
        }

        const users = await searchPatients(query, branch);

        logger.info(`Unified patient search: "${query}" branch=${branch} → ${users.length} results`);
        res.json({
            users: users.map((u) => ({
                id: u.userId,
                email: u.email,
                firstName: u.first_name,
                middleName: u.middle_name,
                lastName: u.last_name,
                identifier: u.identifier,
                profile_type: u.profile_type ?? null,
                program: u.program ?? null,
                year: u.year ?? null,
                department: u.department ?? null,
                role: u.role ?? null,
            })),
        });
    } catch (error) {
        logger.error('Error in unified patient search:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route: Get user ID by identifier
router.get('/id/identifier/:identifier/:branch', jwtProtect("medical"), async (req, res) => {
    try {
        const { identifier, branch } = req.params;

        const medicalBranch = await getStaffBranch(req.user.id);
        if (medicalBranch !== 'Both' && medicalBranch !== branch) {
            return res.status(403).json({ error: `Forbidden: Access to this branch \`${branch}\` is denied` });
        }

        const users = await getUserIDViaIdentifier(identifier, branch);
        
        logger.info(`Retrieved user IDs by identifier: ${identifier}`);
        res.json({ users: users.map(u => ({ id: u.userId, firstName: u.first_name, middleName: u.middle_name, lastName: u.last_name, identifier: u.identifier })) });
    } catch (error) {
        logger.error('Error getting user ID by identifier:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route: Get user ID by name
router.get('/id/name/:name/:branch', jwtProtect("medical"), async (req, res) => {
    try {
        const { name, branch } = req.params;

        const medicalBranch = await getStaffBranch(req.user.id);
        if (medicalBranch !== 'Both' && medicalBranch !== branch) {
            return res.status(403).json({ error: `Forbidden: Access to this branch \`${branch}\` is denied` });
        }

        const users = await getUserIdViaName(name, branch);
        
        logger.info(`Retrieved user IDs by name: ${name}`);
        res.json({ users: users.map(u => ({ id: u.userId, firstName: u.first_name, middleName: u.middle_name, lastName: u.last_name, identifier: u.identifier })) });
    } catch (error) {
        logger.error('Error getting user ID by name:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route: Get user ID by email
router.get('/id/email', jwtProtect("medical"), async (req, res) => {
    try {
        const { email, branch } = req.query;

        if (!email || !branch) {
            return res.status(400).json({ error: 'email and branch query params are required' });
        }

        const medicalBranch = await getStaffBranch(req.user.id);
        if (medicalBranch !== 'Both' && medicalBranch !== branch) {
            return res.status(403).json({ error: `Forbidden: Access to this branch \`${branch}\` is denied` });
        }
        const users = await getUserIdViaEmail(email, branch);
        
        logger.info(`Retrieved user IDs by email: ${email}`);
        res.json({ users: users.map(u => ({ id: u.userId, email: u.email, firstName: u.first_name, middleName: u.middle_name, lastName: u.last_name, identifier: u.identifier })) });
    } catch (error) {
        logger.error('Error getting user ID by email:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Register notification routes
router.use('/', notificationsRouter);

module.exports = router;


