const express = require('express');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const db = require('./config/db.js');
const redis = require('./config/redis.js');
const logger = require('./utils/logger.js');

const { initMedicalEMRGraphQL } = require('./routes/emr/graphql.js');
const { initStaffEMRGraphQL } = require('./routes/staff/emr/graphql.js');
const { initMedicalProfileGraphQL } = require('./routes/profile/graphql.js');
const { initMedicalAppointmentGraphQL } = require('./routes/appointment/graphql.js');
const { initMedicalConsultationGraphQL } = require('./routes/consultation/consult/graphql.js');
const { initMedicalInventoryGraphQL } = require('./routes/medical-inventory/inventory/graphql.js');
const { initMedicalMedicineRequestGraphQL } = require('./routes/medical-inventory/medicine-request/graphql.js');
const { initPrescriptionGraphQL } = require('./routes/medical-inventory/prescription/graphql.js');
const { initMedicalHealthChatGraphQL } = require('./routes/health-chat/graphql.js');
const { initRoleManagementGraphQL } = require('./routes/role-management/graphql.js');

const consentRoutes = require('./routes/info/compliance/consent.js');
const AnnouncementRoutes = require('./routes/info/announcement/announcement.js');
const analyticsRoutes = require('./routes/documents/analytics.js');

const loginRoutes = require('./routes/auth/user/login.js');
const passwordResetRoutes = require('./routes/auth/email/emailpassword-reset.js');
const staffRoutes = require('./routes/staff/staff.js');
const dashboardRoutes = require('./routes/dashboard/dashboard.js');
const mediaRoutes = require('./routes/media/media.js');
const documentRoutes = require('./routes/documents/documents.js');
const emailAuthRoutes = require('./routes/auth/email/emailauth.js');
const settingsRoutes = require('./routes/settings/settings.js');
const refreshAuthRoutes = require('./routes/auth/jwt/refresh.js');


const { chatbotProxy } = require('./config/middleware/chatbotProxy');
const { jwtProtect } = require('./config/middleware/jwtProtect');
const { initSocket, getIO } = require('./config/sockets');
require('./config/sockets/health-chat-events'); // Register health chat socket handlers
require('./config/sockets/notification-events'); // Register notification socket handlers


require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = express();

// Middleware
app.use(cors());
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
      message: "The JSON body is malformed or invalid."
    });
  }
  next();
});

initMedicalEMRGraphQL(app);
initStaffEMRGraphQL(app);
initMedicalProfileGraphQL(app);
initMedicalAppointmentGraphQL(app);
initMedicalConsultationGraphQL(app);
initMedicalInventoryGraphQL(app);
initMedicalMedicineRequestGraphQL(app);
initPrescriptionGraphQL(app);
initMedicalHealthChatGraphQL(app);
initRoleManagementGraphQL(app);


app.use('/auth/login', loginRoutes);
app.use('/auth/password', passwordResetRoutes);
app.use('/auth/email', emailAuthRoutes);
app.use('/auth/refresh', refreshAuthRoutes);

app.use('/info/consent', consentRoutes);
app.use('/staff', staffRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/media', mediaRoutes);
app.use('/announcement', AnnouncementRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/documents', documentRoutes);
app.use('/settings', settingsRoutes);

// ======================================
// AI Medical Chatbot — proxied to MDS-Chatbot microservice
// Staff routes: JWT validated first, then forwarded with staff identity
// Patient routes on staff portal are also proxied (for staff-side patient chat views)
// IMPORTANT: Single mount point so Express doesn't strip the /staff prefix
app.use('/econsultation/chat', (req, res, next) => {
  if (req.path.startsWith('/staff')) {
    return jwtProtect('medical')(req, res, next);
  }
  next();
}, chatbotProxy);
logger.info(`✅ Chatbot proxy registered at /econsultation/chat → ${process.env.CHATBOT_URL || '(not configured)'}`);

// ======================================

// Serve static assets for the React app (AFTER API routes)
app.use(express.static(path.join(__dirname, '../mds-staff/dist')));

// Handle all other routes for the React app by serving the index.html
app.get('*path', (req, res) => {
  res.sendFile(path.join(__dirname, '../mds-staff/dist', 'index.html'));
});


// =======================================
// Start server

const PORT = process.env.MEDICAL_PORT || 3001;
const HOST = process.env.HOST;

async function start() {
  await redis.initRedis();
  logger.info('✅ Redis initialized');

  const server = app.listen(PORT, HOST, () => {
    logger.info(`⚙️ Staff server running on ${HOST}:${PORT}`);
  });

  await initSocket(server);

  // Graceful shutdown
  function shutdown(signal) {
    logger.info(`${signal} received, shutting down staff server gracefully...`);
    const io = getIO();
    if (io) io.close();
    server.close(() => {
      logger.info('Staff server closed');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('Failed to start staff server:', err);
  process.exit(1);
});
