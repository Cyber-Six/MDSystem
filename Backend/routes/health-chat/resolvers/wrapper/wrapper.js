const db = require("../../../../config/query.js");
const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const { promoteFile } = require("../../../../config/multer.js");
const { emitToRoom, notifyUser } = require("../../../../config/sockets");
const {
  isMedicalAdmin,
  isMedicalPermittedPatientBased,
  permissions,
} = require("../../../../services/permit.js");
const logger = require("../../../../utils/logger.js");
const {
  calculateExpiryDate,
  isChatExpired,
  verifyPatientOwnsChat,
  verifyMedicalAssignedToChat,
  checkChatStatus,
  formatChatRecord,
  formatChatRecordsBatch,
  formatMessage,
  hasActiveTicket,
  getParticipantInfo,
  getParticipantInfoBatch,
  autoExpireTickets,
  getLastMessageInfo,
  CHAT_EXPIRY_DAYS
} = require("./helper.js");

const HEALTH_CHAT_ROOMS_BY_PATIENT_BRANCH = Object.freeze({
  Manila: ['notif:healthchat:Manila', 'notif:healthchat:Both'],
  QuezonCity: ['notif:healthchat:QuezonCity', 'notif:healthchat:Both'],
  Both: ['notif:healthchat:Manila', 'notif:healthchat:QuezonCity', 'notif:healthchat:Both'],
});

async function getPatientBranch(patientId) {
  if (!patientId) return 'Both';

  const result = await db.query(
    `SELECT branch
     FROM "UsersPersonal"
     WHERE id = $1
     LIMIT 1`,
    [patientId]
  );

  return result.rows[0]?.branch || 'Both';
}

function getHealthChatRoomsByPatientBranch(patientBranch) {
  return HEALTH_CHAT_ROOMS_BY_PATIENT_BRANCH[patientBranch] || HEALTH_CHAT_ROOMS_BY_PATIENT_BRANCH.Both;
}

function branchAllowsPatient(staffBranch, patientBranch) {
  return staffBranch === 'Both' || patientBranch === 'Both' || staffBranch === patientBranch;
}

async function emitHealthChatStaffEventByPatient(patientId, eventName, payload) {
  let rooms;

  try {
    const patientBranch = await getPatientBranch(patientId);
    rooms = getHealthChatRoomsByPatientBranch(patientBranch);
  } catch (error) {
    logger.error(`[HEALTHCHAT] Failed to resolve patient branch for socket routing: ${error.message}`);
    rooms = HEALTH_CHAT_ROOMS_BY_PATIENT_BRANCH.Both;
  }

  for (const room of new Set(rooms)) {
    emitToRoom(room, eventName, payload);
  }
}

const Query = {
  // ==================== PATIENT QUERIES ====================

  /**
   * Get patient's tickets with optional status filter
   */
  _getMyTickets: async (_, { status, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Auto-expire any expired ongoing tickets for this patient
    await autoExpireTickets(user.id);

    let query = `
      SELECT * FROM "HealthChat"
      WHERE "patientId" = $1
    `;
    const params = [user.id];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit || 10, offset || 0);

    const result = await db.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*)::int AS total FROM "HealthChat" WHERE "patientId" = $1`;
    const countParams = [user.id];
    if (status) {
      countQuery += ` AND status = $2`;
      countParams.push(status);
    }
    const countResult = await db.query(countQuery, countParams);

    const chats = await formatChatRecordsBatch(result.rows);

    return {
      chats,
      total: countResult.rows[0]?.total || 0
    };
  },

  /**
   * Get a specific ticket owned by patient
   */
  _getMyTicket: async (_, { chatId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Auto-expire any expired ongoing tickets for this patient
    await autoExpireTickets(user.id);

    const result = await db.query(
      `SELECT * FROM "HealthChat" WHERE id = $1 AND "patientId" = $2`,
      [chatId, user.id]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return await formatChatRecord(result.rows[0]);
  },

  /**
   * Get messages for a ticket (patient view)
   */
  _getTicketMessages: async (_, { chatId, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Verify patient owns this chat
    const owns = await verifyPatientOwnsChat(chatId, user.id);
    if (!owns) {
      throwGraphQLError(res).message("Chat not found").status(404).throw();
    }

    const result = await db.query(
      `SELECT * FROM "HealthChatPrompt"
       WHERE "consultationVirtualId" = $1
       ORDER BY stamp ASC
       LIMIT $2 OFFSET $3`,
      [chatId, limit || 50, offset || 0]
    );

    // Batch-fetch all sender info in one query to avoid N+1
    const senderIds = result.rows.map(r => r.userId).filter(Boolean);
    const senderMap = await getParticipantInfoBatch(senderIds);
    return result.rows.map(row => ({ ...row, sender: senderMap.get(row.userId) || null }));
  },

  // ==================== MEDICAL QUERIES ====================

  /**
   * Get pending tickets awaiting approval, filtered by location
   */
  _getPendingTickets: async (_, { location = 'Both', offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Auto-expire any expired ongoing tickets
    await autoExpireTickets();

    let query = `SELECT * FROM "HealthChat" WHERE status = 'Open'`;
    const params = [];

    // Filter by location if not 'Both'
    if (location && location !== 'Both') {
      query += ` AND "patientId" IN (
        SELECT up.id FROM "UsersPersonal" up
        WHERE up.branch = $1
      )`;
      params.push(location);
    }

    query += ` ORDER BY id ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit || 10, offset || 0);

    const result = await db.query(query, params);

    // Get count
    let countQuery = `SELECT COUNT(*)::int AS total FROM "HealthChat" WHERE status = 'Open'`;
    const countParams = [];
    if (location && location !== 'Both') {
      countQuery += ` AND "patientId" IN (
        SELECT up.id FROM "UsersPersonal" up
        WHERE up.branch = $1
      )`;
      countParams.push(location);
    }

    const countResult = await db.query(countQuery, countParams);

    const chats = await formatChatRecordsBatch(result.rows);

    return {
      chats,
      total: countResult.rows[0]?.total || 0
    };
  },

  /**
   * Get active (ongoing) tickets assigned to any medical staff, filtered by location
   */
  _getActiveTickets: async (_, { location = 'Both', offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const isAdmin = await isMedicalAdmin(user.id);

    // Auto-expire any expired ongoing tickets (critical for this query)
    await autoExpireTickets();

    let query = `SELECT * FROM "HealthChat" WHERE status = 'Ongoing'`;
    const params = [];

    // Filter by location if not 'Both'
    if (location && location !== 'Both') {
      query += ` AND "patientId" IN (
        SELECT up.id FROM "UsersPersonal" up
        WHERE up.branch = $1
      )`;
      params.push(location);
    }

    // One-staff policy: non-admin users can only see ongoing chats assigned to them.
    if (!isAdmin) {
      query += ` AND "medicalId" = $${params.length + 1}`;
      params.push(user.id);
    }

    query += ` ORDER BY session_start DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit || 10, offset || 0);

    const result = await db.query(query, params);

    // Get count
    let countQuery = `SELECT COUNT(*)::int AS total FROM "HealthChat" WHERE status = 'Ongoing'`;
    const countParams = [];
    if (location && location !== 'Both') {
      countQuery += ` AND "patientId" IN (
        SELECT up.id FROM "UsersPersonal" up
        WHERE up.branch = $1
      )`;
      countParams.push(location);
    }

    if (!isAdmin) {
      countQuery += ` AND "medicalId" = $${countParams.length + 1}`;
      countParams.push(user.id);
    }

    const countResult = await db.query(countQuery, countParams);

    const chats = await formatChatRecordsBatch(result.rows);

    return {
      chats,
      total: countResult.rows[0]?.total || 0
    };
  },

  /**
   * Get all tickets with optional status and location filter
   */
  _getAllTickets: async (_, { location = 'Both', status, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const isAdmin = await isMedicalAdmin(user.id);

    // Auto-expire any expired ongoing tickets
    await autoExpireTickets();

    let query = `SELECT * FROM "HealthChat"`;
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }

    // Filter by location if not 'Both'
    if (location && location !== 'Both') {
      conditions.push(`"patientId" IN (
        SELECT up.id FROM "UsersPersonal" up
        WHERE up.branch = $${params.length + 1}
      )`);
      params.push(location);
    }

    // One-staff policy: non-admin users can see all Open tickets (pending queue)
    // and only their own non-Open tickets.
    if (!isAdmin) {
      conditions.push(`(status = 'Open' OR "medicalId" = $${params.length + 1})`);
      params.push(user.id);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit || 10, offset || 0);

    const result = await db.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*)::int AS total FROM "HealthChat"`;
    const countParams = [];
    const countConditions = [];

    if (status) {
      countConditions.push(`status = $${countParams.length + 1}`);
      countParams.push(status);
    }

    if (location && location !== 'Both') {
      countConditions.push(`"patientId" IN (
        SELECT up.id FROM "UsersPersonal" up
        WHERE up.branch = $${countParams.length + 1}
      )`);
      countParams.push(location);
    }

    if (!isAdmin) {
      countConditions.push(`(status = 'Open' OR "medicalId" = $${countParams.length + 1})`);
      countParams.push(user.id);
    }

    if (countConditions.length > 0) {
      countQuery += ` WHERE ${countConditions.join(' AND ')}`;
    }

    const countResult = await db.query(countQuery, countParams);

    const chats = await formatChatRecordsBatch(result.rows);

    return {
      chats,
      total: countResult.rows[0]?.total || 0
    };
  },

  /**
   * Get a specific ticket (medical view - can see any)
   */
  _getTicket: async (_, { chatId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const isAdmin = await isMedicalAdmin(user.id);

    // Auto-expire any expired ongoing tickets
    await autoExpireTickets();

    const result = await db.query(
      `SELECT *
       FROM "HealthChat"
       WHERE id = $1
         AND ($2::boolean = true OR status = 'Open' OR "medicalId" = $3)`,
      [chatId, isAdmin, user.id]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return await formatChatRecord(result.rows[0]);
  },

  /**
   * Get messages for any ticket (medical view)
   */
  _getMessages: async (_, { chatId, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const isAdmin = await isMedicalAdmin(user.id);

    const chatResult = await db.query(
      `SELECT status, "medicalId"
       FROM "HealthChat"
       WHERE id = $1`,
      [chatId]
    );

    if (chatResult.rowCount === 0) {
      throwGraphQLError(res).message("Chat not found").status(404).throw();
    }

    const chat = chatResult.rows[0];
    if (!isAdmin && chat.status !== 'Open' && Number(chat.medicalId) !== Number(user.id)) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    const result = await db.query(
      `SELECT * FROM "HealthChatPrompt"
       WHERE "consultationVirtualId" = $1
       ORDER BY stamp ASC
       LIMIT $2 OFFSET $3`,
      [chatId, limit || 50, offset || 0]
    );

    // Batch-fetch all sender info in one query to avoid N+1
    const senderIds = result.rows.map(r => r.userId).filter(Boolean);
    const senderMap = await getParticipantInfoBatch(senderIds);
    return result.rows.map(row => ({ ...row, sender: senderMap.get(row.userId) || null }));
  },

  /**
   * Get conversations grouped by patient (1 row per patient), filtered by location
   * Returns patients with their latest ticket and last message info
   */
  _getPatientConversations: async (_, { location = 'Both', statuses, searchTerm, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const isAdmin = await isMedicalAdmin(user.id);

    // Auto-expire any expired ongoing tickets
    await autoExpireTickets();

    const params = [];
    const whereConditions = [];

    if (statuses && statuses.length > 0) {
      whereConditions.push(`status = ANY($${params.length + 1})`);
      params.push(statuses);
    }

    const normalizedSearchTerm = typeof searchTerm === 'string' ? searchTerm.trim() : '';
    const hasSearchTerm = normalizedSearchTerm.length >= 2;
    if (hasSearchTerm) {
      const prefixTerm = `${normalizedSearchTerm}%`;
      const anyTerm = `%${normalizedSearchTerm}%`;
      const tokens = normalizedSearchTerm.split(/\s+/).filter(Boolean);
      const hasTwoTokens = tokens.length >= 2;
      const token1Any = hasTwoTokens ? `%${tokens[0]}%` : null;
      const token2Any = hasTwoTokens ? `%${tokens[1]}%` : null;
      const baseIndex = params.length + 1;

      whereConditions.push(`EXISTS (
        SELECT 1
        FROM "UsersPersonal" up
        JOIN "UserCredentials" uc ON uc.id = up.id
        LEFT JOIN LATERAL (
          SELECT l.first_name, l.last_name
          FROM "UsersPersonalLog" l
          WHERE l.user_id = up.id
          ORDER BY l.created_at DESC
          LIMIT 1
        ) upl ON true
        WHERE up.id = "HealthChat"."patientId"
          AND (
            up.identifier::text ILIKE $${baseIndex}
            OR (COALESCE(upl.first_name, up.first_name, '') || ' ' || COALESCE(upl.last_name, up.last_name, '')) ILIKE $${baseIndex + 1}
            OR (COALESCE(upl.last_name, up.last_name, '') || ', ' || COALESCE(upl.first_name, up.first_name, '')) ILIKE $${baseIndex + 1}
            OR COALESCE(upl.first_name, up.first_name, '') ILIKE $${baseIndex + 1}
            OR COALESCE(upl.last_name, up.last_name, '') ILIKE $${baseIndex + 1}
            OR COALESCE(uc.email, '') ILIKE $${baseIndex + 1}
            OR (
              $${baseIndex + 4}::boolean = true AND (
                (COALESCE(upl.first_name, up.first_name, '') ILIKE $${baseIndex + 2} AND COALESCE(upl.last_name, up.last_name, '') ILIKE $${baseIndex + 3})
                OR
                (COALESCE(upl.last_name, up.last_name, '') ILIKE $${baseIndex + 2} AND COALESCE(upl.first_name, up.first_name, '') ILIKE $${baseIndex + 3})
              )
            )
          )
      )`);
      params.push(prefixTerm, anyTerm, token1Any, token2Any, hasTwoTokens);
    }

    if (location && location !== 'Both') {
      whereConditions.push(`"patientId" IN (
        SELECT up.id FROM "UsersPersonal" up
        WHERE up.branch = $${params.length + 1}
      )`);
      params.push(location);
    }

    // One-staff policy: non-admin users can see all Open tickets and only
    // their own non-Open tickets.
    if (!isAdmin) {
      whereConditions.push(`(status = 'Open' OR "medicalId" = $${params.length + 1})`);
      params.push(user.id);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Get unique patients with their latest ticket
    // Use ROW_NUMBER to get one row per patient, ordered by priority (Ongoing > Open > others)
    const query = `
      WITH RankedTickets AS (
        SELECT
          *,
          ROW_NUMBER() OVER (
            PARTITION BY "patientId"
            ORDER BY
              CASE
                WHEN status = 'Ongoing' THEN 0
                WHEN status = 'Open' THEN 1
                ELSE 2
              END,
              COALESCE(session_start, NOW()) DESC,
              id DESC
          ) as rn
        FROM "HealthChat"
        ${whereClause}
      ),
      LatestTickets AS (
        SELECT * FROM RankedTickets WHERE rn = 1
      ),
      TicketCounts AS (
        SELECT
          "patientId",
          COUNT(*) FILTER (WHERE status IN ('Open', 'Ongoing')) as active_count,
          COUNT(*) as total_count
        FROM "HealthChat"
        ${whereClause}
        GROUP BY "patientId"
      )
      SELECT
        lt.*,
        tc.active_count,
        tc.total_count
      FROM LatestTickets lt
      LEFT JOIN TicketCounts tc ON lt."patientId" = tc."patientId"
      ORDER BY
        CASE
          WHEN lt.status = 'Ongoing' THEN 0
          WHEN lt.status = 'Open' THEN 1
          ELSE 2
        END,
        COALESCE(lt.session_start, NOW()) DESC,
        lt.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const queryParams = [...params, limit || 50, offset || 0];

    try {
      const result = await db.query(query, queryParams);

      // Get count of unique patients
      const countQuery = `
        SELECT COUNT(DISTINCT "patientId")::int as total
        FROM "HealthChat"
        ${whereClause}
      `;
      const countResult = await db.query(countQuery, params);

      // Format conversations using batch lookups to avoid N+1 queries
      // 1. Batch-format the latest tickets from the main query
      const latestTickets = await formatChatRecordsBatch(result.rows);

      // 2. Fetch ALL tickets for each patient regardless of status filter.
      // This ensures the frontend has complete ticket history for dividers and
      // initial-context (purposeSynth) even when archive filter is off.
      const patientIds = result.rows.map(r => r.patientId);

      if (patientIds.length === 0) {
        return {
          conversations: [],
          total: countResult.rows[0]?.total || 0,
        };
      }

      let allTicketsQuery = `SELECT * FROM "HealthChat"
         WHERE "patientId" = ANY($1)`;
      const allTicketsParams = [patientIds];

      if (!isAdmin) {
        allTicketsQuery += ` AND (status = 'Open' OR "medicalId" = $2)`;
        allTicketsParams.push(user.id);
      }

      allTicketsQuery += ` ORDER BY id DESC`;

      const allTicketsResult = await db.query(allTicketsQuery, allTicketsParams);
      const allTicketsFormatted = await formatChatRecordsBatch(allTicketsResult.rows);

      // Group tickets by patientId
      const ticketsByPatient = new Map();
      for (const ticket of allTicketsFormatted) {
        if (!ticketsByPatient.has(ticket.patientId)) {
          ticketsByPatient.set(ticket.patientId, []);
        }
        ticketsByPatient.get(ticket.patientId).push(ticket);
      }

      // 3. Build conversations
      const conversations = latestTickets.map((latestTicket, i) => {
        const row = result.rows[i];
        return {
          patientId: row.patientId,
          patient: latestTicket.patient,
          latestTicket,
          lastMessage: latestTicket.lastMessage,
          lastMessageAt: latestTicket.lastMessageAt,
          unreadCount: latestTicket.unreadCount,
          activeTicketCount: row.active_count || 0,
          totalTicketCount: row.total_count || 0,
          tickets: ticketsByPatient.get(row.patientId) || []
        };
      });

      return {
        conversations,
        total: countResult.rows[0]?.total || 0
      };
    } catch (error) {
      console.error('[_getPatientConversations] SQL Error:', error);
      throwGraphQLError(res).message(`Failed to fetch conversations: ${error.message}`).status(500).throw();
    }
  },

  /**
   * Get all messages for a patient across all their tickets
   * Messages are ordered by stamp ASC with ticket dividers inserted
   */
  _getPatientMessages: async (_, { patientId, offset, limit, before }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const isAdmin = await isMedicalAdmin(user.id);

    // Effective page size
    const pageSize = limit || 50;

    let result;
    if (before) {
      const params = [patientId, before, pageSize];
      const ownershipFilter = isAdmin
        ? ''
        : ` AND (hc.status = 'Open' OR hc."medicalId" = $4)`;
      if (!isAdmin) {
        params.push(user.id);
      }

      // Cursor-based: fetch up to pageSize messages OLDER than the given timestamp.
      // Return them in ASC order so the frontend can prepend correctly.
      result = await db.query(
        `SELECT * FROM (
           SELECT
             p.*,
             hc.purpose  AS ticket_purpose,
             hc.status   AS ticket_status,
             hc.session_end AS ticket_session_end,
             hc.closed_by_type AS ticket_closed_by
           FROM "HealthChatPrompt" p
           JOIN "HealthChat" hc ON hc.id = p."consultationVirtualId"
           WHERE hc."patientId" = $1 AND p.stamp < $2${ownershipFilter}
           ORDER BY p.stamp DESC
           LIMIT $3
         ) sub
         ORDER BY stamp ASC`,
        params
      );
    } else {
      const params = [patientId, pageSize];
      const ownershipFilter = isAdmin
        ? ''
        : ` AND (hc.status = 'Open' OR hc."medicalId" = $3)`;
      if (!isAdmin) {
        params.push(user.id);
      }

      // Initial load: return the LATEST pageSize messages in ASC order.
      // DESC subquery + outer ASC gives newest-N ordered oldest-first for display.
      result = await db.query(
        `SELECT * FROM (
           SELECT
             p.*,
             hc.purpose  AS ticket_purpose,
             hc.status   AS ticket_status,
             hc.session_end AS ticket_session_end,
             hc.closed_by_type AS ticket_closed_by
           FROM "HealthChatPrompt" p
           JOIN "HealthChat" hc ON hc.id = p."consultationVirtualId"
           WHERE hc."patientId" = $1${ownershipFilter}
           ORDER BY p.stamp DESC
           LIMIT $2
         ) sub
         ORDER BY stamp ASC`,
        params
      );
    }

    // Batch-fetch all sender info in one query to avoid N+1 (one query per message).
    // System messages have userId=null, getParticipantInfoBatch skips null IDs.
    const senderIds = result.rows.map(r => r.userId).filter(Boolean);
    const senderMap = await getParticipantInfoBatch(senderIds);

    return result.rows.map(row => ({
      ...row,
      sender: senderMap.get(row.userId) || null,
      // Include ticket info for divider rendering
      ticketPurpose: row.ticket_purpose,
      ticketStatus: row.ticket_status,
      ticketSessionEnd: row.ticket_session_end,
      ticketClosedBy: row.ticket_closed_by
    }));
  },

  /**
   * List transfer-eligible medical staff for a specific ongoing ticket.
   * Eligibility: has health chat access for this patient's branch (or is admin).
   */
  _getTransferCandidates: async (_, { chatId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const chatResult = await db.query(
      `SELECT id, "patientId", "medicalId", status
       FROM "HealthChat"
       WHERE id = $1`,
      [chatId]
    );

    if (chatResult.rowCount === 0) {
      throwGraphQLError(res).message("Chat not found").status(404).throw();
    }

    const chat = chatResult.rows[0];
    if (chat.status !== 'Ongoing') {
      throwGraphQLError(res).message("Only ongoing tickets can be transferred").status(400).throw();
    }

    const isAdmin = await isMedicalAdmin(user.id);
    if (!isAdmin && Number(chat.medicalId) !== Number(user.id)) {
      throwGraphQLError(res).message("You are not allowed to transfer this ticket").status(403).throw();
    }

    const patientResult = await db.query(
      `SELECT up.branch, p.profile AS identity
       FROM "UsersPersonal" up
       LEFT JOIN "Patients" p ON p.id = up.id
       WHERE up.id = $1
       LIMIT 1`,
      [chat.patientId]
    );

    const patientBranch = patientResult.rows[0]?.branch || 'Both';
    const patientIdentity = patientResult.rows[0]?.identity || null;

    const staffResult = await db.query(
      `SELECT
         mp.id,
         mp.designation AS branch,
         mp.role,
         up.first_name,
         up.last_name,
         uc.email
       FROM "MedicalPersonnel" mp
       JOIN "UsersPersonal" up ON up.id = mp.id
       JOIN "UserCredentials" uc ON uc.id = mp.id
       WHERE uc.credentials_status = 'Active'
         AND mp.id <> $1
         AND (
           EXISTS (
             SELECT 1
             FROM "rolesMap" rm
             JOIN "rolesTable" rt ON rt.id = rm."rolesId"
             WHERE rm."personnelId" = mp.id
               AND rt.label = $2
           )
           OR (
             EXISTS (
               SELECT 1
               FROM "rolesMap" rm
               JOIN "rolesTable" rt ON rt.id = rm."rolesId"
               WHERE rm."personnelId" = mp.id
                 AND rt.label = $3
                 AND (rm.branch = 'Both' OR $4 = 'Both' OR rm.branch = $4)
             )
             AND (mp.designation = 'Both' OR $4 = 'Both' OR mp.designation = $4)
           )
         )
         AND (
           $5::text <> 'Superior'
           OR EXISTS (
             SELECT 1
             FROM "rolesMap" rm
             JOIN "rolesTable" rt ON rt.id = rm."rolesId"
             WHERE rm."personnelId" = mp.id
               AND rt.label = $2
           )
           OR EXISTS (
             SELECT 1
             FROM "rolesMap" rm
             JOIN "rolesTable" rt ON rt.id = rm."rolesId"
             WHERE rm."personnelId" = mp.id
               AND rt.label = $6
           )
         )
       ORDER BY up.first_name ASC, up.last_name ASC, mp.id ASC`,
      [
        chat.medicalId,
        permissions.is_admin,
        permissions.health_chat_allow_access,
        patientBranch,
        patientIdentity,
        permissions.privileged_to_perform_on_superior,
      ]
    );

    return staffResult.rows.map((staff) => ({
      id: staff.id,
      firstName: staff.first_name || null,
      lastName: staff.last_name || null,
      email: staff.email || null,
      branch: staff.branch || null,
      role: staff.role || null,
    }));
  }
};

const Mutation = {
  // ==================== PATIENT MUTATIONS ====================

  /**
   * Create a new ticket
   */
  _createTicket: async (_, { input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Check if patient already has an active ticket
    const hasActive = await hasActiveTicket(user.id);
    if (hasActive) {
      throwGraphQLError(res)
        .message("You already have an active ticket. Please wait for it to be resolved.")
        .status(400)
        .throw();
    }

    const result = await db.query(
      `INSERT INTO "HealthChat" ("patientId", "purpose", "notes", "status")
       VALUES ($1, $2, $3, 'Open')
       RETURNING *`,
      [user.id, input.purpose, input.notes || null]
    );

    if (result.rowCount === 0) {
      throwGraphQLError(res).message("Failed to create ticket").status(500).throw();
    }

    const chatId = result.rows[0].id;

    // Insert a creation system message so the ticket has an inactivity timestamp anchor.
    // autoExpireTickets uses MAX(stamp) to detect stale Open tickets; without this
    // message a pending ticket with no chat activity would never be auto-expired.
    await db.query(
      `INSERT INTO "HealthChatPrompt"
       ("consultationVirtualId", "text", "promptType", "userId", "userType")
       VALUES ($1, 'Consultation request submitted. Waiting for staff response.', 'system', NULL, 'Medical')`,
      [chatId]
    );

    const chat = await formatChatRecord(result.rows[0]);

    // Notify only health-chat permitted staff about new ticket
    await emitHealthChatStaffEventByPatient(chat.patientId, 'healthchat:ticket-created', { chat });

    return {
      success: true,
      chat,
      message: "Ticket created successfully. Please wait for staff approval."
    };
  },

  /**
   * Send a message as patient
   */
  _sendPatientMessage: async (_, { input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const { chatId, text, filename, promptType } = input;

    // Validate that at least text or filename is provided
    const hasText = text && text.trim().length > 0;
    const hasFile = filename && promptType === 'file';

    if (!hasText && !hasFile) {
      throwGraphQLError(res)
        .message("Message must contain either text or a file.")
        .status(400)
        .throw();
    }

    // Verify patient owns this chat
    const owns = await verifyPatientOwnsChat(chatId, user.id);
    if (!owns) {
      throwGraphQLError(res).message("Chat not found").status(404).throw();
    }

    // Auto-expire any expired tickets before checking status
    await autoExpireTickets(user.id);

    // Check chat status
    const { isActive, status } = await checkChatStatus(chatId);
    if (!isActive) {
      throwGraphQLError(res)
        .message(`Cannot send message. Chat is ${status || 'not active'}.`)
        .status(400)
        .throw();
    }

    // Promote file if uploading
    // Note: Using "eConsultation" category for Health Chat files (legacy name for backward compatibility)
    let finalFilename = filename;
    if (filename && promptType === 'file') {
      finalFilename = await promoteFile(user.id, filename, "eConsultation");
    }

    const result = await db.query(
      `INSERT INTO "HealthChatPrompt"
       ("consultationVirtualId", "text", "filename", "promptType", "userId", "userType")
       VALUES ($1, $2, $3, $4, $5, 'Patient')
       RETURNING *`,
      [chatId, text || null, finalFilename || null, promptType, user.id]
    );

    if (result.rowCount === 0) {
      throwGraphQLError(res).message("Failed to send message").status(500).throw();
    }

    const message = await formatMessage(result.rows[0]);

    // Emit to chat room for real-time delivery
    emitToRoom(`healthchat:${chatId}`, 'healthchat:new-message', {
      chatId,
      message,
      senderType: 'Patient'
    });

    // Also notify the assigned medical staff if they're offline
    const chatInfo = await db.query(
      `SELECT "medicalId" FROM "HealthChat" WHERE id = $1`,
      [chatId]
    );
    if (chatInfo.rows[0]?.medicalId) {
      notifyUser(String(chatInfo.rows[0].medicalId), 'healthchat:new-message', {
        chatId,
        message,
        senderType: 'Patient'
      }).catch(err => logger.error(`[HEALTHCHAT] notifyUser failed: ${err.message}`));
    }

    return {
      success: true,
      message
    };
  },

  /**
   * Patient closes their own ticket
   */
  _closeMyTicket: async (_, { chatId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Verify patient owns this chat
    const owns = await verifyPatientOwnsChat(chatId, user.id);
    if (!owns) {
      throwGraphQLError(res).message("Chat not found").status(404).throw();
    }

    const result = await db.query(
      `UPDATE "HealthChat"
       SET status = 'Closed',
           session_end = NOW(),
           closed_by_type = 'Patient'
       WHERE id = $1 AND "patientId" = $2 AND status IN ('Open', 'Ongoing')
       RETURNING *`,
      [chatId, user.id]
    );

    if (result.rowCount === 0) {
      throwGraphQLError(res).message("Cannot close this ticket. It may already be closed or expired.").status(400).throw();
    }

    // Add system message
    await db.query(
      `INSERT INTO "HealthChatPrompt"
       ("consultationVirtualId", "text", "promptType", "userId", "userType")
       VALUES ($1, 'Patient closed this ticket.', 'system', $2, 'Patient')`,
      [chatId, user.id]
    );

    const chat = await formatChatRecord(result.rows[0]);

    // Emit to chat room about ticket closure
    emitToRoom(`healthchat:${chatId}`, 'healthchat:ticket-closed', {
      chatId,
      closedBy: 'Patient',
      chat
    });

    // Also notify health-chat permitted staff so their conversation list updates
    // (staff may not be in the chat room if viewing a different patient)
    await emitHealthChatStaffEventByPatient(chat.patientId, 'healthchat:ticket-closed', {
      chatId,
      closedBy: 'Patient',
      chat
    });

    return {
      success: true,
      chat,
      message: "Ticket closed successfully."
    };
  },

  // ==================== MEDICAL MUTATIONS ====================

  /**
   * Approve a ticket and start chat session
   */
  _approveTicket: async (_, { input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const { chatId, notes } = input;

    // Check if ticket is still pending
    const checkResult = await db.query(
      `SELECT status, id FROM "HealthChat" WHERE id = $1`,
      [chatId]
    );

    if (checkResult.rowCount === 0) {
      throwGraphQLError(res).message(`Ticket with ID ${chatId} not found`).status(404).throw();
    }

    const currentStatus = checkResult.rows[0].status;
    if (currentStatus !== 'Open') {
      throwGraphQLError(res)
        .message(`Ticket cannot be approved. Current status: ${currentStatus}. Only tickets with status 'Open' can be approved.`)
        .status(400)
        .throw();
    }

    const result = await db.query(
      `UPDATE "HealthChat"
       SET status = 'Ongoing',
           "medicalId" = $1,
           session_start = NOW(),
           notes = COALESCE($2, notes),
           consent_logged = true
       WHERE id = $3 AND status = 'Open'
       RETURNING *`,
      [user.id, notes, chatId]
    );

    if (result.rowCount === 0) {
      throwGraphQLError(res)
        .message("Ticket is no longer pending. Another staff may have already handled it.")
        .status(409)
        .throw();
    }

    // Add system message
    await db.query(
      `INSERT INTO "HealthChatPrompt"
       ("consultationVirtualId", "text", "promptType", "userId", "userType")
       VALUES ($1, 'Staff has approved this consultation. Chat session started. Session will expire after ${CHAT_EXPIRY_DAYS} days of inactivity.', 'system', $2, 'Medical')`,
      [chatId, user.id]
    );

    const chat = await formatChatRecord(result.rows[0]);

    // Notify patient about ticket approval
    if (chat.patientId) {
      notifyUser(chat.patientId, 'healthchat:ticket-approved', { chat })
        .catch(err => logger.error(`[HEALTHCHAT] notifyUser failed: ${err.message}`));
    }

    // Notify health-chat permitted staff about ticket status change (so other staff can update their UI)
    await emitHealthChatStaffEventByPatient(chat.patientId, 'healthchat:ticket-status-changed', {
      chatId: chat.id,
      patientId: chat.patientId,
      status: 'Ongoing',
      approvedBy: user.id,
      medicalId: chat.medicalId,
    });

    return {
      success: true,
      chat,
      message: "Ticket approved. Chat session started."
    };
  },

  /**
   * Reject a ticket
   */
  _rejectTicket: async (_, { chatId, reason }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Check if ticket is still pending
    const checkResult = await db.query(
      `SELECT status FROM "HealthChat" WHERE id = $1`,
      [chatId]
    );

    if (checkResult.rowCount === 0) {
      throwGraphQLError(res).message("Ticket not found").status(404).throw();
    }

    if (checkResult.rows[0].status !== 'Open') {
      throwGraphQLError(res)
        .message("Ticket is not in pending state")
        .status(400)
        .throw();
    }

    const result = await db.query(
      `UPDATE "HealthChat"
       SET status = 'Closed',
           "medicalId" = $1,
           notes = $2,
           session_end = NOW(),
           closed_by_type = 'Staff'
       WHERE id = $3 AND status = 'Open'
       RETURNING *`,
      [user.id, reason || 'Ticket rejected by staff.', chatId]
    );

    if (result.rowCount === 0) {
      throwGraphQLError(res)
        .message("Ticket is no longer pending. Another staff may have already handled it.")
        .status(409)
        .throw();
    }

    // Add system message
    await db.query(
      `INSERT INTO "HealthChatPrompt"
       ("consultationVirtualId", "text", "promptType", "userId", "userType")
       VALUES ($1, $2, 'system', $3, 'Medical')`,
      [chatId, `Ticket rejected. Reason: ${reason || 'Not specified'}`, user.id]
    );

    const chat = await formatChatRecord(result.rows[0]);

    // Notify patient about ticket rejection
    if (chat.patientId) {
      notifyUser(chat.patientId, 'healthchat:ticket-rejected', {
        chat,
        reason: reason || 'Not specified'
      }).catch(err => logger.error(`[HEALTHCHAT] notifyUser failed: ${err.message}`));
    }

    // Notify health-chat permitted staff about ticket status change (so other staff can update their UI)
    await emitHealthChatStaffEventByPatient(chat.patientId, 'healthchat:ticket-status-changed', {
      chatId: chat.id,
      patientId: chat.patientId,
      status: 'Closed',
      rejectedBy: user.id,
      reason: reason || 'Not specified',
      medicalId: chat.medicalId,
    });

    return {
      success: true,
      chat,
      message: "Ticket rejected."
    };
  },

  /**
   * Send a message as medical staff
   */
  _sendMedicalMessage: async (_, { input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const isAdmin = await isMedicalAdmin(user.id);

    const { chatId, text, filename, promptType } = input;

    // Validate that at least text or filename is provided
    const hasText = text && text.trim().length > 0;
    const hasFile = filename && promptType === 'file';

    if (!hasText && !hasFile) {
      throwGraphQLError(res)
        .message("Message must contain either text or a file.")
        .status(400)
        .throw();
    }

    // Auto-expire any expired tickets before checking status
    await autoExpireTickets();

    // Check chat status
    const { isActive, status } = await checkChatStatus(chatId);
    if (!isActive) {
      throwGraphQLError(res)
        .message(`Cannot send message. Chat is ${status || 'not active'}.`)
        .status(400)
        .throw();
    }

    // Verify the chat exists and enforce one-staff ownership policy.
    const chatResult = await db.query(
      `SELECT "medicalId", "patientId", status FROM "HealthChat" WHERE id = $1`,
      [chatId]
    );

    if (chatResult.rowCount === 0) {
      throwGraphQLError(res).message("Chat not found").status(404).throw();
    }

    const chat = chatResult.rows[0];
    if (chat.status !== 'Ongoing') {
      throwGraphQLError(res).message("Only ongoing tickets can receive staff messages.").status(400).throw();
    }

    if (!isAdmin && Number(chat.medicalId) !== Number(user.id)) {
      throwGraphQLError(res).message("Only the assigned staff can send messages to this ticket.").status(403).throw();
    }

    // Promote file if uploading
    // Note: Using "eConsultation" category for Health Chat files (legacy name for backward compatibility)
    let finalFilename = filename;
    if (filename && promptType === 'file') {
      finalFilename = await promoteFile(user.id, filename, "eConsultation");
    }

    const result = await db.query(
      `INSERT INTO "HealthChatPrompt"
       ("consultationVirtualId", "text", "filename", "promptType", "userId", "userType")
       VALUES ($1, $2, $3, $4, $5, 'Medical')
       RETURNING *`,
      [chatId, text || null, finalFilename || null, promptType, user.id]
    );

    if (result.rowCount === 0) {
      throwGraphQLError(res).message("Failed to send message").status(500).throw();
    }

    const message = await formatMessage(result.rows[0]);

    // Emit to chat room for real-time delivery
    emitToRoom(`healthchat:${chatId}`, 'healthchat:new-message', {
      chatId,
      message,
      senderType: 'Medical'
    });

    // Also notify the patient if they're offline
    const patientId = chat.patientId;
    if (patientId) {
      notifyUser(String(patientId), 'healthchat:new-message', {
        chatId,
        message,
        senderType: 'Medical'
      }).catch(err => logger.error(`[HEALTHCHAT] notifyUser failed: ${err.message}`));
    }

    return {
      success: true,
      message
    };
  },

  /**
   * Medical staff closes a ticket
   */
  _closeTicket: async (_, { input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const isAdmin = await isMedicalAdmin(user.id);

    const { chatId, notes } = input;

    let closeQuery =
      `UPDATE "HealthChat"
       SET status = 'Closed',
           session_end = NOW(),
           notes = COALESCE($1, notes),
           closed_by_type = 'Staff'
       WHERE id = $2 AND status IN ('Open', 'Ongoing')`;

    const closeParams = [notes, chatId];

    // One-staff policy: only assigned staff can close their own ongoing ticket.
    if (!isAdmin) {
      closeQuery += ` AND "medicalId" = $3`;
      closeParams.push(user.id);
    }

    closeQuery += ` RETURNING *`;

    const result = await db.query(closeQuery, closeParams);

    if (result.rowCount === 0) {
      throwGraphQLError(res).message("Ticket not found, already closed/expired, or not assigned to you").status(400).throw();
    }

    // Add system message
    await db.query(
      `INSERT INTO "HealthChatPrompt"
       ("consultationVirtualId", "text", "promptType", "userId", "userType")
       VALUES ($1, 'Staff closed this ticket.', 'system', $2, 'Medical')`,
      [chatId, user.id]
    );

    const chat = await formatChatRecord(result.rows[0]);

    // Emit to chat room about ticket closure
    emitToRoom(`healthchat:${chatId}`, 'healthchat:ticket-closed', {
      chatId,
      closedBy: 'Medical',
      chat
    });

    // Also notify patient if they're offline
    if (chat.patientId) {
      notifyUser(chat.patientId, 'healthchat:ticket-closed', {
        chatId,
        closedBy: 'Medical',
        chat
      }).catch(err => logger.error(`[HEALTHCHAT] notifyUser failed: ${err.message}`));
    }

    // Update pending/active lists in real-time for eligible staff.
    await emitHealthChatStaffEventByPatient(chat.patientId, 'healthchat:ticket-status-changed', {
      chatId: chat.id,
      patientId: chat.patientId,
      status: 'Closed',
      closedBy: user.id,
      medicalId: chat.medicalId,
    });

    return {
      success: true,
      chat,
      message: "Ticket closed successfully."
    };
  },

  _transferTicket: async (_, { chatId, toMedicalId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const isAdmin = await isMedicalAdmin(user.id);

    // Verify the chat exists and is ongoing
    const chatResult = await db.query(
      `SELECT * FROM "HealthChat" WHERE id = $1 AND status = 'Ongoing'`,
      [chatId]
    );

    if (chatResult.rowCount === 0) {
      throwGraphQLError(res).message("Active chat session not found").status(404).throw();
    }

    const chat = chatResult.rows[0];
    const fromMedicalId = chat.medicalId;

    if (!isAdmin && Number(chat.medicalId) !== Number(user.id)) {
      throwGraphQLError(res).message(`You are not the assigned medical staff for this ticket`).status(403).throw();
    }

    if (Number(toMedicalId) === Number(fromMedicalId)) {
      throwGraphQLError(res).message("Ticket is already assigned to this staff member").status(400).throw();
    }

    const [targetStaffResult, patientBranch, isTargetPermitted] = await Promise.all([
      db.query(
        `SELECT mp.designation, uc.credentials_status
         FROM "MedicalPersonnel" mp
         JOIN "UserCredentials" uc ON uc.id = mp.id
         WHERE mp.id = $1
         LIMIT 1`,
        [toMedicalId]
      ),
      getPatientBranch(chat.patientId),
      isMedicalPermittedPatientBased(
        toMedicalId,
        permissions.health_chat_allow_access,
        chat.patientId
      ),
    ]);

    if (targetStaffResult.rowCount === 0 || targetStaffResult.rows[0]?.credentials_status !== 'Active') {
      throwGraphQLError(res).message("Target staff account is not active").status(400).throw();
    }

    if (!isTargetPermitted) {
      throwGraphQLError(res)
        .message("Target staff lacks health chat permission for this patient branch")
        .status(403)
        .throw();
    }

    const targetDesignation = targetStaffResult.rows[0]?.designation || 'Both';
    if (!branchAllowsPatient(targetDesignation, patientBranch)) {
      throwGraphQLError(res)
        .message("Target staff designation does not match the patient's branch scope")
        .status(403)
        .throw();
    }

    // Update the medicalId to the new medical staff
    const result = await db.query(
      `UPDATE "HealthChat"
       SET "medicalId" = $1
       WHERE id = $2 AND status = 'Ongoing'
       RETURNING *`,
      [toMedicalId, chatId]
    );

    if (result.rowCount === 0) {
      throwGraphQLError(res).message("Failed to transfer ticket").status(500).throw();
    }

    const updatedChat = await formatChatRecord(result.rows[0]);

    // Notify the entire chat room about the transfer
    emitToRoom(`healthchat:${chatId}`, 'healthchat:ticket-transferred', {
      chatId,
      patientId: updatedChat.patientId,
      fromMedicalId,
      toMedicalId,
      chat: updatedChat
    });

    // Staff list update: remove from previous assignee, add to new assignee.
    await emitHealthChatStaffEventByPatient(updatedChat.patientId, 'healthchat:ticket-status-changed', {
      chatId: updatedChat.id,
      patientId: updatedChat.patientId,
      status: 'Ongoing',
      medicalId: toMedicalId,
      transferredBy: user.id,
    });

    // Directly notify the previous assignee so they can immediately drop the thread.
    if (fromMedicalId && Number(fromMedicalId) !== Number(toMedicalId)) {
      notifyUser(String(fromMedicalId), 'healthchat:ticket-transferred', {
        chatId,
        patientId: updatedChat.patientId,
        fromMedicalId,
        toMedicalId,
        chat: updatedChat,
      }).catch(err => logger.error(`[HEALTHCHAT] notifyUser failed: ${err.message}`));
    }

    // Also notify the patient if they're offline
    if (updatedChat.patientId) {
      notifyUser(String(updatedChat.patientId), 'healthchat:ticket-transferred', {
        chatId,
        patientId: updatedChat.patientId,
        fromMedicalId,
        toMedicalId,
        chat: updatedChat
      }).catch(err => logger.error(`[HEALTHCHAT] notifyUser failed: ${err.message}`));
    }

    return {
      success: true,
      chat: updatedChat,
      message: "Ticket transferred successfully."
    };
  },

  _takeoverOngoingTicket: async (_, { chatId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    // Verify the chat exists and is ongoing
    const chatResult = await db.query(
      `SELECT * FROM "HealthChat" WHERE id = $1 AND status = 'Ongoing'`,
      [chatId]
    );

    if (chatResult.rowCount === 0) {
      throwGraphQLError(res).message("Active chat session not found").status(404).throw();
    }

    const chat = chatResult.rows[0];
    const previousMedicalId = chat.medicalId;

    // Update the medicalId to the current user
    const result = await db.query(
      `UPDATE "HealthChat"
       SET "medicalId" = $1
       WHERE id = $2 AND status = 'Ongoing'
       RETURNING *`,
      [user.id, chatId]
    );

    if (result.rowCount === 0) {
      throwGraphQLError(res).message("Failed to take over ticket").status(500).throw();
    }

    const updatedChat = await formatChatRecord(result.rows[0]);

    // Notify the entire chat room about the takeover
    emitToRoom(`healthchat:${chatId}`, 'healthchat:ticket-taken-over', {
      chatId,
      patientId: updatedChat.patientId,
      fromMedicalId: previousMedicalId,
      toMedicalId: user.id,
      chat: updatedChat
    });

    // Update conversation visibility for all eligible staff in real-time.
    await emitHealthChatStaffEventByPatient(updatedChat.patientId, 'healthchat:ticket-status-changed', {
      chatId: updatedChat.id,
      patientId: updatedChat.patientId,
      status: 'Ongoing',
      medicalId: user.id,
      takenOverBy: user.id,
    });

    // Notify previous assignee so their active thread disappears immediately.
    if (previousMedicalId && Number(previousMedicalId) !== Number(user.id)) {
      notifyUser(String(previousMedicalId), 'healthchat:ticket-taken-over', {
        chatId,
        patientId: updatedChat.patientId,
        fromMedicalId: previousMedicalId,
        toMedicalId: user.id,
        chat: updatedChat,
      }).catch(err => logger.error(`[HEALTHCHAT] notifyUser failed: ${err.message}`));
    }

    // Also notify the patient if they're offline
    if (updatedChat.patientId) {
      notifyUser(String(updatedChat.patientId), 'healthchat:ticket-taken-over', {
        chatId,
        patientId: updatedChat.patientId,
        fromMedicalId: previousMedicalId,
        toMedicalId: user.id,
        chat: updatedChat
      }).catch(err => logger.error(`[HEALTHCHAT] notifyUser failed: ${err.message}`));
    }

    return {
      success: true,
      chat: updatedChat,
      message: "You have taken over this ticket."
    };
  },

  /**
   * Extend the session by resetting the inactivity timer.
   * Inserts a system message which becomes the new "last activity" anchor.
   * Available to both patient (owns the chat) and medical staff (assigned to chat).
   * Guards: session must be Ongoing AND expiring within 48 hours.
   */
  _extendSession: async (_, { chatId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const chatResult = await db.query(
      `SELECT * FROM "HealthChat" WHERE id = $1 AND status = 'Ongoing'`,
      [chatId]
    );

    if (chatResult.rowCount === 0) {
      throwGraphQLError(res).message("Active chat session not found").status(404).throw();
    }

    const chat = chatResult.rows[0];

    // Authorization: must be the patient or the assigned medical staff
    const isPatient = Number(chat.patientId) === Number(user.id);
    const isMedical = Number(chat.medicalId) === Number(user.id);
    if (!isPatient && !isMedical) {
      throwGraphQLError(res).message("Not authorized to extend this session").status(403).throw();
    }

    // Get last message time for inactivity-based expiry calculation
    const lastMsgResult = await db.query(
      `SELECT MAX(stamp) AS last_stamp FROM "HealthChatPrompt" WHERE "consultationVirtualId" = $1`,
      [chatId]
    );
    const lastActivityAt = lastMsgResult.rows[0]?.last_stamp || chat.session_start;
    const expiryDate = calculateExpiryDate(lastActivityAt);

    // Guard: only allow extension when session is within 48 hours of expiry
    const msUntilExpiry = new Date(expiryDate) - new Date();
    if (msUntilExpiry > 48 * 60 * 60 * 1000) {
      throwGraphQLError(res)
        .message("Session is not close enough to expiry to be extended yet (must be within 48 hours).")
        .status(400).throw();
    }
    if (msUntilExpiry <= 0) {
      throwGraphQLError(res).message("Session has already expired").status(400).throw();
    }

    // Insert a system message — this resets the inactivity timer since
    // expiry is now based on the most recent message timestamp.
    const extenderUserType = isPatient ? 'Patient' : 'Medical';
    await db.query(
      `INSERT INTO "HealthChatPrompt"
       ("consultationVirtualId", "text", "promptType", "userId", "userType")
       VALUES ($1, 'Chat session extended. Inactivity timer has been reset.', 'system', $2, $3)`,
      [chatId, user.id, extenderUserType]
    );

    const updatedChat = await formatChatRecord(chat);

    // Notify the entire chat room (real-time update for both sides)
    emitToRoom(`healthchat:${chatId}`, 'healthchat:session-extended', {
      chatId,
      expiresAt: updatedChat.expiresAt,
      extendedBy: isPatient ? 'Patient' : 'Medical',
      chat: updatedChat
    });

    // Also push to offline party
    if (isPatient && updatedChat.medicalId) {
      notifyUser(String(updatedChat.medicalId), 'healthchat:session-extended', {
        chatId,
        expiresAt: updatedChat.expiresAt,
        extendedBy: 'Patient',
        chat: updatedChat
      }).catch(err => logger.error(`[HEALTHCHAT] notifyUser failed: ${err.message}`));
    } else if (!isPatient && updatedChat.patientId) {
      notifyUser(String(updatedChat.patientId), 'healthchat:session-extended', {
        chatId,
        expiresAt: updatedChat.expiresAt,
        extendedBy: 'Medical',
        chat: updatedChat
      }).catch(err => logger.error(`[HEALTHCHAT] notifyUser failed: ${err.message}`));
    }

    return {
      success: true,
      chat: updatedChat,
      message: "Session extended. Inactivity timer has been reset."
    };
  },

  /**
   * Expire old tickets (self-sufficient, no background process required)
   * Can be called by admin or automated job
   */
  _expireOldTickets: async (_, __, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Use the self-sufficient autoExpireTickets helper
    const count = await autoExpireTickets();

    return count;
  }
};

module.exports = { Query, Mutation };
