/**
 * Safety Filter Middleware
 * Pre-process and validate incoming messages for safety
 */

const safetyRules = require('../config/safety-rules');
const logger = require('../../utils/logger');

/**
 * Validate message content
 */
function validateMessage(req, res, next) {
  const { message } = req.body;

  // Check if message exists
  if (!message) {
    return res.status(400).json({
      error: 'MESSAGE_REQUIRED',
      message: 'Message content is required'
    });
  }

  // Check message type
  if (typeof message !== 'string') {
    return res.status(400).json({
      error: 'INVALID_MESSAGE_TYPE',
      message: 'Message must be a string'
    });
  }

  // Check message length
  const trimmedMessage = message.trim();
  
  if (trimmedMessage.length < safetyRules.contentFilter.minMessageLength) {
    return res.status(400).json({
      error: 'MESSAGE_TOO_SHORT',
      message: 'Message is too short'
    });
  }

  if (trimmedMessage.length > safetyRules.contentFilter.maxMessageLength) {
    return res.status(400).json({
      error: 'MESSAGE_TOO_LONG',
      message: `Message exceeds maximum length of ${safetyRules.contentFilter.maxMessageLength} characters`
    });
  }

  // Sanitize message (remove excessive whitespace, null characters, etc.)
  req.body.message = trimmedMessage.replace(/\s+/g, ' ').replace(/\0/g, '');

  next();
}

/**
 * Rate limiting check
 */
function checkRateLimit(req, res, next) {
  const sessionId = req.body.sessionId || req.session?.id;
  
  if (!sessionId) {
    return next(); // Skip if no session ID
  }

  // TODO: Implement Redis-based rate limiting
  // For now, just log and pass through
  logger.debug('Rate limit check', { sessionId });

  next();
}

/**
 * Session validation
 */
function validateSession(req, res, next) {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      error: 'SESSION_REQUIRED',
      message: 'Session ID is required'
    });
  }

  // Basic UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(sessionId)) {
    return res.status(400).json({
      error: 'INVALID_SESSION_ID',
      message: 'Invalid session ID format'
    });
  }

  next();
}

/**
 * Content sanitization
 */
function sanitizeContent(req, res, next) {
  const { message } = req.body;

  // Remove potentially harmful content
  const sanitized = message
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/[^\x20-\x7E\n\r\t]/g, ''); // Remove non-printable characters (except newlines)

  req.body.message = sanitized;
  
  next();
}

/**
 * Spam detection
 */
function detectSpam(req, res, next) {
  const { message } = req.body;

  // Check for repeated characters
  const repeatedCharsPattern = /(.)\1{10,}/g;
  if (repeatedCharsPattern.test(message)) {
    logger.warn('Spam detected: repeated characters', {
      messagePreview: message.substring(0, 100)
    });
    
    return res.status(400).json({
      error: 'SPAM_DETECTED',
      message: 'Message appears to be spam'
    });
  }

  // Check for excessive capitalization
  const capsRatio = (message.match(/[A-Z]/g) || []).length / message.length;
  if (capsRatio > 0.7 && message.length > 20) {
    logger.warn('Spam detected: excessive caps', {
      capsRatio,
      messagePreview: message.substring(0, 100)
    });
  }

  next();
}

module.exports = {
  validateMessage,
  checkRateLimit,
  validateSession,
  sanitizeContent,
  detectSpam,
};
