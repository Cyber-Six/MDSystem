/**
 * Chat Routes
 * API endpoints for AI medical chatbot
 * 
 * Security Compliance:
 * - Public endpoints: IP-based rate limiting (PatientAuthentication profile)
 * - Staff endpoints: JWT authentication + staff role + IP rate limiting
 * - All inputs sanitized via safety-filter middleware
 */

const express = require('express');
const router = express.Router();

const chatController = require('../controllers/chat-controller');
const handoffController = require('../controllers/handoff-controller');

const { validateMessage, validateSession, sanitizeContent, detectSpam } = require('../middleware/safety-filter');
const { emergencyDetectorMiddleware } = require('../middleware/emergency-detector');
const { jwtProtect } = require('../../config/middleware/jwtProtect');
const { ipRateLimiter } = require('../../config/middleware/ratelimiter');

// ============================================
// Rate Limiting Configuration
// ============================================
// Using existing rate limit profiles from matrix.js for consistency
const patientChatLimiter = ipRateLimiter('PatientAuthentication', 'chat');
const staffChatLimiter = ipRateLimiter('staffAuthentication', 'staffchat');

// ============================================
// Public Chat Endpoints (Patient-facing)
// ============================================

/**
 * POST /econsultation/chat/session/new
 * Create a new chat session
 * Rate limited to prevent session abuse
 */
router.post('/session/new', 
  patientChatLimiter,
  chatController.createSession
);

/**
 * POST /econsultation/chat/message
 * Send a message and get AI response
 * 
 * Body: { sessionId, message }
 * 
 * Security:
 * - IP rate limited (PatientAuthentication profile)
 * - Session validation
 * - Input sanitization
 * - Spam detection
 * - Emergency keyword detection
 */
router.post('/message',
  patientChatLimiter,
  validateSession,
  validateMessage,
  sanitizeContent,
  detectSpam,
  emergencyDetectorMiddleware,
  chatController.sendMessage
);

/**
 * POST /econsultation/chat/message/stream
 * Send a message and get streaming AI response (Server-Sent Events)
 * 
 * Body: { sessionId, message }
 * 
 * Returns: SSE stream with events:
 * - start: Streaming started
 * - token: Individual token/chunk
 * - done: Complete response
 * - error: Error occurred
 * 
 * This endpoint prevents Cloudflare 524 timeout by streaming tokens in real-time
 * 
 * Security:
 * - IP rate limited (PatientAuthentication profile)
 * - Session validation
 * - Input sanitization
 * - Spam detection
 * - Emergency keyword detection
 */
router.post('/message/stream',
  patientChatLimiter,
  validateSession,
  validateMessage,
  sanitizeContent,
  detectSpam,
  emergencyDetectorMiddleware,
  chatController.sendMessageStream
);

/**
 * POST /econsultation/chat/cancel
 * Cancel ongoing AI response generation
 * 
 * Body: { sessionId }
 * 
 * Immediately halts the AI generation for the specified session
 * and ensures the incomplete response is not saved to database
 */
router.post('/cancel',
  patientChatLimiter,
  validateSession,
  chatController.cancelGeneration
);

/**
 * GET /econsultation/chat/history/:sessionId
 * Get conversation history
 * Rate limited to prevent enumeration attacks
 */
router.get('/history/:sessionId', 
  patientChatLimiter,
  chatController.getHistory
);

/**
 * DELETE /econsultation/chat/session/:sessionId
 * Close/clear a chat session
 */
router.delete('/session/:sessionId', 
  patientChatLimiter,
  chatController.closeSession
);

// ============================================
// Staff Endpoints (Protected)
// All staff endpoints require:
// 1. Valid JWT token
// 2. Medical staff role (doctor, nurse, staff)
// 3. IP-based rate limiting
// ============================================

/**
 * GET /econsultation/chat/staff/active
 * Get all active chat sessions
 * Requires: Staff authentication with medical role
 */
router.get('/staff/active', 
  staffChatLimiter,
  jwtProtect('medical'), 
  handoffController.getActiveChats
);

/**
 * GET /econsultation/chat/staff/handoffs
 * Get pending handoff requests
 * Requires: Staff authentication with medical role
 */
router.get('/staff/handoffs', 
  staffChatLimiter,
  jwtProtect('medical'), 
  handoffController.getPendingHandoffs
);

/**
 * POST /econsultation/chat/staff/takeover
 * Take over an AI chat session
 * Requires: Staff authentication with medical role
 * 
 * Body: { sessionId }
 */
router.post('/staff/takeover', 
  staffChatLimiter,
  jwtProtect('medical'), 
  handoffController.takeoverChat
);

/**
 * POST /econsultation/chat/staff/release
 * Release chat back to AI
 * Requires: Staff authentication with medical role
 * 
 * Body: { sessionId }
 */
router.post('/staff/release', 
  staffChatLimiter,
  jwtProtect('medical'), 
  handoffController.releaseChat
);

/**
 * POST /econsultation/chat/staff/message
 * Send message as staff in taken-over conversation
 * Requires: Staff authentication with medical role
 * 
 * Body: { sessionId, message }
 */
router.post('/staff/message',
  staffChatLimiter,
  jwtProtect('medical'),
  validateMessage,
  sanitizeContent,
  handoffController.sendStaffMessage
);

/**
 * GET /econsultation/chat/staff/transcript/:sessionId
 * Get full conversation transcript
 * Requires: Staff authentication with medical role
 */
router.get('/staff/transcript/:sessionId', 
  staffChatLimiter,
  jwtProtect('medical'), 
  handoffController.getTranscript
);

// ============================================
// Admin/Health Endpoints
// ============================================

/**
 * GET /econsultation/chat/health
 * Health check for AI service
 */
router.get('/health', async (req, res) => {
  const llamaService = require('../services/llama-service');
  
  try {
    const status = llamaService.getStatus();
    const isHealthy = await llamaService.healthCheck();

    res.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'ai-medical-chatbot',
      ...status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
