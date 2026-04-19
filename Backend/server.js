const express = require('express');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const db = require('./config/db.js');
const redis = require('./config/redis.js');
const logger = require('./utils/logger.js');

const registerRoutes = require('./routes/auth/user/register.js');
const loginRoutes = require('./routes/auth/user/login.js');
const userPasswordRoutes = require('./routes/auth/user/user-password.js');

const emailAuthRoutes = require('./routes/auth/email/emailauth.js');
const passwordResetRoutes = require('./routes/auth/email/emailpassword-reset.js');

const refreshAuthRoutes = require('./routes/auth/jwt/refresh.js');
const pushTokenRoutes = require('./routes/auth/push-token.js');
const googleOAuthRoutes = require('./routes/auth/oauth/google.js');

const consentRoutes = require('./routes/info/compliance/consent.js');

const mediaRoutes = require('./routes/media/media.js');
const AnnouncementRoutes = require('./routes/info/announcement/announcement.js');
const documentPatientRoutes = require('./routes/documents/document/document-patient.js');
const settingsRoutes = require('./routes/settings/settings.js');
const totpRoutes = require('./routes/settings/totp.js');
const settingsPasswordRoutes = require('./routes/settings/password.js');

const { initPatientEMRGraphQL, initMedicalEMRGraphQL } = require('./routes/emr/graphql.js');
const { initStaffEMRGraphQL } = require('./routes/staff/emr/graphql.js');
const { initPatientProfileGraphQL } = require('./routes/profile/graphql.js');
const { initPatientAppointmentGraphQL, initMedicalAppointmentGraphQL } = require('./routes/appointment/graphql.js');
const { chatbotProxy } = require('./config/middleware/chatbotProxy');
const { initSocket, getIO } = require('./config/sockets');
require('./config/sockets/health-chat-events'); // Register health chat socket handlers
require('./config/sockets/notification-events'); // Register notification socket handlers
require('./config/sockets/acknowledgement-events'); // Register notification acknowledgement socket handlers
const { initPatientMedicineRequestGraphQL } = require('./routes/medical-inventory/medicine-request/graphql.js');
const { initPrescriptionGraphQL } = require('./routes/medical-inventory/prescription/graphql.js');
const { initPatientHealthChatGraphQL, initMedicalHealthChatGraphQL } = require('./routes/health-chat/graphql.js');
const { initPatientDashboardGraphQL } = require('./routes/dashboard/graphql.js');

//const registerGraphQLRoutes = require('./testinggsql/index.js');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = express();

// Middleware
const corsOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',')
  : [];
app.use(cors({
  origin: corsOrigins.length > 0 ? corsOrigins : false,
  credentials: true,
}));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'", "'unsafe-inline'", "https://www.google.com", "https://accounts.google.com", "https://www.gstatic.com"],
      styleSrc:       ["'self'", "'unsafe-inline'"],
      imgSrc:         ["'self'", "data:", "https:", "blob:"],
      connectSrc:     ["'self'", "wss:", "ws:"],
      frameSrc:       ["'self'", "https://www.google.com", "blob:"],
      fontSrc:        ["'self'", "data:"],
      objectSrc:      ["'none'"],
      baseUri:        ["'self'"],
      formAction:     ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for Google Sign-In button
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
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
      message: "The JSON body is malformed or invalid.",
    });
  }
  next();
});

//registerGraphQLRoutes(app);
initPatientEMRGraphQL(app);
initMedicalEMRGraphQL(app);
initStaffEMRGraphQL(app);
initPatientProfileGraphQL(app);
initPatientAppointmentGraphQL(app);
initMedicalAppointmentGraphQL(app);
initPatientMedicineRequestGraphQL(app);
initPrescriptionGraphQL(app);
initPatientHealthChatGraphQL(app);
initMedicalHealthChatGraphQL(app);
initPatientDashboardGraphQL(app);

// AI Medical Chatbot — proxied to MDS-Chatbot microservice
// Requests to /econsultation/chat/* are forwarded to CHATBOT_URL (localhost or remote)
app.use('/econsultation/chat', chatbotProxy);
logger.info(`✅ Chatbot proxy registered at /econsultation/chat → ${process.env.CHATBOT_URL || '(not configured)'}`);

app.use('/auth/register', registerRoutes);
app.use('/auth/login', loginRoutes);
app.use('/auth/user', userPasswordRoutes);
app.use('/auth/password', passwordResetRoutes);
app.use('/auth/email', emailAuthRoutes);
app.use('/auth/refresh', refreshAuthRoutes);
app.use('/auth/push-token', pushTokenRoutes);
app.use('/auth/oauth', googleOAuthRoutes);

app.use('/info/consent', consentRoutes);
app.use('/media', mediaRoutes);
app.use('/announcement', AnnouncementRoutes);
app.use('/documents', documentPatientRoutes);
app.use('/settings', settingsRoutes);
app.use('/settings/totp', totpRoutes);
app.use('/settings/password', settingsPasswordRoutes);
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
const PORT = process.env.PATIENT_PORT || 3000;
const HOST = process.env.HOST;

async function start() {
  await redis.initRedis();
  logger.info('✅ Redis initialized');

  const server = app.listen(PORT, HOST, () => {
    logger.info(`⚙️ Server running on ${HOST}:${PORT}`);
  });

  await initSocket(server);

  // Graceful shutdown
  function shutdown(signal) {
    logger.info(`${signal} received, shutting down gracefully...`);
    const io = getIO();
    if (io) io.close();
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
