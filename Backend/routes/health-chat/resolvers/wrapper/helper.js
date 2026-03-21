const db = require("../../../../config/query.js");

// Chat expiry duration in days
const CHAT_EXPIRY_DAYS = 3;

/**
 * Calculate expiry date from session start
 * @param {Date|string} sessionStart - The session start timestamp
 * @returns {Date} - The expiry date
 */
function calculateExpiryDate(sessionStart) {
  if (!sessionStart) return null;
  const startDate = new Date(sessionStart);
  const expiryDate = new Date(startDate);
  expiryDate.setDate(expiryDate.getDate() + CHAT_EXPIRY_DAYS);
  return expiryDate;
}

/**
 * Check if a chat has expired
 * @param {Date|string} sessionStart - The session start timestamp
 * @returns {boolean} - True if expired
 */
function isChatExpired(sessionStart) {
  if (!sessionStart) return false;
  const expiryDate = calculateExpiryDate(sessionStart);
  return new Date() > expiryDate;
}

/**
 * Get participant info (name, email) from user ID
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>} - Participant info or null
 */
async function getParticipantInfo(userId) {
  if (!userId) return null;

  const result = await db.query(
    `SELECT
      uc.id,
      COALESCE(up.first_name, 'Unknown') AS "firstName",
      COALESCE(up.last_name, 'User') AS "lastName",
      uc.email,
      up.identifier,
      COALESCE(p."profile", up.branch) AS "branch"
     FROM "UserCredentials" uc
     LEFT JOIN "UsersPersonal" up ON up.id = uc.id
     LEFT JOIN "Patients" p ON p.id = uc.id
     WHERE uc.id = $1`,
    [userId]
  );

  return result.rows[0] || null;
}

/**
 * Verify patient owns the chat ticket
 * @param {number} chatId - Chat ID
 * @param {number} patientId - Patient ID
 * @returns {Promise<boolean>}
 */
async function verifyPatientOwnsChat(chatId, patientId) {
  const result = await db.query(
    `SELECT 1 FROM "HealthChat" WHERE id = $1 AND "patientId" = $2`,
    [chatId, patientId]
  );
  return result.rowCount > 0;
}

/**
 * Verify medical staff is assigned to the chat
 * @param {number} chatId - Chat ID
 * @param {number} medicalId - Medical staff ID
 * @returns {Promise<boolean>}
 */
async function verifyMedicalAssignedToChat(chatId, medicalId) {
  const result = await db.query(
    `SELECT 1 FROM "HealthChat" WHERE id = $1 AND "medicalId" = $2`,
    [chatId, medicalId]
  );
  return result.rowCount > 0;
}

/**
 * Check if chat is active (not closed or expired)
 * @param {number} chatId - Chat ID
 * @returns {Promise<{isActive: boolean, status: string}>}
 */
async function checkChatStatus(chatId) {
  const result = await db.query(
    `SELECT status, session_start FROM "HealthChat" WHERE id = $1`,
    [chatId]
  );

  if (result.rowCount === 0) {
    return { isActive: false, status: null };
  }

  const { status, session_start } = result.rows[0];

  // Check if expired by time even if status hasn't been updated
  if (status === 'Ongoing' && isChatExpired(session_start)) {
    return { isActive: false, status: 'Expired' };
  }

  const activeStatuses = ['Open', 'Ongoing'];
  return {
    isActive: activeStatuses.includes(status),
    status
  };
}

/**
 * Format chat record with participant info and expiry
 * @param {Object} chat - Raw chat record from DB
 * @returns {Promise<Object>} - Formatted chat with participant info
 */
async function formatChatRecord(chat) {
  const [patient, medical] = await Promise.all([
    getParticipantInfo(chat.patientId),
    getParticipantInfo(chat.medicalId)
  ]);

  return {
    ...chat,
    patient,
    medical,
    closedBy: chat.closed_by_type || null,
    expiresAt: calculateExpiryDate(chat.session_start)
  };
}

/**
 * Format message with sender info
 * @param {Object} message - Raw message record from DB
 * @returns {Promise<Object>} - Formatted message with sender info
 */
async function formatMessage(message) {
  const sender = await getParticipantInfo(message.userId);
  return {
    ...message,
    sender
  };
}

/**
 * Auto-expire tickets that have had no messages for CHAT_EXPIRY_DAYS.
 * Uses the last message timestamp as reference for inactivity.
 * Self-sufficient expiry check - no background process required.
 * Called on relevant queries to ensure data consistency.
 * @param {number|null} patientId - Optional patient ID filter
 * @returns {Promise<number>} Number of tickets expired
 */
async function autoExpireTickets(patientId = null) {
  // Find tickets where the last message was more than CHAT_EXPIRY_DAYS ago
  let query = `
    UPDATE "HealthChat"
    SET status = 'Expired',
        session_end = NOW(),
        closed_by_type = 'System'
    WHERE status = 'Ongoing'
    AND (
      SELECT MAX(stamp) FROM "HealthChatPrompt"
      WHERE "consultationVirtualId" = "HealthChat".id
    ) < NOW() - INTERVAL '${CHAT_EXPIRY_DAYS} days'
  `;
  const params = [];

  if (patientId) {
    query += ` AND "HealthChat"."patientId" = $1`;
    params.push(patientId);
  }

  query += ` RETURNING id`;

  const result = await db.query(query, params);

  // Add system message to each expired chat
  for (const row of result.rows) {
    await db.query(
      `INSERT INTO "HealthChatPrompt"
       ("consultationVirtualId", "text", "promptType", "userId", "userType")
       VALUES ($1, $2, 'system', NULL, 'Medical')`,
      [row.id, `This ticket has been automatically closed after ${CHAT_EXPIRY_DAYS} days of inactivity.`]
    );
  }

  return result.rowCount;
}

/**
 * Check if patient has an active (non-closed/expired) ticket
 * Also handles auto-expiry check for ongoing tickets
 * @param {number} patientId - Patient ID
 * @returns {Promise<boolean>}
 */
async function hasActiveTicket(patientId) {
  // First, auto-expire any expired ongoing tickets for this patient
  await autoExpireTickets(patientId);

  const result = await db.query(
    `SELECT 1 FROM "HealthChat"
     WHERE "patientId" = $1
     AND status IN ('Open', 'Ongoing')
     LIMIT 1`,
    [patientId]
  );
  return result.rowCount > 0;
}

module.exports = {
  CHAT_EXPIRY_DAYS,
  calculateExpiryDate,
  isChatExpired,
  getParticipantInfo,
  verifyPatientOwnsChat,
  verifyMedicalAssignedToChat,
  checkChatStatus,
  formatChatRecord,
  formatMessage,
  hasActiveTicket,
  autoExpireTickets
};
