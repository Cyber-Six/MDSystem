const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const db = require('./config/db.js');
const redis = require('./config/redis.js');


require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

(async () => {
  await redis.initRedis({
    url: `redis://:${process.env.REDIS_PASS}@127.0.0.1:6379` 
    });
  })();

const emailservice = require('./services/emailservice.js');
/*
(async () => {
  await emailservice.sendOtpEmail('mjrpena@tip.edu.ph', 12394);
  //await emailservice.sendOtpEmail('mcjyabut@tip.edu.ph', 123912);
  //await emailservice.sendOtpEmail('mbjrivera@tip.edu.ph', 12391245);
  //await emailservice.sendOtpEmail('mjmgarcia01@tip.edu.ph', 123934);
  //await emailservice.sendOtpEmail('mkrmsamarita@tip.edu.ph', 123123);
})();

*/
// Start server
const PORT = process.env.PATIENT_PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});