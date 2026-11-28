const logger = require('../../utils/logger');
const db = require('../../config/query.js');
const { ValidateUserBranchbyUserBranch } = require('../../utils/validator');
const { notifyUser, notifyUsers } = require('../../config/sockets');
const { trackNotification } = require('../../config/sockets/notification-acknowledgement');
const { v4: uuidv4 } = require('uuid');

const PATIENT_GROUPS = ['Student', 'Employee'];
const GROUP_BRANCHES = ['Manila', 'QuezonCity', 'Both'];
const GROUP_BATCH_SIZE = 50;
const groupPatientSource = `
  FROM "Patients" p
  JOIN "UserCredentials" uc ON uc.id = p.id
  JOIN "UsersPersonal" up ON up.id = p.id
  WHERE uc.credentials_status = 'Active'
    AND p.profile::text = ANY($1::text[])
    AND up.branch::text = ANY($2::text[])
`;

function getGroupPatientBranches(branch) {
  return branch === 'Both' ? GROUP_BRANCHES : [branch, 'Both'];
}

async function listPatientNotificationGroups(scope) {
  const { rows } = await db.query(`
    SELECT p.profile::text AS profile, up.branch::text AS branch, COUNT(*) AS count
    ${groupPatientSource}
    GROUP BY 1, 2
  `, [PATIENT_GROUPS, getGroupPatientBranches(scope)]);

  const branches = scope === 'Both' ? GROUP_BRANCHES : [scope];
  return {
    branches,
    groups: PATIENT_GROUPS.flatMap(profile => branches.map(branch => ({
      profile,
      branch,
      count: rows.reduce((count, row) => (
        row.profile === profile && getGroupPatientBranches(branch).includes(row.branch)
          ? count + Number(row.count)
          : count
      ), 0),
    }))),
  };
}

async function createNotificationData(notificationId, staffUserId, message, staffBranch) {
  const { rows: [sender] } = await db.query(`
    SELECT up.first_name, up.last_name
    FROM "UsersPersonal" up
    WHERE up.id = $1
  `, [staffUserId]);
  return {
    id: notificationId,
    type: 'staff_broadcast',
    message: message.trim(),
    timestamp: new Date().toISOString(),
    from: staffUserId,
    fromName: sender ? `${sender.first_name} ${sender.last_name}`.trim() : 'Staff Member',
    staffBranch,
  };
}

async function notifyPatientGroup(staffUserId, message, { profile, branch, expectedCount }) {
  const { rows } = await db.query(`
    SELECT p.id AS "userId"
    ${groupPatientSource}
    ORDER BY p.id
  `, [[profile], getGroupPatientBranches(branch)]);

  if (rows.length !== expectedCount) return { audienceChanged: true };

  const notificationId = `notif_staff_${uuidv4()}`;
  const data = await createNotificationData(notificationId, staffUserId, message, branch);
  const deliveryCounts = { delivered: 0, queued: 0, suppressed: 0, unconfirmed: 0 };

  for (let start = 0; start < rows.length; start += GROUP_BATCH_SIZE) {
    const batch = rows.slice(start, start + GROUP_BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(async ({ userId }) => {
      const id = String(userId);
      const outcome = await notifyUser(id, 'staff:notification', data);
      if (outcome === 'delivered' || outcome === 'queued') {
        await trackNotification(notificationId, id, staffUserId, outcome === 'delivered' ? 'socket' : 'email');
      }
      return outcome;
    }));
    for (const result of results) {
      if (result.status === 'fulfilled') deliveryCounts[result.value]++;
      else deliveryCounts.unconfirmed++;
    }
  }

  logger.info(`[NOTIFY_PATIENT_GROUP] ${notificationId} targeted ${rows.length} patients. Unconfirmed: ${deliveryCounts.unconfirmed}`);
  return { notificationId, totalRecipients: rows.length, deliveryCounts };
}

/**
 * Notify patients within the sender's authorized scope
 *
 * FIXED:
 * - Added null checks for branch/location
 * - Fixed location filter to prevent NULL locations from getting all notifications
 *
 * @param {string} staffUserId - The staff member user ID sending the notification
 * @param {string} message - The notification message (text freeform)
 * @returns {Promise<{
 *   notificationId: string,
 *   totalRecipients: number,
 *   delivery: {
 *     delivered: Array<{userId: string, deliveryMethod: 'socket', status: 'delivered'}>
 *     queued: Array<{userId: string, deliveryMethod: 'email', status: 'queued'}>
 *   }
 * }>}
 */
/**
 * @param {string} staffUserId
 * @param {string} message
 * @param {Array<string|number>|null} [recipientIds] - Optional. If provided, notify only these patient IDs.
 *   If null/empty, all in-scope patients are notified.
 * @param {string|null} [permissionScope] - Branch from the sender's patient notification permission.
 */
async function notifyPatients(staffUserId, message, recipientIds = null, permissionScope = null) {
  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new Error('Message is required and must be a non-empty string');
  }

  const notificationId = `notif_staff_${uuidv4()}`;

  try {
    // Get staff member's branch scope from MedicalPersonnel
    const staffQuery = `
      SELECT mp.id, mp.designation AS branch
      FROM "MedicalPersonnel" mp
      WHERE mp.id = $1 AND mp.is_active = true
    `;

    const staffResult = await db.query(staffQuery, [staffUserId]);
    const staffMember = staffResult.rows[0];

    if (!staffMember) {
      throw new Error(`Staff member not found or not active`);
    }

    const staffBranch = staffMember.branch;
    const isInScope = permissionScope
      ? patient => getGroupPatientBranches(permissionScope).includes(patient.branch)
      : patient => ValidateUserBranchbyUserBranch(staffBranch, patient.branch);

    logger.debug(`[NOTIFY_PATIENTS] Staff ${staffUserId} branch=${staffBranch}`);

    // Determine which patients to notify
    let validPatients;
    if (recipientIds && recipientIds.length > 0) {
      // Notify specific patients — validate they exist in the Patients table
      const filteredQuery = `
        SELECT DISTINCT uc.id as "userId", up.branch
        FROM "UserCredentials" uc
        INNER JOIN "Patients" p ON uc.id = p.id
        INNER JOIN "UsersPersonal" up ON uc.id = up.id
        WHERE uc.id::text = ANY($1)
        ORDER BY uc.id
      `;
      const filteredResult = await db.query(filteredQuery, [recipientIds.map(String)]);
      validPatients = filteredResult.rows.filter(isInScope);
      logger.debug(`[NOTIFY_PATIENTS] Filtered to ${validPatients.length} valid patients from ${recipientIds.length} requested IDs`);
    } else {
      // Existing callers can omit recipient IDs for an in-scope send.
      const patientQuery = `
        SELECT DISTINCT uc.id as "userId", up.branch
        FROM "UserCredentials" uc
        INNER JOIN "Patients" p ON uc.id = p.id
        INNER JOIN "UsersPersonal" up ON uc.id = up.id
        ORDER BY uc.id
      `;
      const patientResult = await db.query(patientQuery);
      validPatients = patientResult.rows.filter(isInScope);
    }

    if (!validPatients || validPatients.length === 0) {
      logger.info(`[NOTIFY_PATIENTS] No patients found for staff ${staffUserId}`);
      return {
        notificationId,
        totalRecipients: 0,
        delivery: { delivered: [], queued: [] }
      };
    }

    const patientIds = validPatients.map(p => String(p.userId));

    const notificationData = await createNotificationData(notificationId, staffUserId, message, staffBranch);

    logger.info(`[NOTIFY_PATIENTS] Sending notification ${notificationId} to ${patientIds.length} patients from staff:${staffUserId}`);

    const results = await notifyUsers(patientIds, 'staff:notification', notificationData);

    // Track delivery status for each recipient
    const deliveryDetails = {
      delivered: [],
      queued: []
    };

    for (const userId of results.delivered) {
      await trackNotification(notificationId, userId, staffUserId, 'socket');
      deliveryDetails.delivered.push({
        userId,
        deliveryMethod: 'socket',
        status: 'delivered'
      });
    }

    for (const userId of results.queued) {
      await trackNotification(notificationId, userId, staffUserId, 'email');
      deliveryDetails.queued.push({
        userId,
        deliveryMethod: 'email',
        status: 'queued'
      });
    }

    logger.debug(`[NOTIFY_PATIENTS] ${notificationId} - Delivered: ${results.delivered.length}, Queued: ${results.queued.length}`);

    return {
      notificationId,
      totalRecipients: patientIds.length,
      delivery: deliveryDetails
    };
  } catch (err) {
    logger.error(`[NOTIFY_PATIENTS] Error notifying patients: ${err.message}`);
    throw err;
  }
}

module.exports = { notifyPatients, listPatientNotificationGroups, notifyPatientGroup, PATIENT_GROUPS, GROUP_BRANCHES };
