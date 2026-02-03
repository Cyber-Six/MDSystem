/**
 * Conversation Service
 * Manages chat sessions, history, and context
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../../config/db');
const logger = require('../../utils/logger');
const safetyRules = require('../config/safety-rules');

class ConversationService {
  /**
   * Create a new conversation session
   * @param {number} patientId - Patient ID (optional for anonymous users)
   * @returns {Object} Session data
   */
  async createSession(patientId = null) {
    try {
      const sessionId = uuidv4();
      
      const query = `
        INSERT INTO ai_conversations (session_id, patient_id, status, created_at, updated_at)
        VALUES ($1, $2, 'ai-active', NOW(), NOW())
        RETURNING *
      `;

      const result = await db.query(query, [sessionId, patientId]);
      const session = result.rows[0];

      logger.info('New conversation session created', {
        sessionId,
        patientId,
        conversationId: session.id
      });

      // Add initial greeting message
      await this.addMessage(session.id, 'assistant', 
        'Hello! I\'m your AI medical assistant. How can I help you today?\n\n' +
        'You can ask me about:\n' +
        '• General health questions\n' +
        '• Symptom information\n' +
        '• Medication queries\n' +
        '• Wellness tips\n\n' +
        '⚠️ **Important**: I provide general health information only. I am not a substitute for professional medical advice.',
        { isGreeting: true }
      );

      return {
        sessionId,
        conversationId: session.id,
        status: session.status,
        createdAt: session.created_at,
      };

    } catch (error) {
      logger.error('Failed to create conversation session', { error: error.message });
      throw error;
    }
  }

  /**
   * Get conversation by session ID
   */
  async getConversation(sessionId) {
    try {
      const query = 'SELECT * FROM ai_conversations WHERE session_id = $1';
      const result = await db.query(query, [sessionId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get conversation', { error: error.message, sessionId });
      throw error;
    }
  }

  /**
   * Get conversation history
   * @param {string} sessionId - Session ID
   * @param {number} limit - Number of recent messages to retrieve
   */
  async getHistory(sessionId, limit = 50) {
    try {
      const conversation = await this.getConversation(sessionId);
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const query = `
        SELECT id, role, content, metadata, created_at
        FROM ai_messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC
        LIMIT $2
      `;

      const result = await db.query(query, [conversation.id, limit]);

      return result.rows.map(row => ({
        id: row.id,
        role: row.role,
        content: row.content,
        metadata: row.metadata,
        timestamp: row.created_at,
      }));

    } catch (error) {
      logger.error('Failed to get conversation history', { error: error.message, sessionId });
      throw error;
    }
  }

  /**
   * Add message to conversation
   */
  async addMessage(conversationId, role, content, metadata = {}) {
    try {
      const query = `
        INSERT INTO ai_messages (conversation_id, role, content, metadata, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;

      const result = await db.query(query, [
        conversationId,
        role,
        content,
        JSON.stringify(metadata)
      ]);

      // Update conversation timestamp
      await db.query(
        'UPDATE ai_conversations SET updated_at = NOW() WHERE id = $1',
        [conversationId]
      );

      return result.rows[0];

    } catch (error) {
      logger.error('Failed to add message', { error: error.message, conversationId });
      throw error;
    }
  }

  /**
   * Get recent messages for context (limited for model context window)
   */
  async getContextMessages(sessionId, maxMessages = 10) {
    try {
      const conversation = await this.getConversation(sessionId);
      
      if (!conversation) {
        return [];
      }

      const query = `
        SELECT role, content, created_at
        FROM ai_messages
        WHERE conversation_id = $1
          AND metadata->>'isGreeting' IS NULL
        ORDER BY created_at DESC
        LIMIT $2
      `;

      const result = await db.query(query, [conversation.id, maxMessages]);

      // Reverse to get chronological order
      return result.rows.reverse().map(row => ({
        role: row.role,
        content: row.content,
      }));

    } catch (error) {
      logger.error('Failed to get context messages', { error: error.message, sessionId });
      throw error;
    }
  }

  /**
   * Update conversation status
   */
  async updateStatus(sessionId, status, staffId = null) {
    try {
      const query = `
        UPDATE ai_conversations
        SET status = $1, staff_id = $2, updated_at = NOW()
        WHERE session_id = $3
        RETURNING *
      `;

      const result = await db.query(query, [status, staffId, sessionId]);

      logger.info('Conversation status updated', { sessionId, status, staffId });

      return result.rows[0];

    } catch (error) {
      logger.error('Failed to update conversation status', { error: error.message, sessionId });
      throw error;
    }
  }

  /**
   * Close conversation
   */
  async closeConversation(sessionId) {
    try {
      const query = `
        UPDATE ai_conversations
        SET status = 'closed', closed_at = NOW(), updated_at = NOW()
        WHERE session_id = $1
        RETURNING *
      `;

      const result = await db.query(query, [sessionId]);

      logger.info('Conversation closed', { sessionId });

      return result.rows[0];

    } catch (error) {
      logger.error('Failed to close conversation', { error: error.message, sessionId });
      throw error;
    }
  }

  /**
   * Check if conversation has exceeded limits
   */
  async checkLimits(sessionId) {
    try {
      const conversation = await this.getConversation(sessionId);
      
      if (!conversation) {
        return { exceeded: true, reason: 'Conversation not found' };
      }

      // Check message count
      const countQuery = `
        SELECT COUNT(*) as message_count
        FROM ai_messages
        WHERE conversation_id = $1
      `;
      const countResult = await db.query(countQuery, [conversation.id]);
      const messageCount = parseInt(countResult.rows[0].message_count);

      if (messageCount >= safetyRules.conversationLimits.maxMessagesPerSession) {
        return { exceeded: true, reason: 'Maximum messages reached' };
      }

      // Check session duration
      const createdAt = new Date(conversation.created_at);
      const now = new Date();
      const hoursDiff = (now - createdAt) / (1000 * 60 * 60);

      if (hoursDiff >= safetyRules.conversationLimits.maxSessionDurationHours) {
        return { exceeded: true, reason: 'Maximum session duration reached' };
      }

      return { exceeded: false, messageCount, hoursDiff };

    } catch (error) {
      logger.error('Failed to check conversation limits', { error: error.message, sessionId });
      throw error;
    }
  }

  /**
   * Get all active conversations (for staff dashboard)
   */
  async getActiveConversations() {
    try {
      const query = `
        SELECT 
          c.*,
          COUNT(m.id) as message_count,
          MAX(m.created_at) as last_message_at
        FROM ai_conversations c
        LEFT JOIN ai_messages m ON c.id = m.conversation_id
        WHERE c.status IN ('ai-active', 'staff-taken')
        GROUP BY c.id
        ORDER BY MAX(m.created_at) DESC
      `;

      const result = await db.query(query);

      return result.rows;

    } catch (error) {
      logger.error('Failed to get active conversations', { error: error.message });
      throw error;
    }
  }
}

module.exports = new ConversationService();
