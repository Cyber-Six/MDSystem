/**
 * Handoff Controller
 * Manages staff takeover of AI chat sessions
 */

const conversationService = require('../services/conversation-service');
const db = require('../../config/db');
const logger = require('../../utils/logger');

class HandoffController {
  /**
   * Get all active conversations waiting for or with staff
   */
  async getActiveChats(req, res) {
    try {
      const conversations = await conversationService.getActiveConversations();

      // Enrich with handoff request info
      const enriched = await Promise.all(
        conversations.map(async (conv) => {
          const handoffQuery = `
            SELECT * FROM ai_handoff_requests
            WHERE conversation_id = $1 AND status = 'pending'
            ORDER BY created_at DESC
            LIMIT 1
          `;
          const handoffResult = await db.query(handoffQuery, [conv.id]);

          return {
            ...conv,
            handoffRequest: handoffResult.rows[0] || null,
          };
        })
      );

      return res.json({
        success: true,
        conversations: enriched,
        count: enriched.length,
      });

    } catch (error) {
      logger.error('Failed to get active chats', { error: error.message });

      return res.status(500).json({
        error: 'FETCH_FAILED',
        message: 'Failed to retrieve active chats',
      });
    }
  }

  /**
   * Staff takes over a conversation
   */
  async takeoverChat(req, res) {
    const { sessionId } = req.body;
    const staffId = req.user?.id; // From JWT authentication

    if (!staffId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Staff authentication required',
      });
    }

    try {
      const conversation = await conversationService.getConversation(sessionId);

      if (!conversation) {
        return res.status(404).json({
          error: 'SESSION_NOT_FOUND',
          message: 'Chat session not found',
        });
      }

      // Update conversation status
      await conversationService.updateStatus(sessionId, 'staff-taken', staffId);

      // Update any pending handoff requests
      await db.query(
        `UPDATE ai_handoff_requests
         SET status = 'assigned', assigned_staff_id = $1, assigned_at = NOW()
         WHERE conversation_id = $2 AND status = 'pending'`,
        [staffId, conversation.id]
      );

      // Add system message
      await conversationService.addMessage(
        conversation.id,
        'system',
        `A staff member has joined the conversation.`,
        { staffId, action: 'takeover' }
      );

      logger.info('Staff took over conversation', { sessionId, staffId });

      // TODO: Send real-time notification to patient (WebSocket)

      return res.json({
        success: true,
        message: 'Successfully took over conversation',
        sessionId,
        conversationId: conversation.id,
      });

    } catch (error) {
      logger.error('Failed to takeover chat', {
        error: error.message,
        sessionId,
        staffId
      });

      return res.status(500).json({
        error: 'TAKEOVER_FAILED',
        message: 'Failed to take over conversation',
      });
    }
  }

  /**
   * Staff releases conversation back to AI
   */
  async releaseChat(req, res) {
    const { sessionId } = req.body;
    const staffId = req.user?.id;

    if (!staffId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Staff authentication required',
      });
    }

    try {
      const conversation = await conversationService.getConversation(sessionId);

      if (!conversation) {
        return res.status(404).json({
          error: 'SESSION_NOT_FOUND',
          message: 'Chat session not found',
        });
      }

      // Verify staff owns this conversation
      if (conversation.staff_id !== staffId) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'You are not assigned to this conversation',
        });
      }

      // Update conversation status
      await conversationService.updateStatus(sessionId, 'ai-active', null);

      // Resolve handoff requests
      await db.query(
        `UPDATE ai_handoff_requests
         SET status = 'resolved', resolved_at = NOW()
         WHERE conversation_id = $1 AND status = 'assigned'`,
        [conversation.id]
      );

      // Add system message
      await conversationService.addMessage(
        conversation.id,
        'system',
        `The conversation has been returned to AI assistance.`,
        { staffId, action: 'release' }
      );

      logger.info('Staff released conversation', { sessionId, staffId });

      return res.json({
        success: true,
        message: 'Conversation released back to AI',
        sessionId,
      });

    } catch (error) {
      logger.error('Failed to release chat', {
        error: error.message,
        sessionId,
        staffId
      });

      return res.status(500).json({
        error: 'RELEASE_FAILED',
        message: 'Failed to release conversation',
      });
    }
  }

  /**
   * Staff sends message in taken-over conversation
   */
  async sendStaffMessage(req, res) {
    const { sessionId, message } = req.body;
    const staffId = req.user?.id;

    if (!staffId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Staff authentication required',
      });
    }

    try {
      const conversation = await conversationService.getConversation(sessionId);

      if (!conversation) {
        return res.status(404).json({
          error: 'SESSION_NOT_FOUND',
          message: 'Chat session not found',
        });
      }

      // Verify staff owns this conversation
      if (conversation.staff_id !== staffId || conversation.status !== 'staff-taken') {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'You must take over the conversation first',
        });
      }

      // Add staff message
      const savedMessage = await conversationService.addMessage(
        conversation.id,
        'staff',
        message,
        { staffId }
      );

      logger.info('Staff sent message', { sessionId, staffId });

      // TODO: Send real-time notification to patient (WebSocket)

      return res.json({
        success: true,
        message: savedMessage,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Failed to send staff message', {
        error: error.message,
        sessionId,
        staffId
      });

      return res.status(500).json({
        error: 'SEND_FAILED',
        message: 'Failed to send message',
      });
    }
  }

  /**
   * Get full transcript for a conversation
   */
  async getTranscript(req, res) {
    const { sessionId } = req.params;
    const staffId = req.user?.id;

    if (!staffId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Staff authentication required',
      });
    }

    try {
      const history = await conversationService.getHistory(sessionId, 1000);

      return res.json({
        success: true,
        sessionId,
        transcript: history,
        messageCount: history.length,
      });

    } catch (error) {
      logger.error('Failed to get transcript', {
        error: error.message,
        sessionId,
        staffId
      });

      return res.status(500).json({
        error: 'TRANSCRIPT_FETCH_FAILED',
        message: 'Failed to retrieve transcript',
      });
    }
  }

  /**
   * Get pending handoff requests
   */
  async getPendingHandoffs(req, res) {
    try {
      const query = `
        SELECT 
          hr.*,
          c.session_id,
          c.patient_id,
          c.created_at as conversation_started,
          (SELECT COUNT(*) FROM ai_messages WHERE conversation_id = c.id) as message_count
        FROM ai_handoff_requests hr
        JOIN ai_conversations c ON hr.conversation_id = c.id
        WHERE hr.status = 'pending'
        ORDER BY 
          CASE hr.priority
            WHEN 'emergency' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
          END,
          hr.created_at ASC
      `;

      const result = await db.query(query);

      return res.json({
        success: true,
        handoffs: result.rows,
        count: result.rows.length,
      });

    } catch (error) {
      logger.error('Failed to get pending handoffs', { error: error.message });

      return res.status(500).json({
        error: 'FETCH_FAILED',
        message: 'Failed to retrieve pending handoffs',
      });
    }
  }
}

module.exports = new HandoffController();
