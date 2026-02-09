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
  constructor() {
    // Track active streaming sessions for cancellation support
    this.activeSessions = new Map(); // sessionId -> { abortController, isCancelled }
    
    // Bind methods that use 'this' so they work as Express route handlers
    this.cancelGeneration = this.cancelGeneration.bind(this);
    this.sendMessageStream = this.sendMessageStream.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.createSession = this.createSession.bind(this);
    this.getHistory = this.getHistory.bind(this);
    this.closeSession = this.closeSession.bind(this);
  }

  /**
   * Cancel ongoing message generation for a session
   */
  async cancelGeneration(req, res) {
    const { sessionId } = req.body;

    try {
      if (!sessionId) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Session ID is required'
        });
      }

      const sessionData = this.activeSessions.get(sessionId);

      if (!sessionData) {
        // No active generation for this session
        return res.json({
          success: true,
          message: 'No active generation to cancel'
        });
      }

      // Mark as cancelled and abort the request
      sessionData.isCancelled = true;
      sessionData.abortController.abort();

      logger.info('Generation cancelled by user', { sessionId });

      return res.json({
        success: true,
        message: 'Generation cancelled successfully'
      });

    } catch (error) {
      logger.error('Failed to cancel generation', {
        error: error.message,
        sessionId
      });

      return res.status(500).json({
        error: 'CANCEL_FAILED',
        message: 'Failed to cancel generation'
      });
    }
  }

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
   * Handle new message with streaming AI response (Server-Sent Events)
   * This prevents Cloudflare 524 timeout by sending tokens in real-time
   * Supports client-side cancellation via connection close
   */
  async sendMessageStream(req, res) {
    const { sessionId, message } = req.body;

    // Set up SSE headers immediately to prevent timeout
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Prevent compression that might buffer the stream
    res.setHeader('Content-Encoding', 'none');
    
    res.flushHeaders();

    // Create abort controller for cancellation support
    const abortController = new AbortController();
    let isCancelled = false;

    // Register this session for external cancellation
    this.activeSessions.set(sessionId, {
      abortController,
      isCancelled: false
    });

    // Handle client disconnect/cancellation
    req.on('close', () => {
      // Check if cancelled via explicit cancel endpoint
      const sessionData = this.activeSessions.get(sessionId);
      if (sessionData && sessionData.isCancelled) {
        isCancelled = true;
      }
      
      if (!res.writableEnded) {
        logger.info('Client disconnected, cancelling streaming response', { sessionId });
        isCancelled = true;
        abortController.abort();
      }
    });

    // Helper to send SSE event
    const sendEvent = (event, data) => {
      if (!isCancelled && !res.writableEnded) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    };

    try {
      // Get or validate conversation
      let conversation = await conversationService.getConversation(sessionId);

      if (!conversation) {
        sendEvent('error', { error: 'SESSION_NOT_FOUND', message: 'Chat session not found' });
        return res.end();
      }

      // Check if conversation is still active
      if (conversation.status === 'staff-taken') {
        sendEvent('error', { error: 'SESSION_TAKEN_BY_STAFF', message: 'A staff member has taken over this conversation' });
        return res.end();
      }

      // Check conversation limits
      const limitsCheck = await conversationService.checkLimits(sessionId);
      if (limitsCheck.exceeded) {
        sendEvent('error', { error: 'CONVERSATION_LIMIT_EXCEEDED', message: limitsCheck.reason });
        return res.end();
      }

      // Save user message first
      await conversationService.addMessage(conversation.id, 'user', message, {});

      // FAST MODE: Skip all safety processing
      if (!isSafetyMode) {
        const contextMessages = await conversationService.getContextMessages(sessionId, 10);
        
        // Signal that streaming is starting
        sendEvent('start', { sessionId, timestamp: new Date().toISOString() });

        let fullContent = '';

        // Generate streaming response with abort support
        const aiResponse = await llamaService.generateStreamingResponse(
          contextMessages,
          { signal: abortController.signal },
          (token, isStop) => {
            if (!isCancelled) {
              fullContent += token;
              sendEvent('token', { token, content: fullContent });
            }
          }
        );

        // Only save the complete response if not cancelled
        if (!isCancelled) {
          await conversationService.addMessage(conversation.id, 'assistant', aiResponse.content, {
            tokens: aiResponse.tokens,
            duration: aiResponse.duration,
            fastMode: true,
            streamed: true,
          });

          // Send completion event
          sendEvent('done', {
            sessionId,
            message: aiResponse.content,
            role: 'assistant',
            metadata: { tokens: aiResponse.tokens, duration: aiResponse.duration, streamed: true },
            timestamp: new Date().toISOString(),
          });
        }
        return res.end();
      }

      // SAFETY MODE: Full emergency/prohibited detection
      const emergencyDetection = req.emergencyDetection || detectEmergency(message);
      const prohibitedDetection = req.prohibitedDetection || detectProhibitedTopic(message);

      // Handle emergency situations (no streaming for immediate emergency response)
      if (emergencyDetection.isEmergency) {
        const emergencyMessage = emergencyDetection.response.message;
        
        await conversationService.addMessage(
          conversation.id,
          'assistant',
          emergencyMessage,
          { safetyOverride: true, emergencyResponse: true, priority: 'emergency' }
        );

        await this.createHandoffRequest(conversation.id, 'emergency', 'emergency');

        sendEvent('start', { sessionId, timestamp: new Date().toISOString() });
        sendEvent('token', { token: emergencyMessage, content: emergencyMessage });
        sendEvent('done', {
          sessionId,
          message: emergencyMessage,
          role: 'assistant',
          metadata: { isEmergency: true, priority: 'emergency', handoffCreated: true },
          timestamp: new Date().toISOString(),
        });
        return res.end();
      }

      // Handle prohibited topics (no streaming for refusal)
      if (prohibitedDetection.isProhibited) {
        const refusalMessage = prohibitedDetection.response.message;
        
        await conversationService.addMessage(
          conversation.id,
          'assistant',
          refusalMessage,
          { safetyOverride: true, refusal: true }
        );

        sendEvent('start', { sessionId, timestamp: new Date().toISOString() });
        sendEvent('token', { token: refusalMessage, content: refusalMessage });
        sendEvent('done', {
          sessionId,
          message: refusalMessage,
          role: 'assistant',
          metadata: { isRefusal: true },
          timestamp: new Date().toISOString(),
        });
        return res.end();
      }

      // Get conversation context
      const contextMessages = await conversationService.getContextMessages(sessionId, 10);

      // Signal that streaming is starting
      sendEvent('start', { sessionId, timestamp: new Date().toISOString() });

      logger.info('Generating streaming AI response', { sessionId, messageLength: message.length });

      let fullContent = '';
      let urgentPrefix = '';

      // Add urgent guidance prefix if needed
      if (emergencyDetection.isUrgent) {
        urgentPrefix = emergencyDetection.response.message + '\n\n';
        sendEvent('token', { token: urgentPrefix, content: urgentPrefix });
        fullContent = urgentPrefix;
      }

      // Generate streaming AI response with abort support
      const aiResponse = await llamaService.generateStreamingResponse(
        contextMessages,
        { signal: abortController.signal },
        (token, isStop) => {
          if (!isCancelled) {
            fullContent += token;
            sendEvent('token', { token, content: fullContent });
          }
        }
      );

      // Validate AI response for safety
      const validation = validateResponse(aiResponse.content);

      let finalResponse = urgentPrefix + aiResponse.content;
      let responseMetadata = {
        tokens: aiResponse.tokens,
        duration: aiResponse.duration,
        model: aiResponse.model,
        validated: validation.isValid,
        streamed: true,
      };

      // If response is unsafe, override with safe fallback
      if (!validation.isValid) {
        logger.warn('AI streaming response failed validation', {
          sessionId,
          violations: validation.violations,
          reason: validation.reason
        });

        finalResponse = 'I apologize, but I cannot provide a proper response to that. ' +
          'Please consult with a healthcare professional for appropriate guidance.';

        responseMetadata.safetyOverride = true;
        responseMetadata.validationFailed = true;
      }

      if (emergencyDetection.isUrgent) {
        responseMetadata.urgentGuidance = true;
      }

      // Only save AI response if not cancelled
      if (!isCancelled) {
        await conversationService.addMessage(
          conversation.id,
          'assistant',
          finalResponse,
          responseMetadata
        );

        // Send completion event
        sendEvent('done', {
          sessionId,
          message: finalResponse,
          role: 'assistant',
          metadata: responseMetadata,
          timestamp: new Date().toISOString(),
        });
      }

      // Clean up session tracking
      this.activeSessions.delete(sessionId);

      return res.end();

    } catch (error) {
      // Clean up session tracking
      this.activeSessions.delete(sessionId);
      
      // Don't log or send error if request was cancelled by client
      if (error.name === 'AbortError' || isCancelled) {
        logger.info('Streaming request cancelled by client', { sessionId });
        return res.end();
      }

      logger.error('Failed to process streaming chat message', {
        error: error.message,
        sessionId,
        stack: error.stack
      });

      sendEvent('error', {
        error: 'CHAT_ERROR',
        message: 'Failed to process your message. Please try again.',
      });
      return res.end();
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
