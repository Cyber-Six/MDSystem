const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const db = require('./config/db.js');
const redis = require('./config/redis.js');
const logger = require('./utils/logger.js');

const loginRoutes = require('./routes/auth/user/login.js');


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

app.use('/auth/login', loginRoutes);

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

const PORT = process.env.MEDICAL_PORT || 3001;
const HOST = process.env.HOST;
app.listen(PORT, HOST, () => {
  logger.info(`⚙️ Server running on ${HOST}:${PORT}`);
});
