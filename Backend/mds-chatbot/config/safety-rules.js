/**
 * Safety Rules and Emergency Detection Configuration
 * Critical for preventing medical liability and ensuring user safety
 */

module.exports = {
  // Emergency Keywords - Require immediate medical attention
  emergencyKeywords: [
    // Cardiac/Respiratory
    'chest pain', 'heart attack', 'crushing chest', 'pressure in chest',
    "can't breathe", "can not breathe", 'shortness of breath', 'difficulty breathing',
    'choking', 'gasping', 'blue lips', 'blue skin',
    
    // Severe Bleeding/Trauma
    'severe bleeding', 'heavy bleeding', 'bleeding heavily', 'won\'t stop bleeding',
    'blood gushing', 'spurting blood', 'head injury', 'severe trauma',
    
    // Neurological
    'stroke', 'slurred speech', 'face drooping', 'arm weakness',
    'seizure', 'convulsing', 'convulsion', 'unconscious', 'unresponsive',
    'fainted', 'passed out', 'blacked out', 'severe headache', 'worst headache',
    
    // Mental Health Emergencies
    'suicidal', 'kill myself', 'end my life', 'want to die',
    'suicide', 'self harm', 'hurt myself',
    
    // Poisoning/Overdose
    'overdose', 'took too many', 'poisoning', 'poisoned', 'ingested chemicals',
    
    // Severe Pain
    'severe pain', 'unbearable pain', 'excruciating pain', 'worst pain',
    'agonizing pain',
    
    // Other Critical
    'allergic reaction', 'anaphylaxis', 'throat closing', 'swelling throat',
    'severe burn', 'broken bone', 'bone sticking out',
  ],

  // High Priority Keywords - Require urgent care (not emergency)
  urgentKeywords: [
    'high fever', 'fever over', 'temperature above',
    'severe vomiting', 'can\'t keep anything down', 'dehydrated',
    'severe diarrhea', 'blood in stool', 'blood in urine',
    'persistent pain', 'worsening', 'getting worse',
    'infection', 'pus', 'swollen', 'red and hot',
  ],

  // Prohibited Topics - AI should refuse to answer
  prohibitedTopics: [
    'abortion', 'euthanasia', 'assisted suicide',
    'illegal drugs', 'drug synthesis', 'drug manufacturing',
    'self-surgery', 'removing stitches', 'home surgery',
  ],

  // Restricted Actions - AI should never suggest these
  restrictedActions: [
    'prescribe medication', 'medication dosage', 'drug recommendation',
    'diagnose', 'diagnosis', 'medical diagnosis',
    'stop taking medication', 'discontinue medication',
    'ignore symptoms', 'wait and see', 'it\'s nothing',
  ],

  // Emergency Response Template
  emergencyResponse: {
    title: '🚨 EMERGENCY ALERT',
    message: `Based on your symptoms, this could be a medical emergency.

**SEEK IMMEDIATE MEDICAL ATTENTION:**
- Call emergency services (911 or your local emergency number)
- Go to the nearest emergency room
- Do not drive yourself if possible

Your symptoms require immediate evaluation by medical professionals.

This is NOT a diagnosis, but these symptoms warrant urgent medical care.`,
  },

  // Urgent Care Response Template
  urgentResponse: {
    title: '⚠️ URGENT CARE NEEDED',
    message: `Your symptoms suggest you should seek medical care soon.

**Recommended Actions:**
- Contact your doctor or clinic today
- Visit an urgent care center if your doctor is unavailable
- Do not delay if symptoms worsen

These symptoms should be evaluated by a healthcare professional within 24 hours.`,
  },

  // Refusal Response Template
  refusalResponse: {
    message: `I'm sorry, but I cannot provide information on this topic. 

For questions like these, please speak directly with a licensed healthcare provider who can give you appropriate guidance based on a proper medical evaluation.

Is there something else I can help you with?`,
  },

  // Rate Limiting
  rateLimit: {
    messagesPerMinute: 10,
    messagesPerHour: 100,
  },

  // Content Filters
  contentFilter: {
    maxMessageLength: 2000,
    minMessageLength: 1,
    allowedLanguages: ['en'], // Expand as needed
  },

  // Conversation Limits
  conversationLimits: {
    maxMessagesPerSession: 50,
    maxSessionDurationHours: 24,
    inactivityTimeoutMinutes: 30,
  },
};
