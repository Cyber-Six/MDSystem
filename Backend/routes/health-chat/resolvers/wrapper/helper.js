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
      up.first_name,
      up.last_name,
      uc.email,
      up.identifier,
      p.profile,
      up.branch,
      up.date_of_birth,
      up.sex
     FROM "UserCredentials" uc
     LEFT JOIN "UsersPersonal" up ON up.id = uc.id
     LEFT JOIN "Patients" p ON p.id = uc.id
     WHERE uc.id = $1`,
    [userId]
  );

  if (result.rowCount === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    firstName: row.first_name || 'Unknown',
    lastName: row.last_name || 'User',
    email: row.email,
    identifier: row.identifier,
    branch: row.profile || row.branch || null,
    dateOfBirth: row.date_of_birth ? row.date_of_birth.toISOString().split('T')[0] : null,
    sex: row.sex || null
  };
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
  const [patient, medical, lastMessageData] = await Promise.all([
    getParticipantInfo(chat.patientId),
    getParticipantInfo(chat.medicalId),
    getLastMessageInfo(chat.id)
  ]);

  return {
    ...chat,
    patient,
    medical,
    closedBy: chat.closed_by_type || null,
    expiresAt: calculateExpiryDate(chat.session_start),
    lastMessage: lastMessageData?.lastMessage || null,
    lastMessageAt: lastMessageData?.lastMessageAt || null,
    unreadCount: lastMessageData?.unreadCount || 0
  };
}

/**
 * Get last message info for a chat
 * @param {number} chatId - Chat ID
 * @returns {Promise<{lastMessage: Object, lastMessageAt: Date, unreadCount: number}>}
 */
async function getLastMessageInfo(chatId) {
  // Get last message
  const lastMsgResult = await db.query(
    `SELECT * FROM "HealthChatPrompt"
     WHERE "consultationVirtualId" = $1
     ORDER BY stamp DESC
     LIMIT 1`,
    [chatId]
  );

  if (lastMsgResult.rowCount === 0) {
    return { lastMessage: null, lastMessageAt: null, unreadCount: 0 };
  }

  const lastMsg = lastMsgResult.rows[0];
  const lastMessage = await formatMessage(lastMsg);

  // Count unread messages (messages from patient that staff hasn't read)
  // For simplicity, count messages from Patient after the last Medical message
  const unreadResult = await db.query(
    `SELECT COUNT(*)::int as count FROM "HealthChatPrompt"
     WHERE "consultationVirtualId" = $1
     AND "userType" = 'Patient'
     AND stamp > COALESCE(
       (SELECT MAX(stamp) FROM "HealthChatPrompt"
        WHERE "consultationVirtualId" = $1 AND "userType" = 'Medical'),
       '1970-01-01'
     )`,
    [chatId]
  );

  return {
    lastMessage,
    lastMessageAt: lastMsg.stamp,
    unreadCount: unreadResult.rows[0]?.count || 0
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
 * Batch-fetch participant info for multiple user IDs in a single query.
 * Returns a Map of userId -> participant info.
 * @param {number[]} userIds - Array of user IDs
 * @returns {Promise<Map<number, Object>>}
 */
async function getParticipantInfoBatch(userIds) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const result = await db.query(
    `SELECT
      uc.id,
      up.first_name,
      up.last_name,
      uc.email,
      up.identifier,
      p.profile,
      up.branch,
      up.date_of_birth,
      up.sex
     FROM "UserCredentials" uc
     LEFT JOIN "UsersPersonal" up ON up.id = uc.id
     LEFT JOIN "Patients" p ON p.id = uc.id
     WHERE uc.id = ANY($1)`,
    [uniqueIds]
  );

  const map = new Map();
  for (const row of result.rows) {
    map.set(row.id, {
      id: row.id,
      firstName: row.first_name || 'Unknown',
      lastName: row.last_name || 'User',
      email: row.email,
      identifier: row.identifier,
      branch: row.profile || row.branch || null,
      dateOfBirth: row.date_of_birth ? row.date_of_birth.toISOString().split('T')[0] : null,
      sex: row.sex || null
    });
  }
  return map;
}

/**
 * Batch-fetch last message info for multiple chat IDs in two queries.
 * Returns a Map of chatId -> { lastMessage, lastMessageAt, unreadCount }.
 * @param {number[]} chatIds - Array of chat IDs
 * @returns {Promise<Map<number, Object>>}
 */
async function getLastMessageInfoBatch(chatIds) {
  if (chatIds.length === 0) return new Map();

  // Get last message per chat using DISTINCT ON
  const lastMsgResult = await db.query(
    `SELECT DISTINCT ON ("consultationVirtualId") *
     FROM "HealthChatPrompt"
     WHERE "consultationVirtualId" = ANY($1)
     ORDER BY "consultationVirtualId", stamp DESC`,
    [chatIds]
  );

  // Get unread counts per chat in a single query
  const unreadResult = await db.query(
    `SELECT
       "consultationVirtualId" as chat_id,
       COUNT(*)::int as count
     FROM "HealthChatPrompt" p
     WHERE p."consultationVirtualId" = ANY($1)
     AND p."userType" = 'Patient'
     AND p.stamp > COALESCE(
       (SELECT MAX(p2.stamp) FROM "HealthChatPrompt" p2
        WHERE p2."consultationVirtualId" = p."consultationVirtualId" AND p2."userType" = 'Medical'),
       '1970-01-01'
     )
     GROUP BY p."consultationVirtualId"`,
    [chatIds]
  );

  const unreadMap = new Map();
  for (const row of unreadResult.rows) {
    unreadMap.set(row.chat_id, row.count);
  }

  // Collect sender IDs for batch lookup
  const senderIds = lastMsgResult.rows.map(r => r.userId).filter(Boolean);
  const senderMap = await getParticipantInfoBatch(senderIds);

  const map = new Map();
  for (const chatId of chatIds) {
    const lastMsg = lastMsgResult.rows.find(r => r.consultationVirtualId === chatId);
    if (!lastMsg) {
      map.set(chatId, { lastMessage: null, lastMessageAt: null, unreadCount: 0 });
    } else {
      map.set(chatId, {
        lastMessage: { ...lastMsg, sender: senderMap.get(lastMsg.userId) || null },
        lastMessageAt: lastMsg.stamp,
        unreadCount: unreadMap.get(chatId) || 0
      });
    }
  }
  return map;
}

/**
 * Format multiple chat records in batch, avoiding N+1 queries.
 * @param {Object[]} chats - Array of raw chat records from DB
 * @returns {Promise<Object[]>} - Formatted chats with participant info
 */
async function formatChatRecordsBatch(chats) {
  if (chats.length === 0) return [];

  // Collect all unique user IDs
  const userIds = [];
  const chatIds = [];
  for (const chat of chats) {
    if (chat.patientId) userIds.push(chat.patientId);
    if (chat.medicalId) userIds.push(chat.medicalId);
    chatIds.push(chat.id);
  }

  // Batch fetch participants and last messages
  const [participantMap, lastMessageMap] = await Promise.all([
    getParticipantInfoBatch(userIds),
    getLastMessageInfoBatch(chatIds)
  ]);

  return chats.map(chat => {
    const lastMessageData = lastMessageMap.get(chat.id) || {};
    return {
      ...chat,
      patient: participantMap.get(chat.patientId) || null,
      medical: participantMap.get(chat.medicalId) || null,
      closedBy: chat.closed_by_type || null,
      expiresAt: calculateExpiryDate(chat.session_start),
      lastMessage: lastMessageData.lastMessage || null,
      lastMessageAt: lastMessageData.lastMessageAt || null,
      unreadCount: lastMessageData.unreadCount || 0
    };
  });
}

/**
 * Auto-expire tickets that exceed CHAT_EXPIRY_DAYS.
 * Four cases are handled:
 *   1. Ongoing tickets whose session_start + CHAT_EXPIRY_DAYS is in the past.
 *   2. Open tickets where the patient account is already Expired in UserCredentials.
 *   3. Stale Open tickets where the last message is older than CHAT_EXPIRY_DAYS
 *      (every new ticket has a creation system message from _createTicket as the anchor).
 *   4. Legacy Open tickets with zero messages (MAX(stamp) IS NULL skips step 3 in SQL).
 * Self-sufficient check — no background process required.
 * Called on relevant queries to ensure data consistency.
 * @param {number|null} patientId - Optional patient ID filter
 * @returns {Promise<number>} Number of tickets expired
 */
// Track last auto-expire run to avoid redundant calls
let _lastAutoExpireRun = 0;
const AUTO_EXPIRE_COOLDOWN_MS = 30_000; // 30 seconds

async function autoExpireTickets(patientId = null) {
  // Rate-limit: skip if called within cooldown window (unless patient-specific)
  const now = Date.now();
  if (!patientId && now - _lastAutoExpireRun < AUTO_EXPIRE_COOLDOWN_MS) {
    return 0;
  }
  if (!patientId) _lastAutoExpireRun = now;

  const interval = `${CHAT_EXPIRY_DAYS} days`;
  let expiredCount = 0;

  // ── 1. Expire Ongoing tickets whose session window has elapsed ──────────────
  // session_start + CHAT_EXPIRY_DAYS <= NOW() matches the frontend's expiresAt.
  // extendSession pushes session_start forward by 1 day, so this stays consistent.
  const ongoingParams = [interval];
  let ongoingQuery = `
    UPDATE "HealthChat"
    SET status = 'Expired',
        session_end = NOW(),
        closed_by_type = 'System'
    WHERE status = 'Ongoing'
    AND session_start IS NOT NULL
    AND session_start + CAST($1 AS INTERVAL) <= NOW()
  `;

  if (patientId) {
    ongoingQuery += ` AND "patientId" = $2`;
    ongoingParams.push(patientId);
  }

  ongoingQuery += ` RETURNING id`;

  const ongoingResult = await db.query(ongoingQuery, ongoingParams);
  expiredCount += ongoingResult.rowCount;

  if (ongoingResult.rows.length > 0) {
    const ongoingMsg = `This ticket has been automatically closed by the system after ${CHAT_EXPIRY_DAYS} days of inactivity.`;
    const ongoingValues = ongoingResult.rows
      .map((_, i) => `($${i + 2}, $1, 'system', NULL, 'Medical')`)
      .join(', ');
    await db.query(
      `INSERT INTO "HealthChatPrompt" ("consultationVirtualId", "text", "promptType", "userId", "userType")
       VALUES ${ongoingValues}`,
      [ongoingMsg, ...ongoingResult.rows.map(r => r.id)]
    );
  }

  // ── 2. Expire Open tickets where the patient account is Inactive ──────
  // Open tickets have no session_start so step 1 never catches them.
  // Tie them to the patient's credential status for account-level expiry.
  let openExpiredQuery = `
    UPDATE "HealthChat" hc
    SET status = 'Expired',
        session_end = NOW(),
        closed_by_type = 'System'
    FROM "UserCredentials" uc
    WHERE hc."patientId" = uc.id
    AND hc.status = 'Open'
    AND uc.credentials_status = 'Inactive'
  `;
  const openExpiredParams = [];

  if (patientId) {
    openExpiredQuery += ` AND hc."patientId" = $1`;
    openExpiredParams.push(patientId);
  }

  openExpiredQuery += ` RETURNING hc.id`;

  const openExpiredResult = await db.query(openExpiredQuery, openExpiredParams);
  expiredCount += openExpiredResult.rowCount;

  if (openExpiredResult.rows.length > 0) {
    const openExpiredMsg = 'This ticket has been automatically closed because the patient account is inactive.';
    const openExpiredValues = openExpiredResult.rows
      .map((_, i) => `($${i + 2}, $1, 'system', NULL, 'Medical')`)
      .join(', ');
    await db.query(
      `INSERT INTO "HealthChatPrompt" ("consultationVirtualId", "text", "promptType", "userId", "userType")
       VALUES ${openExpiredValues}`,
      [openExpiredMsg, ...openExpiredResult.rows.map(r => r.id)]
    );
  }

  // ── 3. Expire stale Open tickets by inactivity ───────────────────────────────
  // Uses MAX(stamp) from HealthChatPrompt as the activity anchor.
  // _createTicket inserts a creation system message, so every new Open ticket has at
  // least one stamp. Tickets with no messages are NOT matched here (MAX IS NULL makes
  // the < comparison false in SQL) — handled by step 4.
  const staleOpenParams = [interval];
  let staleOpenQuery = `
    UPDATE "HealthChat"
    SET status = 'Expired',
        session_end = NOW(),
        closed_by_type = 'System'
    WHERE status = 'Open'
    AND (
      SELECT MAX(stamp) FROM "HealthChatPrompt"
      WHERE "consultationVirtualId" = "HealthChat".id
    ) < NOW() - CAST($1 AS INTERVAL)
  `;

  if (patientId) {
    staleOpenQuery += ` AND "HealthChat"."patientId" = $2`;
    staleOpenParams.push(patientId);
  }

  staleOpenQuery += ` RETURNING id`;

  const staleOpenResult = await db.query(staleOpenQuery, staleOpenParams);
  expiredCount += staleOpenResult.rowCount;

  if (staleOpenResult.rows.length > 0) {
    const staleMsg = `This consultation request was automatically closed by the system after ${CHAT_EXPIRY_DAYS} days without a staff response.`;
    const staleValues = staleOpenResult.rows
      .map((_, i) => `($${i + 2}, $1, 'system', NULL, 'Medical')`)
      .join(', ');
    await db.query(
      `INSERT INTO "HealthChatPrompt" ("consultationVirtualId", "text", "promptType", "userId", "userType")
       VALUES ${staleValues}`,
      [staleMsg, ...staleOpenResult.rows.map(r => r.id)]
    );
  }

  // ── 4. Expire legacy Open tickets with zero messages ────────────────────────
  // MAX(stamp) IS NULL causes step 3's < comparison to always be false in SQL.
  // Any Open ticket with no HealthChatPrompt rows is stale by definition —
  // new tickets always have a creation message from _createTicket.
  const noMsgParams = [];
  let noMsgQuery = `
    UPDATE "HealthChat"
    SET status = 'Expired',
        session_end = NOW(),
        closed_by_type = 'System'
    WHERE status = 'Open'
    AND NOT EXISTS (
      SELECT 1 FROM "HealthChatPrompt"
      WHERE "consultationVirtualId" = "HealthChat".id
    )
  `;

  if (patientId) {
    noMsgQuery += ` AND "HealthChat"."patientId" = $1`;
    noMsgParams.push(patientId);
  }

  noMsgQuery += ` RETURNING id`;

  const noMsgResult = await db.query(noMsgQuery, noMsgParams);
  expiredCount += noMsgResult.rowCount;

  if (noMsgResult.rows.length > 0) {
    const noMsgMsg = 'This ticket has been automatically closed (no activity recorded).';
    const noMsgValues = noMsgResult.rows
      .map((_, i) => `($${i + 2}, $1, 'system', NULL, 'Medical')`)
      .join(', ');
    await db.query(
      `INSERT INTO "HealthChatPrompt" ("consultationVirtualId", "text", "promptType", "userId", "userType")
       VALUES ${noMsgValues}`,
      [noMsgMsg, ...noMsgResult.rows.map(r => r.id)]
    );
  }

  return expiredCount;
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

async function getPatientIdFromChatId(chatId) {
  const result = await db.query(
    `SELECT "patientId" FROM "HealthChat"
     WHERE id = $1`,
    [chatId]
  );
  return result.rowCount > 0 ? result.rows[0].patientId : null;
}

module.exports = {
  CHAT_EXPIRY_DAYS,
  calculateExpiryDate,
  isChatExpired,
  getParticipantInfo,
  getParticipantInfoBatch,
  verifyPatientOwnsChat,
  verifyMedicalAssignedToChat,
  checkChatStatus,
  formatChatRecord,
  formatChatRecordsBatch,
  formatMessage,
  hasActiveTicket,
  autoExpireTickets,
  getLastMessageInfo,
  getPatientIdFromChatId,
};
