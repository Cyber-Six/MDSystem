const { Queue } = require('bullmq');
const { generateOTP } = require('../utils/security.js');
const { redisConfig } = require('../config/redis.js');
const logger = require('../utils/logger.js');

// ✅ Email Verification Expiration
const EMAIL_VERIF_EXP_SECONDS = Number(process.env.EMAIL_VERIF_EXPIRATION) || 300;
const EMAIL_VERIF_EXP_MINUTES = Math.floor(EMAIL_VERIF_EXP_SECONDS / 60);

// ✅ Two-Factor Authentication Expiration
const EMAIL_2FA_EXP_SECONDS = Number(process.env.EMAIL_2FA_EXPIRATION) || 300;
const EMAIL_2FA_EXP_MINUTES = Math.floor(EMAIL_2FA_EXP_SECONDS / 60);

// ✅ Password Reset Expiration
const EMAIL_RESETPW_EXP_SECONDS = Number(process.env.EMAIL_PASSWD_RESET_EXPIRATION) || 900;
const EMAIL_RESETPW_EXP_MINUTES = Math.floor(EMAIL_RESETPW_EXP_SECONDS / 60);


const emailQueue = new Queue('emailQueue', { connection: redisConfig });
logger.info('✅ Email queue initialized');

// -------------------- Enqueue Helpers --------------------

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

async function enqueueEmail2FA(userEmail, portal = "patient") {
  const otp = generateOTP();
  const job = await emailQueue.add('sendEmail2FA', { userEmail, data: { otp }, portal }, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
  });
  const waitingCount = await emailQueue.getWaitingCount();
  return {
    jobId: job.id,
    position: waitingCount,
    expectedArrivalSeconds: waitingCount * (Number(process.env.EMAIL_DELAY) || 1),
    validitySeconds: Number(process.env.EMAIL_2FA_EXPIRATION) || 300,
  };
}

async function enqueueEmailVerification(userEmail, portal = "patient") {
  const otp = generateOTP();
  const job = await emailQueue.add('sendEmailVerification', { userEmail, data: { otp }, portal }, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
  });
  const waitingCount = await emailQueue.getWaitingCount();
  return {
    jobId: job.id,
    position: waitingCount,
    expectedArrivalSeconds: waitingCount * (Number(process.env.EMAIL_DELAY) || 1),
    validitySeconds: Number(process.env.EMAIL_VERIF_EXPIRATION) || 300,
  };
}

async function enqueueResetPassword(userEmail, portal = "patient") {
  // Verification token is created by the worker just before sending
  const job = await emailQueue.add('sendPasswordResetLink', { userEmail, data: {}, portal }, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
  });
  const waitingCount = await emailQueue.getWaitingCount();
  logger.debug(`Enqueued password reset email for ${userEmail} in portal ${portal}, job ID: ${job.id}`);
  return {
    jobId: job.id,
    position: waitingCount,
    expectedArrivalSeconds: waitingCount * (Number(process.env.EMAIL_DELAY) || 1),
    validitySeconds: Number(process.env.EMAIL_PASSWD_RESET_EXPIRATION) || 900,
  };
}

/**
 * Enqueue a generic notification email for any system event.
 * All notification emails funnel through this single job name ('sendNotificationEmail').
 * Domain-specific wrappers (medicine requests, prescriptions, etc.) delegate here
 * so there is only one email template and one worker branch for all notifications.
 *
 * @param {string}  userEmail
 * @param {string}  title    - Email subject and heading
 * @param {string}  message  - Body text (may contain inline HTML)
 * @param {string}  [notes]  - Optional extra notes paragraph
 * @param {string}  [ctaText]
 * @param {string}  [ctaLink]
 */
async function enqueueNotificationEmail(userEmail, title, message, notes = null, ctaText = null, ctaLink = null) {
  const job = await emailQueue.add('sendNotificationEmail', {
    userEmail,
    data: { title, message, notes, ctaText, ctaLink },
  }, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
  });
  const waitingCount = await emailQueue.getWaitingCount();
  return { jobId: job.id, position: waitingCount };
}


// -------------------- Templates --------------------

function emailVerificationTemplate(otp) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
      <h2 style="color:#2F4F4F;">MDSystem Email Verification</h2>
      <p>Use the following One-Time Password (OTP) to verify your email address:</p>

      <div style="text-align:center; margin: 20px 0;">
        <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; background:#f0f0f0; padding:10px 20px; border-radius:5px;">
          ${otp}
        </span>
      </div>

      <p>This OTP will expire in ${EMAIL_VERIF_EXP_MINUTES} minutes.</p>
      <p style="color:#888;">If you didn't request this, ignore this email.</p>
    </div>
  `;
}

function twoFATemplate(otp) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
      <h2 style="color:#2F4F4F;">MDSystem Two-Factor Authentication</h2>
      <p>Use the following One-Time Password (OTP) to complete your login:</p>

      <div style="text-align:center; margin: 20px 0;">
        <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; background:#f0f0f0; padding:10px 20px; border-radius:5px;">
          ${otp}
        </span>
      </div>

      <p>This OTP will expire in ${EMAIL_2FA_EXP_MINUTES} minutes.</p>
      <p style="color:#888;">If you didn't request this, ignore this email.</p>
    </div>
  `;
}

/**
 * Generic notification email wrapper.
 * All system notification emails are rendered through this single template.
 *
 * @param {object} options
 * @param {string}  options.title      - Heading shown in the email
 * @param {string}  options.message    - Body HTML/text (may contain inline <strong>, <span>, etc.)
 * @param {string}  [options.notes]    - Optional staff/extra notes paragraph
 * @param {string}  [options.ctaText]  - Call-to-action button label
 * @param {string}  [options.ctaLink]  - Call-to-action button URL
 */
function notificationTemplate({ title, message, notes, ctaText, ctaLink }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
      <h2 style="color:#2F4F4F;">${title}</h2>
      <p>${message}</p>
      ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
      ${ctaText && ctaLink
        ? `<div style="text-align:center; margin: 25px 0;">
             <a href="${ctaLink}" style="background:#2F4F4F; color:white; padding:12px 25px; text-decoration:none; border-radius:5px; font-weight:bold;">
               ${ctaText}
             </a>
           </div>`
        : ''}
      <p style="color:#888;">If you have questions, please contact the clinic directly.</p>
    </div>
  `;
}

function passwordResetTemplate(sessionToken, portal) {
  const route = process.env.RESET_PASSWORD_DOMAIN_ROUTE;
  const resetLink = `https://${portal}.${route}/${sessionToken}`;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
      <h2 style="color:#2F4F4F;">MDSystem Password Reset</h2>
      <p>You requested to reset your MDSystem account password.</p>
      <p>Click the button below to reset your password:</p>

      <div style="text-align:center; margin: 25px 0;">
        <a href="${resetLink}"
           style="background:#2F4F4F; color:white; padding:12px 25px; text-decoration:none; border-radius:5px; font-weight:bold;">
          Reset Password
        </a>
      </div>

      <p>If the button doesn't work, copy and paste the link below into your browser:</p>
      <p style="word-break: break-all; color:#2F4F4F;">${resetLink}</p>

      <p>This link will expire in ${EMAIL_RESETPW_EXP_MINUTES} minutes.</p>
      <p style="color:#888;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
}


// -------------------- Builder --------------------
function buildEmailTemplate(job_name, userEmail, data) {
  let subject;
  let htmlContent;

  if (job_name === 'sendEmail2FA') {
    subject = 'Your MDSystem 2FA Code';
    htmlContent = twoFATemplate(data.otp);
  } else if (job_name === 'sendEmailVerification') {
    subject = 'Verify Your MDSystem Email Address';
    htmlContent = emailVerificationTemplate(data.otp);
  } else if (job_name === 'sendPasswordResetLink') {
    subject = 'Reset Your MDSystem Password';
    htmlContent = passwordResetTemplate(data.resetpwlink, data.portal);
  } else if (job_name === 'sendNotificationEmail') {
    subject = data.title;
    htmlContent = notificationTemplate({
      title: data.title,
      message: data.message,
      notes: data.notes,
      ctaText: data.ctaText,
      ctaLink: data.ctaLink,
    });
  } else {
    subject = 'Your MDSystem OTP Verification';
    htmlContent = emailVerificationTemplate(data.otp); // fallback
  }

  return { to: userEmail, subject, htmlContent };
}

module.exports = {
  enqueueEmail,
  enqueueEmailVerification,
  enqueueEmail2FA,
  enqueueResetPassword,
  enqueueNotificationEmail,
  buildEmailTemplate,
  notificationTemplate,
};
