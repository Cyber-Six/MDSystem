const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const db = require('./config/db.js');
const redis = require('./config/redis.js');
const emailservice = require('./services/emailservice.js');
const jwtConfig = require('./config/jwt.js');


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


(async () => {
  console.log(jwtConfig.generateAccessToken({id:1, role:'patient'}));
  /*
  await emailservice.enqueueEmail2FA('mjrpena@tip.edu.ph');
  await emailservice.enqueueEmail2FA('mcjyabut@tip.edu.ph');
  await emailservice.enqueueEmailVerification('mbjrivera@tip.edu.ph');
  await emailservice.enqueueEmailVerification('mjmgarcia01@tip.edu.ph');
  await emailservice.enqueueEmail2FA('mkrmsamarita@tip.edu.ph');
  */
})();


// Start server
const PORT = process.env.PATIENT_PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});