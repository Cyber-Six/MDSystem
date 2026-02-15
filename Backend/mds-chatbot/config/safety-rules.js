/**
 * Safety Rules Configuration (Optimized)
 * Used only when MEDICAL_SAFETY_MODE=true
 */

module.exports = {
  // Emergency Keywords - Require immediate medical attention
  emergencyKeywords: [
    'chest pain', 'heart attack', "can't breathe", 'difficulty breathing',
    'severe bleeding', 'choking', 'stroke', 'seizure', 'unconscious',
    'suicidal', 'kill myself', 'overdose', 'severe pain', 'anaphylaxis',
  ],

  // Urgent Keywords - Require prompt care
  urgentKeywords: [
    'high fever', 'blood in stool', 'blood in urine', 'worsening',
    'severe vomiting', 'dehydrated', 'infection',
  ],

  // Prohibited Topics
  prohibitedTopics: [
    'abortion', 'euthanasia', 'drug synthesis', 'self-surgery',
  ],

  // Restricted Actions (for response validation)
  restrictedActions: [
    'prescribe', 'diagnosis', 'stop taking medication',
  ],

  // Emergency Response
  emergencyResponse: {
    title: 'EMERGENCY',
    message: 'This may be a medical emergency. Call emergency services or go to the nearest ER immediately.',
  },

  // Urgent Response
  urgentResponse: {
    title: 'URGENT',
    message: 'Your symptoms suggest you should seek medical care soon.',
  },

  // Refusal Response
  refusalResponse: {
    message: 'I cannot provide information on this topic. Please speak with a healthcare provider.',
  },

  // Limits
  rateLimit: { messagesPerMinute: 10, messagesPerHour: 100 },
  contentFilter: { maxMessageLength: 2000, minMessageLength: 1 },
  conversationLimits: { maxMessagesPerSession: 50, maxSessionDurationHours: 24, inactivityTimeoutMinutes: 30 },
};
