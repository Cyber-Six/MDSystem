/**
 * Emergency Detector Middleware
 * Detects critical medical situations that require immediate attention
 */

const safetyRules = require('../config/safety-rules');
const logger = require('../../utils/logger');

/**
 * Check message for emergency keywords
 * @param {string} message - User message to check
 * @returns {Object} Detection result
 */
function detectEmergency(message) {
  const lowerMessage = message.toLowerCase();

  // Check for emergency keywords
  const emergencyMatches = safetyRules.emergencyKeywords.filter(keyword => 
    lowerMessage.includes(keyword.toLowerCase())
  );

  if (emergencyMatches.length > 0) {
    logger.warn('🚨 Emergency keywords detected', {
      keywords: emergencyMatches,
      messagePreview: message.substring(0, 100)
    });

    return {
      isEmergency: true,
      isUrgent: false,
      priority: 'emergency',
      matchedKeywords: emergencyMatches,
      response: safetyRules.emergencyResponse,
    };
  }

  // Check for urgent care keywords
  const urgentMatches = safetyRules.urgentKeywords.filter(keyword =>
    lowerMessage.includes(keyword.toLowerCase())
  );

  if (urgentMatches.length > 0) {
    logger.info('⚠️ Urgent care keywords detected', {
      keywords: urgentMatches,
      messagePreview: message.substring(0, 100)
    });

    return {
      isEmergency: false,
      isUrgent: true,
      priority: 'urgent',
      matchedKeywords: urgentMatches,
      response: safetyRules.urgentResponse,
    };
  }

  return {
    isEmergency: false,
    isUrgent: false,
    priority: 'normal',
    matchedKeywords: [],
    response: null,
  };
}

/**
 * Check for prohibited topics
 * @param {string} message - User message to check
 * @returns {Object} Detection result
 */
function detectProhibitedTopic(message) {
  const lowerMessage = message.toLowerCase();

  const prohibitedMatches = safetyRules.prohibitedTopics.filter(topic =>
    lowerMessage.includes(topic.toLowerCase())
  );

  if (prohibitedMatches.length > 0) {
    logger.info('🚫 Prohibited topic detected', {
      topics: prohibitedMatches,
      messagePreview: message.substring(0, 100)
    });

    return {
      isProhibited: true,
      matchedTopics: prohibitedMatches,
      response: safetyRules.refusalResponse,
    };
  }

  return {
    isProhibited: false,
    matchedTopics: [],
    response: null,
  };
}

/**
 * Check for restricted actions in AI response
 * @param {string} response - AI-generated response to validate
 * @returns {Object} Validation result
 */
function validateResponse(response) {
  const lowerResponse = response.toLowerCase();

  const restrictedMatches = safetyRules.restrictedActions.filter(action =>
    lowerResponse.includes(action.toLowerCase())
  );

  if (restrictedMatches.length > 0) {
    logger.warn('⚠️ AI response contains restricted actions', {
      actions: restrictedMatches,
      responsePreview: response.substring(0, 100)
    });

    return {
      isValid: false,
      violations: restrictedMatches,
      reason: 'Response contains prohibited medical actions',
    };
  }

  // Check for diagnosis language patterns
  const diagnosisPatterns = [
    /you have\s+(?:a|an|the)\s+\w+/i,
    /this is\s+(?:a|an|the)\s+\w+/i,
    /you are suffering from/i,
    /diagnosis is/i,
  ];

  for (const pattern of diagnosisPatterns) {
    if (pattern.test(response)) {
      logger.warn('⚠️ AI response contains diagnostic language', {
        pattern: pattern.toString(),
        responsePreview: response.substring(0, 100)
      });

      return {
        isValid: false,
        violations: ['diagnostic language'],
        reason: 'Response contains diagnostic statements',
      };
    }
  }

  return {
    isValid: true,
    violations: [],
    reason: null,
  };
}

/**
 * Express middleware for emergency detection
 */
function emergencyDetectorMiddleware(req, res, next) {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return next();
  }

  // Attach detection results to request
  req.emergencyDetection = detectEmergency(message);
  req.prohibitedDetection = detectProhibitedTopic(message);

  // If emergency detected, we'll handle it in the controller
  // but still proceed with the request flow
  next();
}

module.exports = {
  detectEmergency,
  detectProhibitedTopic,
  validateResponse,
  emergencyDetectorMiddleware,
};
