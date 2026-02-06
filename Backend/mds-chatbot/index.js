/**
 * AI Medical Chatbot Module
 * Main entry point for the chatbot system
 */

const llamaService = require('./services/llama-service');
const conversationService = require('./services/conversation-service');
const chatRoutes = require('./routes/chat-routes');
const logger = require('../utils/logger');

/**
 * Initialize the AI chatbot module
 * @param {Express.Application} app - Express app instance
 * @param {Object} options - Configuration options
 */
async function initializeChatbot(app, options = {}) {
  try {
    logger.info('Initializing AI Medical Chatbot...');

    // IMPORTANT: Register routes FIRST (synchronously) before any async operations
    // This ensures routes are available immediately, before static file middleware
    app.use('/econsultation/chat', chatRoutes);
    logger.info('✅ Chatbot routes registered at /econsultation/chat');

    // Initialize llama.cpp service (async - connects to localhost:8080)
    const autoStartLlama = options.autoStartLlama || process.env.AUTO_START_LLAMA === 'true';
    await llamaService.initialize(autoStartLlama);

    logger.info('✅ AI Medical Chatbot initialized successfully');

    return {
      llamaService,
      conversationService,
    };

  } catch (error) {
    logger.error('Failed to initialize AI Medical Chatbot', {
      error: error.message,
      stack: error.stack
    });
    
    // Routes are already registered, so endpoints will work
    // They'll return appropriate errors if llama service is unavailable
    logger.warn('⚠️ Chatbot routes available but AI service may be unavailable');
    
    return null;
  }
}

/**
 * Shutdown the chatbot gracefully
 */
async function shutdownChatbot() {
  try {
    logger.info('Shutting down AI Medical Chatbot...');
    
    await llamaService.shutdown();
    
    logger.info('AI Medical Chatbot shut down successfully');
  } catch (error) {
    logger.error('Error during chatbot shutdown', { error: error.message });
  }
}

module.exports = {
  initializeChatbot,
  shutdownChatbot,
  llamaService,
  conversationService,
};
