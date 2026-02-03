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

    // Initialize llama.cpp service
    const autoStartLlama = options.autoStartLlama || process.env.AUTO_START_LLAMA === 'true';
    await llamaService.initialize(autoStartLlama);

    // Register routes
    app.use('/api/chat', chatRoutes);

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
    
    // Don't throw - allow server to start without AI
    logger.warn('⚠️ Server starting without AI chatbot functionality');
    
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
