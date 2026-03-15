const express = require('express');
const router = express.Router();
const db = require('../../config/query.js');
const { jwtProtect } = require('../../config/middleware/jwtProtect');
const { isMedicalPermitted, permissions: medPermissions } = require('../../services/permit.js');
const logger = require('../../utils/logger');

// ─── UI module/action order (must match frontend PERMISSION_MODULES) ──────────
const MODULE_STRUCTURE = {
  appointments:    ['view', 'confirm', 'cancel', 'noshow', 'complete'],
  pendingRequests: ['view', 'approveAppointment', 'rejectAppointment', 'approveMedicine', 'rejectMedicine', 'approveRecordUpdate', 'rejectRecordUpdate'],
  medicalRecords:  ['view', 'edit', 'addNotes'],
  dentalRecords:   ['view', 'edit', 'addNotes'],
  patientSearch:   ['view'],
  inventory:       ['view', 'add', 'dispense'],
  roleManagement:  ['view', 'edit'],
};

// ─── UI toggle key → backend permission label(s) ─────────────────────────────
const UI_TO_BACKEND = {
  'appointments.view':                  ['ALLOW_TO_VIEW_APPOINTMENT'],
  'appointments.confirm':               ['ALLOW_TO_APPROVE_APPOINTMENT'],
  'appointments.cancel':                ['ALLOW_TO_APPROVE_APPOINTMENT'],
  'appointments.noshow':                ['ALLOW_TO_APPROVE_APPOINTMENT'],
  'appointments.complete':              ['ALLOW_TO_APPROVE_APPOINTMENT'],
  'pendingRequests.view':               ['ALLOW_TO_VIEW_APPOINTMENT'],
  'pendingRequests.approveAppointment': ['ALLOW_TO_APPROVE_APPOINTMENT'],
  'pendingRequests.rejectAppointment':  ['ALLOW_TO_APPROVE_APPOINTMENT'],
  'pendingRequests.approveMedicine':    ['ALLOW_TO_APPROVE_MEDICINE_REQUEST'],
  'pendingRequests.rejectMedicine':     ['ALLOW_TO_APPROVE_MEDICINE_REQUEST'],
  'pendingRequests.approveRecordUpdate':['ALLOW_TO_APPROVE_PROFILE'],
  'pendingRequests.rejectRecordUpdate': ['ALLOW_TO_APPROVE_PROFILE'],
  'medicalRecords.view':                ['ALLOW_TO_VIEW_EMR'],
  'medicalRecords.edit':                ['ALLOW_TO_EDIT_EMR'],
  'medicalRecords.addNotes':            ['ALLOW_TO_EDIT_EMR'],
  'dentalRecords.view':                 ['ALLOW_TO_VIEW_EMR'],
  'dentalRecords.edit':                 ['ALLOW_TO_SET_DENTAL_RECORD'],
  'dentalRecords.addNotes':             ['ALLOW_TO_SET_DENTAL_RECORD'],
  'patientSearch.view':                 ['ALLOW_TO_VIEW_PROFILE'],
  'inventory.view':                     ['ALLOW_TO_VIEW_INVENTORY'],
  'inventory.add':                      ['ALLOW_TO_ADD_INVENTORY'],
  'inventory.dispense':                 ['ALLOW_TO_DISPENSE_MEDICINE'],
  'roleManagement.view':                ['IS_ADMIN'],
  'roleManagement.edit':                ['IS_ADMIN'],
};

// ─── Backend permission label → UI toggles it enables ────────────────────────
const BACKEND_TO_UI = {
  'ALLOW_TO_VIEW_APPOINTMENT':         [['appointments', 'view'], ['pendingRequests', 'view']],
  'ALLOW_TO_APPROVE_APPOINTMENT':      [['appointments', 'confirm'], ['appointments', 'cancel'], ['appointments', 'noshow'], ['appointments', 'complete'], ['pendingRequests', 'approveAppointment'], ['pendingRequests', 'rejectAppointment']],
  'ALLOW_TO_APPROVE_MEDICINE_REQUEST': [['pendingRequests', 'approveMedicine'], ['pendingRequests', 'rejectMedicine']],
  'ALLOW_TO_APPROVE_PROFILE':          [['pendingRequests', 'approveRecordUpdate'], ['pendingRequests', 'rejectRecordUpdate']],
  'ALLOW_TO_VIEW_EMR':                 [['medicalRecords', 'view'], ['dentalRecords', 'view']],
  'ALLOW_TO_EDIT_EMR':                 [['medicalRecords', 'edit'], ['medicalRecords', 'addNotes']],
  'ALLOW_TO_SET_DENTAL_RECORD':        [['dentalRecords', 'edit'], ['dentalRecords', 'addNotes']],
  'ALLOW_TO_VIEW_PROFILE':             [['patientSearch', 'view']],
  'ALLOW_TO_VIEW_INVENTORY':           [['inventory', 'view']],
  'ALLOW_TO_ADD_INVENTORY':            [['inventory', 'add']],
  'ALLOW_TO_DISPENSE_MEDICINE':        [['inventory', 'dispense']],
  'IS_ADMIN':                          [['roleManagement', 'view'], ['roleManagement', 'edit']],
};

// Convert UI permissions object → deduplicated backend label array
function uiPermissionsToLabels(uiPerms) {
  const labelSet = new Set();
  for (const [moduleId, actions] of Object.entries(uiPerms)) {
    for (const [actionId, val] of Object.entries(actions)) {
      if (val) {
        const labels = UI_TO_BACKEND[`${moduleId}.${actionId}`] || [];
        labels.forEach(l => labelSet.add(l));
      }
    }
  }
  return Array.from(labelSet);
}

// Convert backend label array → UI permissions object (consistent key order)
function labelsToUiPermissions(labelList) {
  // Build with consistent key order matching PERMISSION_MODULES
  const perms = {};
  for (const [mod, actions] of Object.entries(MODULE_STRUCTURE)) {
    perms[mod] = {};
    for (const action of actions) {
      perms[mod][action] = false;
    }
  }
  for (const label of labelList) {
    const uiPaths = BACKEND_TO_UI[label] || [];
    for (const [mod, action] of uiPaths) {
      if (perms[mod] !== undefined) {
        perms[mod][action] = true;
      }
    }
  }
  return perms;
}

// Atomically replace all rolesMap entries and update identity (uses pg transaction)
async function applyStaffAccount(userId, roledata, newIdentity, assignedById) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 1. Clear all existing permits for this user
    await client.query(`DELETE FROM "rolesMap" WHERE "personnelId" = $1`, [userId]);

    // 2. Insert new permits (if any)
    if (roledata.length > 0) {
      const params = [userId, assignedById];
      const values = [];
      let i = 3;
      for (const { label, branch } of roledata) {
        values.push(`($${i}, $${i + 1})`);
        params.push(label, branch);
        i += 2;
      }
      await client.query(
        `INSERT INTO "rolesMap" ("personnelId", "rolesId", branch, "assignedBy")
         SELECT $1, r.id, v.branch, $2
         FROM (VALUES ${values.join(',')}) AS v(label text, branch "UserDesignation")
         JOIN "rolesTable" r ON r.label = v.label
         ON CONFLICT ("personnelId", "rolesId") DO UPDATE
           SET branch = EXCLUDED.branch, "assignedBy" = EXCLUDED."assignedBy"`,
        params
      );
    }

    // 3. Update identity
    await client.query(
      `UPDATE "UserCredentials" SET identity = $1 WHERE id = $2`,
      [newIdentity, userId]
    );
    logger.info(`Updated identity for userId=${userId} to ${newIdentity}`);
    await client.query('COMMIT');
  } catch (err) {
    logger.error('Error applying staff account changes:', err);
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── GET /admin/staff/accounts ────────────────────────────────────────────────
router.get('/accounts', jwtProtect('medical'), async (req, res) => {
  try {
    const isAdmin = await isMedicalPermitted(req.user.id, medPermissions.is_admin, null);
    if (!isAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required.' });
    }
    const narrowCredentialStatus = req.query?.status; // optional filter: Active, Suspended, Pending


    // Fetch all registered users with identity = 'Medical'
    const result = await db.query(
      `SELECT
         uc.id,
         uc.email,
         uc.identity,
         uc.credentials_status,
         up.first_name,
         up.middle_name,
         up.last_name,
         up.branch
       FROM "UserCredentials" uc
       LEFT JOIN "UsersPersonal" up ON up.id = uc.id
       WHERE 
          uc.identity = 'Medical'
          AND COALESCE($1, uc.credentials_status) = uc.credentials_status
       ORDER BY up.last_name NULLS LAST, up.first_name NULLS LAST`
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

    // For each user, fetch their roles and determine permissions and status
    // 1. Get all staff rows
    const staffRows = result.rows;

    // 2. Get all roles for all staff in one query
    const staffIds = staffRows.map(r => r.id);
    const rolesResult = await db.query(
      `SELECT rm."personnelId", rt.label
       FROM "rolesMap" rm
       JOIN "rolesTable" rt ON rm."rolesId" = rt.id
       WHERE rm."personnelId" = ANY($1)`,
      [staffIds]
    );

    // 3. Group roles by personnelId
    const rolesByStaff = {};
    for (const { personnelId, label } of rolesResult.rows) {
      if (!rolesByStaff[personnelId]) rolesByStaff[personnelId] = [];
      rolesByStaff[personnelId].push(label);
    }

    // 4. Build staff list without N+1 queries
    const staffList = staffRows.map((row) => {
      const labelList = rolesByStaff[row.id] || [];
      const hasStaff  = labelList.includes(medPermissions.is_staff);
      const uiPerms   = labelsToUiPermissions(labelList);

      let staffStatus;
      if (row.identity === 'Medical') {
        staffStatus = 'Active';
      } else if (hasStaff) {
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
        permissions: uiPerms,
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
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error.' }
      , err.message || 'Unknown error.' // remove in production for security
    );
  }
});

// ─── PUT /admin/staff/accounts/:userId ───────────────────────────────────────
router.put('/accounts/:userId', jwtProtect('medical'), async (req, res) => {
  try {
    const isAdmin = await isMedicalPermitted(req.user.id, medPermissions.is_admin, null);
    if (!isAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required.' });
    }

    const { userId } = req.params;
    const { permissions: uiPerms, status } = req.body;

    if (!uiPerms || !status) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'permissions and status are required.' });
    }
    if (!['Active', 'Suspended'].includes(status)) {
      return res.status(400).json({ error: 'INVALID_STATUS', message: 'Status must be Active or Suspended.' });
    }

    // Verify target user exists and is a .mds@ account
    const targetResult = await db.query(
      `SELECT id, email, identity, credentials_status FROM "UserCredentials" WHERE id = $1`,
      [userId]
    );
    if (targetResult.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
    }
    if (targetResult.rows[0].identity !== 'Medical') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Can only manage .mds@tip.edu.ph staff accounts.' });
    }

    // Only active/verified staff accounts can be managed in role management.
    const targetCredentialStatus = String(targetResult.rows[0].credentials_status || '').toLowerCase();
    if (targetCredentialStatus !== 'Active') {
      return res.status(403).json({
        error: 'STAFF_NOT_VERIFIED',
        message: 'This account is not yet verified. Please approve the initial record first.',
      });
    }

    // Prevent admin from removing their own IS_ADMIN unless they're not the last admin
    if (String(req.user.id) === String(userId) && status === 'Suspended') {
      return res.status(400).json({ error: 'CANNOT_SELF_SUSPEND', message: 'Admins cannot suspend their own account.' });
    }

    // Use the branch the staff set when completing their initial medical record
    const branchResult = await db.getUserBranch(String(userId));
    const allowedBranches = new Set(['Manila', 'QuezonCity', 'Both']);
    const targetBranch = allowedBranches.has(branchResult) ? branchResult : 'Both';

    // Convert UI permissions → distinct backend label set, always include IS_STAFF
    const labels = uiPermissionsToLabels(uiPerms);
    const labelSet = new Set(labels);
    labelSet.add(medPermissions.is_staff); // IS_STAFF required for all active/suspended staff

    const roledata = Array.from(labelSet).map(label => ({ label, branch: targetBranch }));

    // Active → identity = 'Medical'; Suspended → identity = 'Employee' (immediately blocks all staff routes)
    const newIdentity = status === 'Active' ? 'Medical' : 'Employee';

    await applyStaffAccount(String(userId), roledata, newIdentity, String(req.user.id));

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

module.exports = router;
