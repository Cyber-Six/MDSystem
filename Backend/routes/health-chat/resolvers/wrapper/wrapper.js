const db = require("../../../../config/query.js");
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
  formatMessage,
  hasActiveTicket,
  getParticipantInfo,
  CHAT_EXPIRY_DAYS
} = require("./helper.js");

const Query = {
  // ==================== PATIENT QUERIES ====================

  /**
   * Get patient's tickets with optional status filter
   */
  _getMyTickets: async (_, { status, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

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

    const chats = await Promise.all(result.rows.map(formatChatRecord));

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
  _getPendingTickets: async (_, { offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const result = await db.query(
      `SELECT * FROM "HealthChat"
       WHERE status = 'Open'
       ORDER BY id ASC
       LIMIT $1 OFFSET $2`,
      [limit || 10, offset || 0]
    );

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM "HealthChat" WHERE status = 'Open'`
    );

    const chats = await Promise.all(result.rows.map(formatChatRecord));

    return {
      chats,
      total: countResult.rows[0]?.total || 0
    };
  },

  /**
   * Get active (ongoing) tickets assigned to any medical staff
   */
  _getActiveTickets: async (_, { offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    const result = await db.query(
      `SELECT * FROM "HealthChat"
       WHERE status = 'Ongoing'
       ORDER BY session_start DESC
       LIMIT $1 OFFSET $2`,
      [limit || 10, offset || 0]
    );

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM "HealthChat" WHERE status = 'Ongoing'`
    );

    const chats = await Promise.all(result.rows.map(formatChatRecord));

    return {
      chats,
      total: countResult.rows[0]?.total || 0
    };
  },

  /**
   * Get all tickets with optional status filter
   */
  _getAllTickets: async (_, { status, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    let query = `SELECT * FROM "HealthChat"`;
    const params = [];

    if (status) {
      query += ` WHERE status = $1`;
      params.push(status);
    }

    query += ` ORDER BY id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit || 10, offset || 0);

    const result = await db.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*)::int AS total FROM "HealthChat"`;
    const countParams = [];
    if (status) {
      countQuery += ` WHERE status = $1`;
      countParams.push(status);
    }
    const countResult = await db.query(countQuery, countParams);

    const chats = await Promise.all(result.rows.map(formatChatRecord));

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

    const result = await db.query(
      `SELECT * FROM "HealthChatPrompt"
       WHERE "consultationVirtualId" = $1
       ORDER BY stamp ASC
       LIMIT $2 OFFSET $3`,
      [chatId, limit || 50, offset || 0]
    );

    return await Promise.all(result.rows.map(formatMessage));
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

    // Verify patient owns this chat
    const owns = await verifyPatientOwnsChat(chatId, user.id);
    if (!owns) {
      throwGraphQLError(res).message("Chat not found").status(404).throw();
    }

    // Check chat status
    const { isActive, status } = await checkChatStatus(chatId);
    if (!isActive) {
      throwGraphQLError(res)
        .message(`Cannot send message. Chat is ${status || 'not active'}.`)
        .status(400)
        .throw();
    }

    // Promote file if uploading
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
       SET status = 'Closed', session_end = NOW()
       WHERE id = $1 AND "patientId" = $2
       RETURNING *`,
      [chatId, user.id]
    );

    if (result.rowCount === 0) {
      throwGraphQLError(res).message("Failed to close ticket").status(500).throw();
    }

    // Add system message
    await db.query(
      `INSERT INTO "HealthChatPrompt"
       ("consultationVirtualId", "text", "promptType", "userId", "userType")
       VALUES ($1, 'Patient closed this conversation.', 'system', $2, 'Patient')`,
      [chatId, user.id]
    );

    const chat = await formatChatRecord(result.rows[0]);

    // Emit to chat room about ticket closure
    emitToRoom(`healthchat:${chatId}`, 'healthchat:ticket-closed', {
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
      throwGraphQLError(res).message("Failed to approve ticket").status(500).throw();
    }

    // Add system message
    await db.query(
      `INSERT INTO "HealthChatPrompt"
       ("consultationVirtualId", "text", "promptType", "userId", "userType")
       VALUES ($1, 'Staff has approved this consultation. Chat session started. Session expires in ${CHAT_EXPIRY_DAYS} days.', 'system', $2, 'Medical')`,
      [chatId, user.id]
    );

    const chat = await formatChatRecord(result.rows[0]);

    // Notify patient about ticket approval
    if (chat.patientId) {
      notifyUser(chat.patientId, 'healthchat:ticket-approved', { chat });
    }

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
           notes = $2
       WHERE id = $3
       RETURNING *`,
      [user.id, reason || 'Ticket rejected by staff.', chatId]
    );

    if (result.rowCount === 0) {
      throwGraphQLError(res).message("Failed to reject ticket").status(500).throw();
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
      });
    }

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

    // Check chat status
    const { isActive, status } = await checkChatStatus(chatId);
    if (!isActive) {
      throwGraphQLError(res)
        .message(`Cannot send message. Chat is ${status || 'not active'}.`)
        .status(400)
        .throw();
    }

    // Promote file if uploading
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

    const result = await db.query(
      `UPDATE "HealthChat"
       SET status = 'Closed',
           session_end = NOW(),
           notes = COALESCE($1, notes)
       WHERE id = $2
       RETURNING *`,
      [notes, chatId]
    );

    if (result.rowCount === 0) {
      throwGraphQLError(res).message("Ticket not found").status(404).throw();
    }

    // Add system message
    await db.query(
      `INSERT INTO "HealthChatPrompt"
       ("consultationVirtualId", "text", "promptType", "userId", "userType")
       VALUES ($1, 'Staff has closed this conversation.', 'system', $2, 'Medical')`,
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
      });
    }

    return {
      success: true,
      chat,
      message: "Ticket closed successfully."
    };
  },

  /**
   * Expire old tickets (to be called by cron job or admin)
   */
  _expireOldTickets: async (_, __, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    // Update all ongoing chats that have expired
    const result = await db.query(
      `UPDATE "HealthChat"
       SET status = 'Expired', session_end = NOW()
       WHERE status = 'Ongoing'
       AND session_start IS NOT NULL
       AND session_start + INTERVAL '${CHAT_EXPIRY_DAYS} days' < NOW()
       RETURNING id`
    );

    // Add system message to each expired chat
    for (const row of result.rows) {
      await db.query(
        `INSERT INTO "HealthChatPrompt"
         ("consultationVirtualId", "text", "promptType", "userId", "userType")
         VALUES ($1, 'This conversation has expired after ${CHAT_EXPIRY_DAYS} days.', 'system', $2, 'Medical')`,
        [row.id, user.id]
      );
    }

    return result.rowCount;
  }
};

module.exports = { Query, Mutation };
