const db = require("../../../../config/query.js");
const pool = db.db(); // Get the pool for transactions
const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const { promoteFile } = require("../../../../config/multer.js");
const { emitToRoom, emitToRole, notifyUser } = require("../../../../config/sockets");
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

const { isMedicalAdmin } = require("../../../../services/permit.js");

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

    return await Promise.all(result.rows.map(formatMessage));
  },

  // ==================== MEDICAL QUERIES ====================

  /**
   * Get pending tickets awaiting approval
   */
  _getPendingTickets: async (_, { location, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Auto-expire any expired ongoing tickets
    await autoExpireTickets();

    const { rows } = await db.query(
      `SELECT hc.*, COUNT(*) OVER()::int AS total
       FROM "HealthChat" hc
       JOIN "UsersPersonal" up ON up.id = hc."patientId"
       WHERE hc.status = 'Open' AND (
        up.branch = 'Both'::"UserDesignation" OR
        $3::"UserDesignation" = 'Both'::"UserDesignation" OR
        up.branch = $3::"UserDesignation"
       )
       ORDER BY id ASC
       LIMIT $1 OFFSET $2`,
      [limit || 10, offset || 0, location]
    );

    const chats = await formatChatRecordsBatch(rows);

    return {
      chats,
      total: rows.length ? rows[0].total : 0
    };
  },

  /**
   * Get active (ongoing) tickets assigned to any medical staff
   */
  _getActiveTickets: async (_, { location, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Auto-expire any expired ongoing tickets (critical for this query)
    await autoExpireTickets();

    const { rows } = await db.query(
      `SELECT hc.*, COUNT(*) OVER()::int AS total
       FROM "HealthChat" hc
       JOIN "UsersPersonal" up ON up.id = hc."patientId"
       WHERE hc.status = 'Ongoing' AND (
         up.branch = 'Both'::"UserDesignation" OR
         $3::"UserDesignation" = 'Both'::"UserDesignation" OR
         up.branch = $3::"UserDesignation"
       )
       ORDER BY hc.session_start DESC
       LIMIT $1 OFFSET $2`,
      [limit || 10, offset || 0, location]
    );

    const chats = await formatChatRecordsBatch(rows);

    return {
      chats,
      total: rows.length ? rows[0].total : 0
    };
  },

  /**
   * Get all tickets with optional status filter
   */
  _getAllTickets: async (_, { location, status, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Auto-expire any expired ongoing tickets
    await autoExpireTickets();

    const params = [limit || 10, offset || 0, location];
    let statusFilter = '';
    if (status) {
      params.push(status);
      statusFilter = `AND hc.status = $${params.length}`;
    }

    const { rows } = await db.query(
      `SELECT hc.*, COUNT(*) OVER()::int AS total
       FROM "HealthChat" hc
       JOIN "UsersPersonal" up ON up.id = hc."patientId"
       WHERE (up.branch = 'Both'::"UserDesignation" OR $3::"UserDesignation" = 'Both'::"UserDesignation" OR up.branch = $3::"UserDesignation")
       ${statusFilter}
       ORDER BY hc.id DESC
       LIMIT $1 OFFSET $2`,
      params
    );

    const chats = await formatChatRecordsBatch(rows);

    return {
      chats,
      total: rows.length ? rows[0].total : 0
    };
  },

  /**
   * Get a specific ticket (medical view - can see any)
   */
  _getTicket: async (_, { chatId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Auto-expire any expired ongoing tickets
    await autoExpireTickets();

    const result = await db.query(
      `SELECT * FROM "HealthChat" WHERE id = $1`,
      [chatId]
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

    // Fetch medicalId in one step
    const { rows, rowCount } = await db.query(
      `SELECT "medicalId" FROM "HealthChat" WHERE id = $1`,
      [chatId]
    );

    if (rowCount === 0) {
      throwGraphQLError(res).message("Ticket not found").status(404).throw();
    }

    const medicalId = rows[0].medicalId;

    // Ownership / admin check
    if (medicalId && Number(medicalId) !== Number(user.id)) {
      const isAdmin = await isMedicalAdmin(user.id); // ensure async if it hits DB
      if (!isAdmin) {
        throwGraphQLError(res)
          .message("FORBIDDEN. Ongoing process by other staff.")
          .status(403)
          .throw();
      }
    }

    // Fetch chat prompts
    const result = await db.query(
      `SELECT * 
       FROM "HealthChatPrompt"
       WHERE "consultationVirtualId" = $1
       ORDER BY stamp ASC
       LIMIT $2 OFFSET $3`,
      [chatId, limit || 50, offset || 0]
    );

    // Format messages concurrently
    return Promise.all(result.rows.map(formatMessage));
  },

  /**
   * Get conversations grouped by patient (1 row per patient)
   * Returns patients with their latest ticket and last message info
   */
  _getPatientConversations: async (_, { location, statuses, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Auto-expire any expired ongoing tickets
    await autoExpireTickets();

    // Determine if the current user is an admin (admins see all conversations)
    const isAdmin = await isMedicalAdmin(user.id);

    // Build status filter
    let statusFilter = '';
    let locationFilter = '';
    let medicalFilter = '';
    const params = [];
    if (statuses && statuses.length > 0) {
        statusFilter = `WHERE status = ANY($1)`;
      params.push(statuses);
    }

    // Build location filter - matches pattern from _getPendingTickets, _getActiveTickets
    if (location) {
      const locationParamIndex = params.length + 1;
      const locationCondition = `(up.branch = 'Both'::"UserDesignation" OR $${locationParamIndex}::"UserDesignation" = 'Both'::"UserDesignation" OR up.branch = $${locationParamIndex}::"UserDesignation")`;
      if (statusFilter) {
        locationFilter = `AND ${locationCondition}`;
      } else {
        locationFilter = `WHERE ${locationCondition}`;
      }
      params.push(location);
    }

    // Non-admin staff: only see their assigned tickets + pending (Open) tickets
    if (!isAdmin) {
      const medicalParamIndex = params.length + 1;
      const medicalCondition = `(hc."medicalId" = $${medicalParamIndex} OR hc.status = 'Open')`;
      if (statusFilter || locationFilter) {
        medicalFilter = `AND ${medicalCondition}`;
      } else {
        medicalFilter = `WHERE ${medicalCondition}`;
      }
      params.push(user.id);
    }

    // Get unique patients with their latest ticket
    // Use ROW_NUMBER to get one row per patient, ordered by priority (Ongoing > Open > others)
    const query = `
      WITH RankedTickets AS (
        SELECT
          hc.*,
          ROW_NUMBER() OVER (
            PARTITION BY hc."patientId"
            ORDER BY
              CASE
                WHEN hc.status = 'Ongoing' THEN 0
                WHEN hc.status = 'Open' THEN 1
                ELSE 2
              END,
              COALESCE(hc.session_start, NOW()) DESC,
              hc.id DESC
          ) as rn
        FROM "HealthChat" hc
        JOIN "UsersPersonal" up ON up.id = hc."patientId"
        ${statusFilter}
        ${locationFilter}
        ${medicalFilter}
      ),
      LatestTickets AS (
        SELECT * FROM RankedTickets WHERE rn = 1
      ),
      TicketCounts AS (
        SELECT
          "patientId",
          COUNT(*) FILTER (WHERE status IN ('Open', 'Ongoing')) as active_count,
          COUNT(*) as total_count
        FROM "HealthChat" hc
        JOIN "UsersPersonal" up ON up.id = hc."patientId"
        ${statusFilter}
        ${locationFilter}
        ${medicalFilter}
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

    params.push(limit || 50, offset || 0);

    try {
      const result = await db.query(query, params);

      // Get count of unique patients
      const countQuery = `
        SELECT COUNT(DISTINCT hc."patientId")::int as total
        FROM "HealthChat" hc
        JOIN "UsersPersonal" up ON up.id = hc."patientId"
        ${statusFilter}
        ${locationFilter}
        ${medicalFilter}
      `;
      const countParams = [];
      if (statuses && statuses.length > 0) {
        countParams.push(statuses);
      }
      if (location) {
        countParams.push(location);
      }
      if (!isAdmin) {
        countParams.push(user.id);
      }
      const countResult = await db.query(countQuery, countParams);

      // Format conversations using batch lookups to avoid N+1 queries
      // 1. Batch-format the latest tickets from the main query
      const latestTickets = await formatChatRecordsBatch(result.rows);

      // 2. Fetch ALL tickets for each patient regardless of status filter.
      // This ensures the frontend has complete ticket history for dividers and
      // initial-context (purposeSynth) even when archive filter is off.
      const patientIds = result.rows.map(r => r.patientId);
      const allTicketsResult = await db.query(
        `SELECT * FROM "HealthChat"
         WHERE "patientId" = ANY($1)
         ORDER BY id DESC`,
        [patientIds]
      );
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

    // Effective page size
    const pageSize = limit || 50;

    let result;
    if (before) {
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
           WHERE hc."patientId" = $1 AND p.stamp < $2
            AND (
              hc."medicalId" = $3
              OR EXISTS (
                SELECT 1 FROM "rolesMap" rm
                JOIN "rolesTable" rt ON rm."rolesId" = rt.id
                WHERE rm."personnelId" = $3 AND rt.label = 'IS_ADMIN'
                LIMIT 1
              )
            )
           ORDER BY p.stamp DESC
           LIMIT $4
         ) sub
         ORDER BY stamp ASC`,
        [patientId, before, user.id, pageSize]
      );
    } else {
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
           WHERE hc."patientId" = $1
            AND (
              hc."medicalId" = $2
              OR EXISTS (
                SELECT 1 FROM "rolesMap" rm
                JOIN "rolesTable" rt ON rm."rolesId" = rt.id
                WHERE rm."personnelId" = $2 AND rt.label = 'IS_ADMIN'
                LIMIT 1
              )
            )
           ORDER BY p.stamp DESC
           LIMIT $3
         ) sub
         ORDER BY stamp ASC`,
        [patientId, user.id, pageSize]
      );
    }

    return await Promise.all(result.rows.map(async (row) => {
      const message = await formatMessage(row);
      // Include ticket info for divider rendering
      return {
        ...message,
        ticketPurpose: row.ticket_purpose,
        ticketStatus: row.ticket_status,
        ticketSessionEnd: row.ticket_session_end,
        ticketClosedBy: row.ticket_closed_by
      };
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

    // Notify all medical staff about new ticket
    emitToRole('medical', 'healthchat:ticket-created', { chat });

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

    // Verify patient owns this chat AND fetch medicalId in one query
    const chatCheck = await db.query(
      `SELECT "medicalId" FROM "HealthChat" WHERE id = $1 AND "patientId" = $2`,
      [chatId, user.id]
    );

    if (chatCheck.rowCount === 0) {
      throwGraphQLError(res).message("Chat not found").status(404).throw();
    }

    const medicalId = chatCheck.rows[0].medicalId;

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
    if (medicalId) {
      notifyUser(String(medicalId), 'healthchat:new-message', {
        chatId,
        message,
        senderType: 'Patient'
      });
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

    const client = await pool.connect();
    let chat;
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE "HealthChat"
         SET status = 'Closed',
             session_end = NOW(),
             closed_by_type = 'Patient'
         WHERE id = $1 AND "patientId" = $2
         RETURNING *`,
        [chatId, user.id]
      );

      if (result.rowCount === 0) {
        throw new Error("Cannot close this ticket. It may already be closed or expired.");
      }

      // Add system message
      await client.query(
        `INSERT INTO "HealthChatPrompt"
         ("consultationVirtualId", "text", "promptType", "userId", "userType")
         VALUES ($1, 'Patient closed this ticket.', 'system', $2, 'Patient')`,
        [chatId, user.id]
      );

      await client.query('COMMIT');
      chat = await formatChatRecord(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.message === "Cannot close this ticket. It may already be closed or expired.") {
        throwGraphQLError(res).message(error.message).status(400).throw();
      }
      throwGraphQLError(res).message("Failed to close ticket").status(500).throw();
    } finally {
      client.release();
    }

    // Emit to chat room about ticket closure
    emitToRoom(`healthchat:${chatId}`, 'healthchat:ticket-closed', {
      chatId,
      closedBy: 'Patient',
      chat
    });

    // Also notify all medical staff so their conversation list updates
    // (staff may not be in the chat room if viewing a different patient)
    emitToRole('medical', 'healthchat:ticket-closed', {
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

    const client = await pool.connect();
    let chat;
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE "HealthChat"
         SET status = 'Ongoing',
             "medicalId" = $1,
             session_start = NOW(),
             notes = COALESCE($2, notes),
             consent_logged = true
         WHERE id = $3
         RETURNING *`,
        [user.id, notes, chatId]
      );

      if (result.rowCount === 0) {
        throw new Error("Failed to approve ticket");
      }

      // Add system message
      await client.query(
        `INSERT INTO "HealthChatPrompt"
         ("consultationVirtualId", "text", "promptType", "userId", "userType")
         VALUES ($1, 'Staff has approved this consultation. Chat session started. Session expires in ${CHAT_EXPIRY_DAYS} days.', 'system', $2, 'Medical')`,
        [chatId, user.id]
      );

      await client.query('COMMIT');
      chat = await formatChatRecord(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throwGraphQLError(res).message("Failed to approve ticket").status(500).throw();
    } finally {
      client.release();
    }

    // Notify patient about ticket approval
    if (chat.patientId) {
      notifyUser(chat.patientId, 'healthchat:ticket-approved', { chat });
    }

    // Notify all medical staff about ticket status change (so other staff can update their UI)
    emitToRole('medical', 'healthchat:ticket-status-changed', {
      chatId: chat.id,
      patientId: chat.patientId,
      status: 'Ongoing',
      approvedBy: user.id
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

    const client = await pool.connect();
    let chat;
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE "HealthChat"
         SET status = 'Closed',
             "medicalId" = $1,
             notes = $2,
             session_end = NOW(),
           closed_by_type = 'Staff'
         WHERE id = $3
         RETURNING *`,
        [user.id, reason || 'Ticket rejected by staff.', chatId]
      );

      if (result.rowCount === 0) {
        throw new Error("Failed to reject ticket");
      }

      // Add system message
      await client.query(
        `INSERT INTO "HealthChatPrompt"
         ("consultationVirtualId", "text", "promptType", "userId", "userType")
         VALUES ($1, $2, 'system', $3, 'Medical')`,
        [chatId, `Ticket rejected. Reason: ${reason || 'Not specified'}`, user.id]
      );

      await client.query('COMMIT');
      chat = await formatChatRecord(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throwGraphQLError(res).message("Failed to reject ticket").status(500).throw();
    } finally {
      client.release();
    }

    // Notify patient about ticket rejection
    if (chat.patientId) {
      notifyUser(chat.patientId, 'healthchat:ticket-rejected', {
        chat,
        reason: reason || 'Not specified'
      });
    }

    // Notify all medical staff about ticket status change (so other staff can update their UI)
    emitToRole('medical', 'healthchat:ticket-status-changed', {
      chatId: chat.id,
      patientId: chat.patientId,
      status: 'Closed',
      rejectedBy: user.id,
      reason: reason || 'Not specified'
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

    // Verify the chat exists and get medicalId and patientId in one query
    const chatResult = await db.query(
      `SELECT "medicalId", "patientId" FROM "HealthChat" WHERE id = $1`,
      [chatId]
    );

    if (chatResult.rowCount === 0) {
      throwGraphQLError(res).message("Chat not found").status(404).throw();
    }

    const { medicalId, patientId } = chatResult.rows[0];

    if (medicalId && Number(medicalId) !== Number(user.id)) {
      throwGraphQLError(res).message("Unauthorized to send message in this chat").status(403).throw();
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
    if (patientId) {
      notifyUser(String(patientId), 'healthchat:new-message', {
        chatId,
        message,
        senderType: 'Medical'
      });
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

    const { chatId, notes } = input;

    const chatResult = await db.query(
      `SELECT "medicalId", "patientId" FROM "HealthChat" WHERE id = $1`,
      [chatId]
    );

    if (chatResult.rowCount === 0) {
      throwGraphQLError(res).message("Chat not found").status(404).throw();
    }
    
    const { medicalId, patientId } = chatResult.rows[0];
    if (medicalId && Number(medicalId) !== Number(user.id)) {
      throwGraphQLError(res).message("Unauthorized to close this ticket").status(403).throw();
    }

    const client = await pool.connect();
    let chat;
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE "HealthChat"
         SET status = 'Closed',
             session_end = NOW(),
             notes = COALESCE($1, notes),
             closed_by_type = 'Staff'
         WHERE id = $2
         RETURNING *`,
        [notes, chatId]
      );

      if (result.rowCount === 0) {
        throw new Error("Ticket not found");
      }

      // Add system message
      await client.query(
        `INSERT INTO "HealthChatPrompt"
         ("consultationVirtualId", "text", "promptType", "userId", "userType")
         VALUES ($1, 'Staff closed this ticket.', 'system', $2, 'Medical')`,
        [chatId, user.id]
      );

      await client.query('COMMIT');
      chat = await formatChatRecord(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.message === "Ticket not found") {
        throwGraphQLError(res).message("Ticket not found").status(404).throw();
      }
      throwGraphQLError(res).message("Failed to close ticket").status(500).throw();
    } finally {
      client.release();
    }

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
      });
    }

    return {
      success: true,
      chat,
      message: "Ticket closed successfully."
    };
  },

  /**
   * Delete an archived ticket (admin only)
   */
  _deleteArchivedTicket: async (_, { chatId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Verify ticket exists and is archived (Closed or Expired)
    const ticketCheck = await db.query(
      `SELECT status, "medicalId" FROM "HealthChat" WHERE id = $1`,
      [chatId]
    );

    if (ticketCheck.rowCount === 0) {
      throwGraphQLError(res).message("Ticket not found").status(404).throw();
    }

    const { status, medicalId } = ticketCheck.rows[0];
    if (!['Closed', 'Expired'].includes(status)) {
      throwGraphQLError(res).message("Only archived tickets (Closed or Expired) can be deleted").status(400).throw();
    }

    if (medicalId && Number(medicalId) !== Number(user.id)) {
      const isAdmin = await isMedicalAdmin(user.id);
      if (!isAdmin) {
        throwGraphQLError(res).message("Unauthorized to delete this ticket").status(403).throw();
      }
    } // MAKE SURE ONLY THE ASSIGNED STAFF OR ADMINS CAN DELETE

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete messages first (due to foreign key constraint)
      await client.query(
        `DELETE FROM "HealthChatPrompt" WHERE "consultationVirtualId" = $1`,
        [chatId]
      );

      // Delete the ticket
      await client.query(
        `DELETE FROM "HealthChat" WHERE id = $1`,
        [chatId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throwGraphQLError(res).message("Failed to delete ticket").status(500).throw();
    } finally {
      client.release();
    }

    return {
      success: true,
      chat: null,
      message: "Ticket deleted successfully."
    };
  },


  _transferTicket: async (_, { chatId, toMedicalId }, { user, res }) => {
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

    // Authorization: must be the currently assigned medical staff
    if (Number(chat.medicalId) !== Number(user.id)) {
      throwGraphQLError(res).message("Not authorized to transfer this ticket").status(403).throw();
    }

    // Verify new medical staff must be different from current
    if (Number(toMedicalId) === Number(user.id)) {
      throwGraphQLError(res).message("New medical staff must be different from current").status(400).throw();
    }

    // Verify new medical staff exists and is active
    const newStaffCheck = await db.query(
      `SELECT mp.id, mp.is_active
       FROM "MedicalPersonnel" mp
       JOIN "UserCredentials" uc ON uc.id = mp.id
       WHERE mp.id = $1`,
      [toMedicalId]
    );

    if (newStaffCheck.rowCount === 0) {
      throwGraphQLError(res).message("New medical staff not found").status(404).throw();
    }

    if (!newStaffCheck.rows[0].is_active) {
      throwGraphQLError(res).message("New medical staff is not active").status(400).throw();
    }

    const client = await pool.connect();
    let updatedChat;
    try {
      await client.query('BEGIN');

      // Perform the transfer
      const result = await client.query(
        `UPDATE "HealthChat"
         SET "medicalId" = $1
         WHERE id = $2
         RETURNING *`,
        [toMedicalId, chatId]
      );

      if (result.rowCount === 0) {
        throw new Error("Failed to transfer ticket");
      }

      // Add system message about transfer
      await client.query(
        `INSERT INTO "HealthChatPrompt"
         ("consultationVirtualId", "text", "promptType", "userId", "userType")
         VALUES ($1, $2, 'system', $3, 'Medical')`,
        [chatId, `Ticket transferred from staff ID ${user.id} to staff ID ${toMedicalId}.`, user.id]
      );

      await client.query('COMMIT');
      updatedChat = await formatChatRecord(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throwGraphQLError(res).message("Failed to transfer ticket").status(500).throw();
    } finally {
      client.release();
    }

    // Notify the patient about the transfer
    if (updatedChat.patientId) {
      notifyUser(updatedChat.patientId, 'healthchat:ticket-transferred', {
        chatId,
        newMedicalId: toMedicalId,
        chat: updatedChat
      });
    }

    // Notify the new medical staff about the transfer
    notifyUser(String(toMedicalId), 'healthchat:ticket-transferred', {
      chatId,
      newMedicalId: toMedicalId,
      chat: updatedChat
    });

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

    if (Number(chat.medicalId) === Number(user.id)) {
      throwGraphQLError(res).message("You are already assigned to this ticket").status(400).throw();
    }

    const client = await pool.connect();
    let updatedChat;
    try {
      await client.query('BEGIN');

      // Perform the takeover
      const result = await client.query(
        `UPDATE "HealthChat"
         SET "medicalId" = $1
         WHERE id = $2
         RETURNING *`,
        [user.id, chatId]
      );

      if (result.rowCount === 0) {
        throw new Error("Failed to takeover ticket");
      }

      // Add system message about takeover
      await client.query(
        `INSERT INTO "HealthChatPrompt"
         ("consultationVirtualId", "text", "promptType", "userId", "userType")
         VALUES ($1, $2, 'system', $3, 'Medical')`,
        [chatId, `Ticket taken over by staff ID ${user.id}.`, user.id]
      );

      await client.query('COMMIT');
      updatedChat = await formatChatRecord(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throwGraphQLError(res).message("Failed to takeover ticket").status(500).throw();
    } finally {
      client.release();
    }

    // Notify the patient about the takeover
    if (updatedChat.patientId) {
      notifyUser(updatedChat.patientId, 'healthchat:ticket-taken-over', {
        chatId,
        newMedicalId: user.id,
        chat: updatedChat
      });
    }

    return {
      success: true,
      chat: updatedChat,
      message: "Ticket taken over successfully."
    };
  },

  /**
   * Extend the session by 1 day
   * Available to both patient (owns the chat) and medical staff (assigned to chat)
   * Guards: session must be Ongoing AND expiring within 48 hours
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

    // Guard: only allow extension when session is within 48 hours of expiry
    const expiryDate = calculateExpiryDate(chat.session_start);
    const msUntilExpiry = new Date(expiryDate) - new Date();
    if (msUntilExpiry > 48 * 60 * 60 * 1000) {
      throwGraphQLError(res)
        .message("Session is not close enough to expiry to be extended yet (must be within 48 hours).")
        .status(400).throw();
    }
    if (msUntilExpiry <= 0) {
      throwGraphQLError(res).message("Session has already expired").status(400).throw();
    }

    const client = await pool.connect();
    let updatedChat;
    try {
      await client.query('BEGIN');

      // Push session_start forward by 1 day — expiresAt moves forward accordingly
      const result = await client.query(
        `UPDATE "HealthChat"
         SET session_start = session_start + INTERVAL '1 day'
         WHERE id = $1 AND status = 'Ongoing'
         RETURNING *`,
        [chatId]
      );

      if (result.rowCount === 0) {
        throw new Error("Failed to extend session");
      }

      const extenderUserType = isPatient ? 'Patient' : 'Medical';
      await client.query(
        `INSERT INTO "HealthChatPrompt"
         ("consultationVirtualId", "text", "promptType", "userId", "userType")
         VALUES ($1, 'Chat session extended by 1 day.', 'system', $2, $3)`,
        [chatId, user.id, extenderUserType]
      );

      await client.query('COMMIT');
      updatedChat = await formatChatRecord(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throwGraphQLError(res).message("Failed to extend session").status(500).throw();
    } finally {
      client.release();
    }

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
      });
    } else if (!isPatient && updatedChat.patientId) {
      notifyUser(String(updatedChat.patientId), 'healthchat:session-extended', {
        chatId,
        expiresAt: updatedChat.expiresAt,
        extendedBy: 'Medical',
        chat: updatedChat
      });
    }

    return {
      success: true,
      chat: updatedChat,
      message: "Session extended by 1 day."
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
