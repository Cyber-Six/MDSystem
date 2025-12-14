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

const loginRoutes = require('./routes/patient/user/login.js');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// initialize DB

redis.initRedis().then(() => {
  console.log('Redis initialized');
}).catch((err) => {
  console.error('Failed to initialize Redis:', err);
});


app.use('/user/register', registerRoutes);
app.use('/user/login', loginRoutes);
app.use('/consent', consentRoutes);
app.use('/user/auth', emailAuthRoutes);
app.use('/user/auth', refreshAuthRoutes);

// Start server
const PORT = process.env.PATIENT_PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});