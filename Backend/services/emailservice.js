const { Queue } = require('bullmq');
const { generateOTP } = require('../utils/security.js');
const { redisConfig } = require('../config/redis.js');
const logger = require('../utils/logger.js');

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const RESET_PASSWORD_DOMAIN_ROUTE = process.env.RESET_PASSWORD_DOMAIN_ROUTE?.trim();
if (!RESET_PASSWORD_DOMAIN_ROUTE || ['undefined', 'null'].includes(RESET_PASSWORD_DOMAIN_ROUTE.toLowerCase())) {
  throw new Error(
    'Invalid or missing RESET_PASSWORD_DOMAIN_ROUTE. Set it to a real domain/path in Backend/.env before starting the server.'
  );
}

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

async function enqueueAdminTransferEmail(userEmail, verificationToken, newAdminEmail) {
  const job = await emailQueue.add('sendAdminTransferEmail', {
    userEmail,
    data: { verificationToken, newAdminEmail },
  }, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
  });
  const waitingCount = await emailQueue.getWaitingCount();
  logger.debug(`Enqueued admin transfer email for ${userEmail}, job ID: ${job.id}`);
  return {
    jobId: job.id,
    position: waitingCount,
    expectedArrivalSeconds: waitingCount * (Number(process.env.EMAIL_DELAY) || 1),
    validitySeconds: 600, // 10 minutes
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
  const resetLink = `https://${portal}.${RESET_PASSWORD_DOMAIN_ROUTE}/${sessionToken}`;
  logger.debug(`Generated password reset link for portal ${portal}: ${resetLink}`);
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
      <h2 style="color:#2F4F4F;">MDSystem Password Nigger</h2>
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

function adminTransferTemplate(verificationToken, newAdminEmail) {
  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'UTC',
    dateStyle: 'full',
    timeStyle: 'long'
  });

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 2px solid #dc3545; border-radius: 10px; background-color: #fff5f5;">
      <div style="background-color: #dc3545; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <h2 style="margin: 0;">⚠️ Admin Privilege Transfer Request</h2>
      </div>

      <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
        <strong style="color: #856404;">CRITICAL SECURITY ACTION REQUIRED</strong>
      </div>

      <p><strong>Request initiated at:</strong> ${timestamp} (UTC)</p>
      <p>You have initiated a request to transfer admin privileges to:</p>
      <p style="font-size: 18px; font-weight: bold; color: #2F4F4F; text-align: center; padding: 10px; background-color: #f0f0f0; border-radius: 5px;">
        ${newAdminEmail}
      </p>

      <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; margin: 20px 0; border-radius: 5px;">
        <h3 style="color: #721c24; margin-top: 0;">⚠️ Warning: This action will:</h3>
        <ul style="color: #721c24;">
          <li><strong>Grant full administrative privileges</strong> to ${newAdminEmail}</li>
          <li><strong>Permanently remove YOUR admin privileges</strong></li>
          <li><strong>Cannot be undone</strong> without intervention from the new admin</li>
          <li><strong>Invalidate any pending transfer requests</strong></li>
        </ul>
      </div>

      <p style="margin-top: 30px;"><strong>To confirm this transfer, use the following verification token:</strong></p>

      <div style="text-align:center; margin: 25px 0;">
        <div style="font-size: 22px; font-weight: bold; letter-spacing: 4px; background:#2F4F4F; color: white; padding:15px 25px; border-radius:8px; font-family: 'Courier New', monospace;">
          ${verificationToken}
        </div>
      </div>

      <div style="background-color: #d1ecf1; border-left: 4px solid #17a2b8; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #0c5460;"><strong>Token Security:</strong></p>
        <ul style="color: #0c5460; margin-top: 10px;">
          <li>This token will <strong>expire in 10 minutes</strong></li>
          <li>Can only be used <strong>once</strong></li>
          <li>Only valid for this specific transfer request</li>
          <li>Do not share this token with anyone</li>
        </ul>
      </div>

      <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; margin: 20px 0; border-radius: 5px;">
        <p style="margin: 0; color: #495057;"><strong>🔒 Security Recommendations:</strong></p>
        <ul style="color: #495057; margin-top: 10px;">
          <li>Verify you initiated this request</li>
          <li>Confirm the recipient email address is correct</li>
          <li>Ensure the new admin has completed all required security training</li>
          <li>Document this transfer in your administrative records</li>
        </ul>
      </div>

      <p style="color:#dc3545; font-weight: bold; margin-top: 30px;">⚠️ If you did NOT initiate this transfer:</p>
      <ol style="color:#dc3545;">
        <li><strong>Do NOT use the verification token</strong></li>
        <li><strong>Secure your account immediately</strong> (change password, review active sessions)</li>
        <li><strong>Contact your system security team</strong></li>
        <li><strong>Report this as a potential security incident</strong></li>
      </ol>

      <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">

      <p style="color:#6c757d; font-size: 12px; text-align: center;">
        This is an automated security notification from MDSystem.<br>
        For security reasons, do not reply to this email.
      </p>
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
  } else if (job_name === 'sendAdminTransferEmail') {
    subject = 'Admin Privilege Transfer Request';
    htmlContent = adminTransferTemplate(data.verificationToken, data.newAdminEmail);
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
  enqueueAdminTransferEmail,
  buildEmailTemplate,
  notificationTemplate,
};
