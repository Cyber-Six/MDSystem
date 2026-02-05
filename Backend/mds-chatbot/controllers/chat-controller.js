/**
 * Chat Controller
 * Handles chat requests and orchestrates AI responses with safety checks
 */

const llamaService = require('../services/llama-service');
const conversationService = require('../services/conversation-service');
const { detectEmergency, detectProhibitedTopic, validateResponse } = require('../middleware/emergency-detector');
const modelConfig = require('../config/model-config');
const logger = require('../../utils/logger');

// Check if safety mode is enabled
const isSafetyMode = modelConfig.safetyMode;

class ChatController {
  /**
   * Handle new message and generate AI response
   */
  async sendMessage(req, res) {
    const { sessionId, message } = req.body;

    try {
      // Get or validate conversation
      let conversation = await conversationService.getConversation(sessionId);

      if (!conversation) {
        return res.status(404).json({
          error: 'SESSION_NOT_FOUND',
          message: 'Chat session not found'
        });
      }

      // Check if conversation is still active (not taken by staff)
      if (conversation.status === 'staff-taken') {
        return res.status(403).json({
          error: 'SESSION_TAKEN_BY_STAFF',
          message: 'A staff member has taken over this conversation'
        });
      }

      // Check conversation limits
      const limitsCheck = await conversationService.checkLimits(sessionId);
      if (limitsCheck.exceeded) {
        return res.status(429).json({
          error: 'CONVERSATION_LIMIT_EXCEEDED',
          message: limitsCheck.reason
        });
      }

      // Save user message first
      await conversationService.addMessage(conversation.id, 'user', message, {});

      // FAST MODE: Skip all safety processing
      if (!isSafetyMode) {
        const contextMessages = await conversationService.getContextMessages(sessionId, 10);
        const aiResponse = await llamaService.generateResponse(contextMessages);

        await conversationService.addMessage(conversation.id, 'assistant', aiResponse.content, {
          tokens: aiResponse.tokens,
          duration: aiResponse.duration,
          fastMode: true,
        });

        return res.json({
          sessionId,
          message: aiResponse.content,
          role: 'assistant',
          metadata: { tokens: aiResponse.tokens, duration: aiResponse.duration },
          timestamp: new Date().toISOString(),
        });
      }

      // SAFETY MODE: Full emergency/prohibited detection
      const emergencyDetection = req.emergencyDetection || detectEmergency(message);
      const prohibitedDetection = req.prohibitedDetection || detectProhibitedTopic(message);

      // Handle emergency situations
      if (emergencyDetection.isEmergency) {
        const emergencyMessage = emergencyDetection.response.message;
        
        await conversationService.addMessage(
          conversation.id,
          'assistant',
          emergencyMessage,
          {
            safetyOverride: true,
            emergencyResponse: true,
            priority: 'emergency',
          }
        );

        // Create urgent handoff request
        await this.createHandoffRequest(conversation.id, 'emergency', 'emergency');

        return res.json({
          sessionId,
          message: emergencyMessage,
          role: 'assistant',
          metadata: {
            isEmergency: true,
            priority: 'emergency',
            handoffCreated: true,
          },
          timestamp: new Date().toISOString(),
        });
      }

      // Handle prohibited topics
      if (prohibitedDetection.isProhibited) {
        const refusalMessage = prohibitedDetection.response.message;
        
        await conversationService.addMessage(
          conversation.id,
          'assistant',
          refusalMessage,
          {
            safetyOverride: true,
            refusal: true,
          }
        );

        return res.json({
          sessionId,
          message: refusalMessage,
          role: 'assistant',
          metadata: {
            isRefusal: true,
          },
          timestamp: new Date().toISOString(),
        });
      }

      // Get conversation context
      const contextMessages = await conversationService.getContextMessages(sessionId, 10);

      // Generate AI response
      logger.info('Generating AI response', { sessionId, messageLength: message.length });
      
      const aiResponse = await llamaService.generateResponse(contextMessages);

      // Validate AI response for safety
      const validation = validateResponse(aiResponse.content);

      let finalResponse = aiResponse.content;
      let responseMetadata = {
        tokens: aiResponse.tokens,
        duration: aiResponse.duration,
        model: aiResponse.model,
        validated: validation.isValid,
      };

      // If response is unsafe, use a safe fallback
      if (!validation.isValid) {
        logger.warn('AI response failed validation', {
          sessionId,
          violations: validation.violations,
          reason: validation.reason
        });

        finalResponse = 'I apologize, but I cannot provide a proper response to that. ' +
          'Please consult with a healthcare professional for appropriate guidance.';

        responseMetadata.safetyOverride = true;
        responseMetadata.validationFailed = true;
      }

      // Handle urgent situations with additional guidance
      if (emergencyDetection.isUrgent) {
        finalResponse = `${emergencyDetection.response.message}\n\n${finalResponse}`;
        responseMetadata.urgentGuidance = true;
      }

      // Save AI response
      await conversationService.addMessage(
        conversation.id,
        'assistant',
        finalResponse,
        responseMetadata
      );

      return res.json({
        sessionId,
        message: finalResponse,
        role: 'assistant',
        metadata: responseMetadata,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Failed to process chat message', {
        error: error.message,
        sessionId,
        stack: error.stack
      });

      return res.status(500).json({
        error: 'CHAT_ERROR',
        message: 'Failed to process your message. Please try again.',
      });
    }
  }

  /**
   * Create new chat session
   */
  async createSession(req, res) {
    try {
      const patientId = req.user?.id || null; // From JWT if authenticated

      const session = await conversationService.createSession(patientId);

      return res.json({
        success: true,
        session,
      });

    } catch (error) {
      logger.error('Failed to create chat session', { error: error.message });

      return res.status(500).json({
        error: 'SESSION_CREATION_FAILED',
        message: 'Failed to create chat session',
      });
    }
  }

  /**
   * Get conversation history
   */
  async getHistory(req, res) {
    const { sessionId } = req.params;

    try {
      const history = await conversationService.getHistory(sessionId);

      return res.json({
        sessionId,
        messages: history,
        count: history.length,
      });

    } catch (error) {
      logger.error('Failed to get chat history', {
        error: error.message,
        sessionId
      });

      return res.status(500).json({
        error: 'HISTORY_FETCH_FAILED',
        message: 'Failed to retrieve chat history',
      });
    }
  }

  /**
   * Clear/close conversation
   */
  async closeSession(req, res) {
    const { sessionId } = req.params;

    try {
      await conversationService.closeConversation(sessionId);

      return res.json({
        success: true,
        message: 'Conversation closed successfully',
      });

    } catch (error) {
      logger.error('Failed to close conversation', {
        error: error.message,
        sessionId
      });

      return res.status(500).json({
        error: 'CLOSE_FAILED',
        message: 'Failed to close conversation',
      });
    }
  }

  /**
   * Helper: Create handoff request to staff
   */
  async createHandoffRequest(conversationId, reason, priority = 'normal') {
    try {
      const query = `
        INSERT INTO ai_handoff_requests (conversation_id, reason, priority, status, created_at)
        VALUES ($1, $2, $3, 'pending', NOW())
        RETURNING *
      `;

      const db = require('../../config/db');
      const result = await db.query(query, [conversationId, reason, priority]);

      logger.info('Handoff request created', {
        conversationId,
        reason,
        priority,
        requestId: result.rows[0].id
      });

      // TODO: Send real-time notification to staff (WebSocket)

      return result.rows[0];

    } catch (error) {
      logger.error('Failed to create handoff request', {
        error: error.message,
        conversationId
      });
      throw error;
    }
  }
}

module.exports = new ChatController();
