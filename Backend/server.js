const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const db = require('./config/db.js');
const redis = require('./config/redis.js');
const logger = require('./utils/logger.js');

const registerRoutes = require('./routes/auth/user/register.js');
const loginRoutes = require('./routes/auth/user/login.js');

const emailAuthRoutes = require('./routes/auth/email/emailauth.js');
const passwordResetRoutes = require('./routes/auth/email/emailpassword-reset.js');

const refreshAuthRoutes = require('./routes/auth/jwt/refresh.js');

const consentRoutes = require('./routes/info/compliance/consent.js');

const mediaRoutes = require('./routes/media/media.js');
const AnnouncementRoutes = require('./routes/info/announcement/announcement.js');

const { initPatientEMRGraphQL } = require('./routes/emr/graphql.js');
const { initPatientProfileGraphQL } = require('./routes/profile/graphql.js');
const { initPatientAppointmentGraphQL, initMedicalAppointmentGraphQL } = require('./routes/appointment/graphql.js');
const { chatbotProxy } = require('./config/middleware/chatbotProxy');

//const registerGraphQLRoutes = require('./testinggsql/index.js');

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
      message: `The JSON body is malformed or invalid. ${req.body}`,
      body: req.body // safe fallback
    });
  }
  next();
});

//registerGraphQLRoutes(app);
initPatientEMRGraphQL(app);
initPatientProfileGraphQL(app);
initPatientAppointmentGraphQL(app);
initMedicalConsultationGraphQL(app);

// AI Medical Chatbot — proxied to MDS-AI-Chatbot microservice
// Requests to /econsultation/chat/* are forwarded to CHATBOT_URL (localhost or remote)
app.use('/econsultation/chat', chatbotProxy);
logger.info(`✅ Chatbot proxy registered at /econsultation/chat → ${process.env.CHATBOT_URL || '(not configured)'}`);

app.use('/auth/register', registerRoutes);
app.use('/auth/login', loginRoutes);
app.use('/auth/password', passwordResetRoutes);
app.use('/auth/email', emailAuthRoutes);
app.use('/auth/refresh', refreshAuthRoutes);

app.use('/info/consent', consentRoutes);
app.use('/media', mediaRoutes);
app.use('/announcement', AnnouncementRoutes);
// ======================================

// Serve static assets for the React app
app.use(express.static(path.join(__dirname, '../mds-patient/dist')));

// Redirect the root URL to '/app'

// Handle all other routes for the React app by serving the index.html
// Correct usage with named wildcard parameter
// Serve index.html for all non-API routes

app.get('*path', (req, res) => {
  res.sendFile(path.join(__dirname, '../mds-patient/dist', 'index.html'));
});


// =======================================
// Start server
const PORT = process.env.PATIENT_PORT || 3001;
const HOST = process.env.HOST;
const server = app.listen(PORT, HOST, () => {
  logger.info(`⚙️ Server running on ${HOST}:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
