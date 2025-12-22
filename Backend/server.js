const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const db = require('./config/db.js');
const redis = require('./config/redis.js');
const emailservice = require('./services/emailservice.js');
const jwtConfig = require('./config/jwt.js');

const registerRoutes = require('./routes/patient/user/register.js');
const consentRoutes = require('./routes/patient/info/consent.js');
const emailAuthRoutes = require('./routes/auth/emailauth.js');
const refreshAuthRoutes = require('./routes/auth/refresh.js');
const passwordResetRoutes = require('./routes/auth/emailpassword-reset.js');
const loginRoutes = require('./routes/patient/user/login.js');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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
// initialize DB

redis.initRedis().then(() => {
  console.log('Redis initialized');
}).catch((err) => {
  console.error('Failed to initialize Redis:', err);
});


app.use('/auth/register', registerRoutes);
app.use('/auth/login', loginRoutes);
app.use('/auth/password', passwordResetRoutes);
app.use('/auth/email', emailAuthRoutes);
app.use('/auth/refresh', refreshAuthRoutes);

app.use('/info/consent', consentRoutes);


// ======================================

// Serve static assets for the React app
app.use(express.static(path.join(__dirname, '../mds-frontend/dist')));

// Redirect the root URL to '/app'

// Handle all other routes for the React app by serving the index.html
// Correct usage with named wildcard parameter
// Serve index.html for all non-API routes

app.get('*path', (req, res) => {
  res.sendFile(path.join(__dirname, '../mds-frontend/dist', 'index.html'));
});


// =======================================
// Start server
const PORT = process.env.PATIENT_PORT || 3001;
const HOST = process.env.HOST;
app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
});
