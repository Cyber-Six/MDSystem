const { Queue } = require('bullmq');
const { generateOTP } = require('../config/security.js');
const { connection } = require('../config/redis.js'); // ✅ centralized Redis connection

const emailQueue = new Queue('emailQueue', { connection });
console.log('✅ Email queue initialized');

async function enqueueEmail(to, subject, htmlContent) {
  const job = await emailQueue.add('sendEmail', { to, subject, htmlContent }, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: false,
  });
  const waitingCount = await emailQueue.getWaitingCount();
  return { jobId: job.id, position: waitingCount };
}
/*
async function enqueueOTPEmail(userEmail) { //XXXXX
  const otp = generateOTP();
  const job = await emailQueue.add('sendOTPEmail', { userEmail, otp }, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
  });
  const waitingCount = await emailQueue.getWaitingCount();
  console.log(`Enqueued OTP email job ${job.id} for ${userEmail}`);
  return {
    jobId: job.id,
    position: waitingCount,
    expectedArrivalSeconds: waitingCount * (Number(process.env.EMAIL_DELAY) || 1),
    validitySeconds: 300,
  };
}
*/
async function enqueueEmail2FA(userEmail) {
  const otp = generateOTP();
  const job = await emailQueue.add('sendEmail2FA', { userEmail, otp }, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
  });
  const waitingCount = await emailQueue.getWaitingCount();
  console.log(`Enqueued OTP email job ${job.id} for ${userEmail}`);
  return {
    jobId: job.id,
    position: waitingCount,
    expectedArrivalSeconds: waitingCount * (Number(process.env.EMAIL_DELAY) || 1),
    validitySeconds: 300,
    };
  }

async function enqueueEmailVerification(userEmail) {
  const otp = generateOTP();
  const job = await emailQueue.add('sendEmailVerification', { userEmail, otp }, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
  });
  const waitingCount = await emailQueue.getWaitingCount();
  return {
    jobId: job.id,
    position: waitingCount,
    expectedArrivalSeconds: waitingCount * (Number(process.env.EMAIL_DELAY) || 1),
    validitySeconds: 300,
    };
  }
/*
function buildOTPEmail(userEmail, otp) { // XXXXXXXXXXXX
  const subject = 'Your MDSystem OTP Verification';
  const htmlContent = otpEmailTemplate(otp);
  return { to: userEmail, subject, htmlContent };
}
*/


// -------------------- Templates --------------------
function emailVerificationTemplate(otp) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
      <h2 style="color:#2F4F4F;">MDSystem Email Verification</h2>
      <p>Use the following One-Time Password (OTP) to verify your email address:</p>
      <div style="text-align:center; margin: 20px 0;">
        <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; background:#f0f0f0; padding:10px 20px; border-radius:5px;">${otp}</span>
      </div>
      <p>This OTP will expire in 5 minutes.></p>
      <p style="color:#888;">If you didn’t request this, ignore this email.</p>
    </div>
  `;
}

function twoFATemplate(otp) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
      <h2 style="color:#2F4F4F;">MDSystem Two-Factor Authentication</h2>
      <p>Use the following One-Time Password (OTP) to complete your login:</p>
      <div style="text-align:center; margin: 20px 0;">
        <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; background:#f0f0f0; padding:10px 20px; border-radius:5px;">${otp}</span>
      </div>
      <p>This OTP will expire in 5 minutes.</p>
      <p style="color:#888;">If you didn’t request this, ignore this email.</p>
    </div>
  `;
}

// -------------------- Builder --------------------
function buildEmailTemplate(job_name, userEmail, otp) {
  let subject;
  let htmlContent;

  if (job_name === "sendEmail2FA") {
    subject = "Your MDSystem 2FA Code";
    htmlContent = twoFATemplate(otp); // ✅ callable fn
  } else if (job_name === "sendEmailVerification") {
    subject = "Verify Your MDSystem Email Address";
    htmlContent = emailVerificationTemplate(otp); // ✅ callable fn
  } else {
    subject = "Your MDSystem OTP Verification";
    htmlContent = emailVerificationTemplate(otp); // fallback
  }

  return { to: userEmail, subject, htmlContent };
}

module.exports = { enqueueEmail, enqueueEmailVerification, enqueueEmail2FA, buildEmailTemplate };
