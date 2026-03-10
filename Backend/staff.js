const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const db = require('./config/db.js');
const redis = require('./config/redis.js');
const logger = require('./utils/logger.js');

const { initMedicalEMRGraphQL } = require('./routes/emr/graphql.js');
const { initMedicalProfileGraphQL } = require('./routes/profile/graphql.js');
const { initMedicalAppointmentGraphQL } = require('./routes/appointment/graphql.js');
const { initMedicalConsultationGraphQL } = require('./routes/consultation/consult/graphql.js');
const { initMedicalInventoryGraphQL } = require('./routes/medical-inventory/inventory/graphql.js');
const { initMedicalMedicineRequestGraphQL } = require('./routes/medical-inventory/medicine-request/graphql.js');
const { initPrescriptionGraphQL } = require('./routes/medical-inventory/prescription/graphql.js');

const consentRoutes = require('./routes/info/compliance/consent.js');

const loginRoutes = require('./routes/auth/user/login.js');
const passwordResetRoutes = require('./routes/auth/email/emailpassword-reset.js');
const staffRoutes = require('./routes/staff/staff.js');
const roleManagementRoutes = require('./routes/staff/rolemanagement.js');


const { chatbotProxy } = require('./config/middleware/chatbotProxy');
const { jwtProtect } = require('./config/middleware/jwtProtect');


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
initMedicalAppointmentGraphQL(app);
initMedicalConsultationGraphQL(app);
initMedicalInventoryGraphQL(app);
initMedicalMedicineRequestGraphQL(app);
initPrescriptionGraphQL(app);


app.use('/auth/login', loginRoutes);
app.use('/auth/password', passwordResetRoutes);
app.use('/info/consent', consentRoutes);
app.use('/staff', staffRoutes);
app.use('/admin/staff', roleManagementRoutes);

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
const server = app.listen(PORT, HOST, () => {
  logger.info(`⚙️ Server running on ${HOST}:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down staff server gracefully...');
  server.close(() => {
    logger.info('Staff server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down staff server gracefully...');
  server.close(() => {
    logger.info('Staff server closed');
    process.exit(0);
  });
});
