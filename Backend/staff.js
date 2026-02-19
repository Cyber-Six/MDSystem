const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const db = require('./config/db.js');
const redis = require('./config/redis.js');
const logger = require('./utils/logger.js');

const { initMedicalEMRGraphQL } = require('./routes/emr/graphql.js');
const { initMedicalProfileGraphQL } = require('./routes/profile/graphql.js');

const loginRoutes = require('./routes/auth/user/login.js');
const { initializeChatbot, shutdownChatbot } = require('./mds-chatbot');


require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = express();

// initialize DB
redis.initRedis().then(() => {
  logger.info('✅ Redis initialized');
}).catch((err) => {
  logger.error('Failed to initialize Redis', {  error: err  });
});

// Middleware
app.use(cors());
app.use(express.json());
app.set("trust proxy", true);

// ✅ Ensure req.body is always an object (prevents destructuring crashes)
app.use((req, res, next) => {
  if (req.body === undefined) {
    req.body = {}; // safe fallback
  }
  next();
});

// ✅ Global handler for malformed JSON
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: "INVALID_JSON",
      message: "The JSON body is malformed or invalid."
    });
  }
  next();
});

initMedicalEMRGraphQL(app);
initMedicalProfileGraphQL(app);


app.use('/auth/login', loginRoutes);

// ======================================
// Initialize AI Medical Chatbot BEFORE static files
// This ensures API routes are registered first
(async () => {
  try {
    const chatbot = await initializeChatbot(app, {
      autoStartLlama: process.env.AUTO_START_LLAMA === 'true'
    });
    
    if (chatbot) {
      logger.info('✅ AI Medical Chatbot initialized on staff portal');
    } else {
      logger.warn('⚠️ AI Medical Chatbot not available - staff portal running without AI');
    }
  } catch (err) {
    logger.error('Failed to initialize chatbot on staff portal', { error: err.message });
  }
})();

// ======================================

// Serve static assets for the React app (AFTER API routes)
app.use(express.static(path.join(__dirname, '../mds-frontend/dist')));

// Handle all other routes for the React app by serving the index.html
app.get('*path', (req, res) => {
  res.sendFile(path.join(__dirname, '../mds-frontend/dist', 'index.html'));
});


// =======================================
// Start server

const PORT = process.env.MEDICAL_PORT || 3001;
const HOST = process.env.HOST;
const server = app.listen(PORT, HOST, () => {
  logger.info(`⚙️ Server running on ${HOST}:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down staff server gracefully...');
  await shutdownChatbot();
  server.close(() => {
    logger.info('Staff server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down staff server gracefully...');
  await shutdownChatbot();
  server.close(() => {
    logger.info('Staff server closed');
    process.exit(0);
  });
});
