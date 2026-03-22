const express = require('express');
const router = express.Router();
const db = require('../../config/query.js');
const { jwtProtect } = require('../../config/middleware/jwtProtect');
const {
  isMedicalPermitted,
  permissions,
  setStaffPermissions
} = require('../../services/permit.js');
const logger = require('../../utils/logger');

// Convert labels array to permissions object { key: true/false }
function labelsToPermissions(labels) {
  const labelSet = new Set(labels || []);
  const perms = {};
  for (const [key, label] of Object.entries(permissions)) {
    perms[key] = labelSet.has(label);
  }
  return perms;
}

// ─── GET /admin/staff/accounts ────────────────────────────────────────────────
router.get('/accounts', jwtProtect('medical'), async (req, res) => {
  try {
    const isAdmin = await isMedicalPermitted(req.user.id, permissions.is_admin, null);
    if (!isAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required.' });
    }

    const narrowCredentialStatus = req.query?.status;
    const narrowDesignation = req.query?.location;

    // Fetch all staff with their roles aggregated
    const result = await db.query(
      `SELECT
         uc.id, uc.email, uc.identity, uc.credentials_status,
         up.first_name, up.middle_name, up.last_name,
         mp.designation AS branch,
         COALESCE(array_agg(rt.label) FILTER (WHERE rt.label IS NOT NULL), '{}') AS labels
       FROM "UserCredentials" uc
       JOIN "UsersPersonal" up ON up.id = uc.id
       JOIN "MedicalPersonnel" mp ON mp.id = uc.id
       LEFT JOIN "rolesMap" rm ON rm."personnelId" = uc.id
       LEFT JOIN "rolesTable" rt ON rt.id = rm."rolesId"
       WHERE
          uc.identity = 'Medical'
          AND ($1 IS NULL OR uc.credentials_status = $1)
          AND ($2 IS NULL OR mp.designation = $2)
       GROUP BY uc.id, uc.email, uc.identity, uc.credentials_status,
                up.first_name, up.middle_name, up.last_name, mp.designation
       ORDER BY up.last_name NULLS LAST, up.first_name NULLS LAST`,
      [narrowCredentialStatus, narrowDesignation]
    );

    // Fetch last login dates
    let lastLoginMap = {};
    try {
      const loginResult = await db.query(
        `SELECT ula.user_id, MAX(ula.attempted_at) AS last_login
         FROM "UserLoginAttempt" ula
         WHERE ula.was_successful = true
         GROUP BY ula.user_id`
      );
      for (const row of loginResult.rows) {
        lastLoginMap[row.user_id] = row.last_login;
      }
    } catch (_) {
      // gracefully skip on error
    }

    // Build staff list from query result
    const staffList = result.rows.map((row) => {
      const perms = labelsToPermissions(row.labels);

      let staffStatus;
      if (row.identity === 'Medical') {
        staffStatus = 'Active';
      } else if (perms.is_staff) {
        staffStatus = 'Suspended';
      } else {
        staffStatus = 'Pending';
      }

      const nameParts = [
        row.first_name,
        row.middle_name ? `${row.middle_name[0]}.` : null,
        row.last_name,
      ].filter(Boolean);

      const lastLogin = lastLoginMap[row.id] || null;

      return {
        id: String(row.id),
        email: row.email,
        name: nameParts.join(' ') || row.email,
        branch: row.branch || 'Both',
        identity: row.identity,
        status: staffStatus,
        permissions: perms,
        credentialsStatus: row.credentials_status,
        lastLogin: lastLogin
          ? new Date(lastLogin).toLocaleString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })
          : null,
      };
    });

    return res.json({ ok: true, staff: staffList });
  } catch (err) {
    logger.error('Error fetching staff accounts:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error.' });
  }
});

// ─── PUT /admin/staff/accounts/:userId ───────────────────────────────────────
router.put('/accounts/:userId', jwtProtect('medical'), async (req, res) => {
  try {
    const isAdmin = await isMedicalPermitted(req.user.id, permissions.is_admin, null);
    if (!isAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required.' });
    }

    const { userId } = req.params;
    const { permissions: permissionsMap, status } = req.body;

    if (!permissionsMap || !status) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'permissions and status are required.' });
    }
    if (!['Active', 'Suspended'].includes(status)) {
      return res.status(400).json({ error: 'INVALID_STATUS', message: 'Status must be Active or Suspended.' });
    }

    // Verify target user exists and is Medical identity
    const targetResult = await db.query(
      `SELECT uc.id, uc.email, uc.identity, uc.credentials_status, mp.designation AS branch
       FROM "UserCredentials" uc
       LEFT JOIN "MedicalPersonnel" mp ON mp.id = uc.id
       WHERE uc.id = $1`,
      [userId]
    );
    if (targetResult.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
    }
    const targetUser = targetResult.rows[0];

    // Check if MedicalPersonnel record exists
    if (!targetUser.branch) {
      return res.status(400).json({
        error: 'MISSING_MEDICAL_PERSONNEL',
        message: 'MedicalPersonnel record must be created before activating staff account. Use POST /admin/staff/medical-personnel first.'
      });
    }

    if (targetUser.identity !== 'Medical' && targetUser.identity !== 'Employee') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Can only manage Medical and Employee staff accounts.' });
    }

    // Only active/verified staff accounts can be managed
    const targetCredentialStatus = String(targetUser.credentials_status || '').toLowerCase();
    if (targetCredentialStatus !== 'active') {
      return res.status(403).json({
        error: 'STAFF_NOT_VERIFIED',
        message: 'This account is not yet verified. Please approve the initial record first.',
      });
    }

    // Prevent admin from suspending themselves
    if (String(req.user.id) === String(userId) && status === 'Suspended') {
      return res.status(400).json({ error: 'CANNOT_SELF_SUSPEND', message: 'Admins cannot suspend their own account.' });
    }

    // Get branch from MedicalPersonnel.designation
    const allowedBranches = new Set(['Manila', 'QuezonCity', 'Both']);
    const targetBranch = allowedBranches.has(targetUser.branch) ? targetUser.branch : 'Both';

    // Always ensure is_staff is true for staff accounts
    const finalPermissions = { ...permissionsMap, is_staff: true };

    // Apply permissions using setStaffPermissions
    await setStaffPermissions({
      personnelId: String(userId),
      permissionsMap: finalPermissions,
      assignedBy: String(req.user.id),
      branch: targetBranch,
    });

    // Update identity: Active → Medical, Suspended → Employee
    const newIdentity = status === 'Active' ? 'Medical' : 'Employee';
    await db.query(
      `UPDATE "UserCredentials" SET identity = $1 WHERE id = $2`,
      [newIdentity, userId]
    );

    logger.info(`Staff account updated: targetUserId=${userId}, status=${status}, identity=${newIdentity}, by adminId=${req.user.id}`);
    return res.json({
      ok: true,
      message: `Staff account ${status === 'Active' ? 'activated' : 'suspended'} successfully.`,
    });
  } catch (err) {
    logger.error('Error updating staff account:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error.' });
  }
});

// ─── POST /admin/staff/medical-personnel ─────────────────────────────────────
router.post('/medical-personnel', jwtProtect('medical'), async (req, res) => {
  try {
    const isAdmin = await isMedicalPermitted(req.user.id, permissions.is_admin, null);
    if (!isAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required.' });
    }

    const { userId, title, role, designation } = req.body;

    // Validate required fields
    if (!userId || !title || !role || !designation) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'userId, title, role, and designation are required.'
      });
    }

    // Validate designation
    const validDesignations = ['Manila', 'QuezonCity', 'Both'];
    if (!validDesignations.includes(designation)) {
      return res.status(400).json({
        error: 'INVALID_DESIGNATION',
        message: 'designation must be Manila, QuezonCity, or Both.'
      });
    }

    // Validate role
    const validRoles = ['Doctor', 'Nurse', 'Admin', 'Pharmacist', 'Dentist', 'Staff'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: 'INVALID_ROLE',
        message: 'role must be one of: Doctor, Nurse, Admin, Pharmacist, Dentist, Staff.'
      });
    }

    // Verify user exists and has Employee identity
    const userResult = await db.query(
      `SELECT id, identity, credentials_status FROM "UserCredentials" WHERE id = $1`,
      [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found.' });
    }

    const user = userResult.rows[0];
    if (user.identity !== 'Employee') {
      return res.status(409).json({
        error: 'INVALID_IDENTITY',
        message: 'User must have identity=Employee to create MedicalPersonnel record.'
      });
    }

    // Check if MedicalPersonnel record already exists
    const existingResult = await db.query(
      `SELECT id FROM "MedicalPersonnel" WHERE id = $1`,
      [userId]
    );
    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        error: 'RECORD_EXISTS',
        message: 'MedicalPersonnel record already exists for this user.'
      });
    }

    // Insert MedicalPersonnel record
    const insertResult = await db.query(
      `INSERT INTO "MedicalPersonnel" (id, role, title, designation, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [userId, role, title, designation]
    );

    const personnel = insertResult.rows[0];
    logger.info(`MedicalPersonnel record created: userId=${userId}, role=${role}, by adminId=${req.user.id}`);

    return res.status(201).json({
      ok: true,
      message: 'MedicalPersonnel record created successfully.',
      personnel: {
        id: personnel.id,
        userId: personnel.id,
        role: personnel.role,
        title: personnel.title,
        designation: personnel.designation,
        is_active: personnel.is_active
      }
    });
  } catch (err) {
    logger.error('Error creating MedicalPersonnel record:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error.' });
  }
});

// ─── GET /admin/staff/medical-personnel (all) ────────────────────────────────
router.get('/medical-personnel', jwtProtect('medical'), async (req, res) => {
  try {
    const isAdmin = await isMedicalPermitted(req.user.id, permissions.is_admin, null);
    if (!isAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required.' });
    }

    const { role, designation, is_active } = req.query;

    const result = await db.query(
      `SELECT
         mp.id, mp.role, mp.title, mp.designation, mp.is_active,
         uc.email, uc.identity, uc.credentials_status,
         up.first_name, up.middle_name, up.last_name
       FROM "MedicalPersonnel" mp
       JOIN "UserCredentials" uc ON uc.id = mp.id
       JOIN "UsersPersonal" up ON up.id = mp.id
       WHERE
         ($1 IS NULL OR mp.role = $1)
         AND ($2 IS NULL OR mp.designation = $2)
         AND ($3 IS NULL OR mp.is_active = $3::boolean)
       ORDER BY mp.id DESC`,
      [role || null, designation || null, is_active || null]
    );

    const personnel = result.rows.map(row => ({
      id: row.id,
      role: row.role,
      title: row.title,
      designation: row.designation,
      is_active: row.is_active,
      user: {
        email: row.email,
        identity: row.identity,
        credentials_status: row.credentials_status,
        name: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ')
      }
    }));

    return res.json({ ok: true, personnel, count: personnel.length });
  } catch (err) {
    logger.error('Error fetching MedicalPersonnel records:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error.' });
  }
});

// ─── GET /admin/staff/medical-personnel/:userId ──────────────────────────────
router.get('/medical-personnel/:userId', jwtProtect('medical'), async (req, res) => {
  try {
    const isAdmin = await isMedicalPermitted(req.user.id, permissions.is_admin, null);
    if (!isAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required.' });
    }

    const { userId } = req.params;

    const result = await db.query(
      `SELECT
         mp.id, mp.role, mp.title, mp.designation, mp.is_active,
         uc.email, uc.identity, uc.credentials_status,
         up.first_name, up.middle_name, up.last_name
       FROM "MedicalPersonnel" mp
       JOIN "UserCredentials" uc ON uc.id = mp.id
       JOIN "UsersPersonal" up ON up.id = mp.id
       WHERE mp.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'RECORD_NOT_FOUND',
        message: 'MedicalPersonnel record not found.'
      });
    }

    const row = result.rows[0];
    const personnel = {
      id: row.id,
      role: row.role,
      title: row.title,
      designation: row.designation,
      is_active: row.is_active,
      user: {
        email: row.email,
        identity: row.identity,
        credentials_status: row.credentials_status,
        name: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ')
      }
    };

    return res.json({ ok: true, personnel });
  } catch (err) {
    logger.error('Error fetching MedicalPersonnel record:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error.' });
  }
});

// ─── PUT /admin/staff/medical-personnel/:userId ──────────────────────────────
router.put('/medical-personnel/:userId', jwtProtect('medical'), async (req, res) => {
  try {
    const isAdmin = await isMedicalPermitted(req.user.id, permissions.is_admin, null);
    if (!isAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required.' });
    }

    const { userId } = req.params;
    const { title, designation, is_active } = req.body;

    // Validate at least one field provided
    if (title === undefined && designation === undefined && is_active === undefined) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'At least one field (title, designation, is_active) must be provided.'
      });
    }

    // Validate designation if provided
    if (designation !== undefined) {
      const validDesignations = ['Manila', 'QuezonCity', 'Both'];
      if (!validDesignations.includes(designation)) {
        return res.status(400).json({
          error: 'INVALID_DESIGNATION',
          message: 'designation must be Manila, QuezonCity, or Both.'
        });
      }
    }

    // Verify MedicalPersonnel record exists
    const existingResult = await db.query(
      `SELECT id FROM "MedicalPersonnel" WHERE id = $1`,
      [userId]
    );
    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        error: 'RECORD_NOT_FOUND',
        message: 'MedicalPersonnel record not found.'
      });
    }

    // Build dynamic UPDATE query
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(title);
    }
    if (designation !== undefined) {
      updates.push(`designation = $${paramIndex++}`);
      params.push(designation);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    params.push(userId);

    const updateQuery = `
      UPDATE "MedicalPersonnel"
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const updateResult = await db.query(updateQuery, params);
    const personnel = updateResult.rows[0];

    logger.info(`MedicalPersonnel record updated: userId=${userId}, by adminId=${req.user.id}`);

    return res.json({
      ok: true,
      message: 'MedicalPersonnel record updated successfully.',
      personnel: {
        id: personnel.id,
        role: personnel.role,
        title: personnel.title,
        designation: personnel.designation,
        is_active: personnel.is_active
      }
    });
  } catch (err) {
    logger.error('Error updating MedicalPersonnel record:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error.' });
  }
});

// ─── DELETE /admin/staff/medical-personnel/:userId ───────────────────────────
router.delete('/medical-personnel/:userId', jwtProtect('medical'), async (req, res) => {
  try {
    const isAdmin = await isMedicalPermitted(req.user.id, permissions.is_admin, null);
    if (!isAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required.' });
    }

    const { userId } = req.params;
    const revertIdentity = req.query.revertIdentity !== 'false'; // default true

    // Verify MedicalPersonnel record exists
    const existingResult = await db.query(
      `SELECT id FROM "MedicalPersonnel" WHERE id = $1`,
      [userId]
    );
    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        error: 'RECORD_NOT_FOUND',
        message: 'MedicalPersonnel record not found.'
      });
    }

    // Delete MedicalPersonnel record
    await db.query(
      `DELETE FROM "MedicalPersonnel" WHERE id = $1`,
      [userId]
    );

    let identityReverted = false;

    // Optionally revert identity to Employee
    if (revertIdentity) {
      const identityResult = await db.query(
        `UPDATE "UserCredentials"
         SET identity = 'Employee'
         WHERE id = $1 AND identity = 'Medical'
         RETURNING id`,
        [userId]
      );
      identityReverted = identityResult.rowCount > 0;
    }

    logger.info(`MedicalPersonnel record deleted: userId=${userId}, identityReverted=${identityReverted}, by adminId=${req.user.id}`);

    return res.json({
      ok: true,
      message: 'MedicalPersonnel record deleted successfully.',
      identityReverted
    });
  } catch (err) {
    logger.error('Error deleting MedicalPersonnel record:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error.' });
  }
});


module.exports = router;
