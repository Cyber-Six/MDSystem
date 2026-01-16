
const nodemailer = require('nodemailer');
const { Worker } = require('bullmq');

const path = require('path');
const dotenv = require('dotenv');

const { buildEmailTemplate } = require('./emailservice.js');

const { initRedis, setOTP, createVerificationSession } = require('../config/redis.js');
const { redis: redisConfig, smtp: smtpConfig } = require('../config/config.js');
const logger = require('../utils/logger.js');
const { detectPortalFromSubdomain } = require('../utils/portal.js');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// -------------------- SMTP Transporter --------------------
const transporter = nodemailer.createTransport({
  host: smtpConfig.host,
  port: smtpConfig.port,
  secure: smtpConfig.secure,
  auth: {
    user: smtpConfig.auth.user,
    pass: smtpConfig.auth.pass,
  },
});

transporter.verify((error) => {
  if (error) {
    logger.error('SMTP connection failed:', { error: error });
  } else {
    logger.info('✅ SMTP server is ready to take messages');
  }
});

// -------------------- Utility: Sleep --------------------
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// -------------------- Worker --------------------
(async () => {

  // Initialize the global redis client for OTP helpers
  await initRedis();

  // BullMQ uses its own connection object
  const worker = new Worker('emailQueue', async job => {
    await sleep(Number(process.env.EMAIL_DELAY) || 1000);

    try {
      const { userEmail, data, portal, to, subject, htmlContent } = job.data;
      // ✅ Use buildEmailTemplate for OTP jobs
      let emailDetails;

      if (job.name === 'sendEmailVerification' || job.name === 'sendEmail2FA' || job.name === "sendPasswordResetLink") {
        if (job.name === "sendPasswordResetLink"){ // create verification ticket
          data.resetpwlink = await createVerificationSession(userEmail, "resetpassword", portal);
          data.portal = portal === "patient" ? "www" : "staff";
          }

        emailDetails = buildEmailTemplate(job.name, userEmail, data);
      } else if (job.name === 'sendEmail') {
        emailDetails = { to, subject, htmlContent };
      }

      logger.debug('📧 Preparing to send email',  
        { jobName: job.name, userEmail, data });
        
      const info = await transporter.sendMail({
        from: { name: 'MDSystem', address: process.env.SMTP_USER },
        to: emailDetails.to,
        subject: emailDetails.subject,
        html: emailDetails.htmlContent,
      });

      // ✅ Store OTP only after successful send (for OTP jobs)
      if (job.name === 'sendEmailVerification' || job.name === 'sendEmail2FA') {
        try {
          codeMap = {
            'sendEmailVerification': 'emailVerification',
            'sendEmail2FA': 'email2FA',
          };

          await setOTP(userEmail, data.otp, codeMap[job.name], portal);
        } catch (redisErr) {
          logger.error(`⚠️ Email sent but failed to store OTP': ${redisErr.message}`);
        }
      }

      logger.debug('✅ Email sent', {
        messageId: info.messageId,
        to: emailDetails.to,
        subject: emailDetails.subject,
        });
      return { status: 'sent', id: info.messageId };
    } catch (error) {
      logger.error(`❌ Error sending email: ${error.message}`);
      throw error;
      }
    }, { connection: redisConfig }
  );


// -------------------- Worker Event Handlers --------------------

  worker.on('active', (job) => {
    logger.info(`🚀 Job ${job.id} started`, { name: job.name, data: job.data });
  });

  worker.on('completed', (job, result) => {
    logger.info(`✅ Job ${job.id} completed`, { result });
  });

  worker.on('failed', (job, err) => {
    logger.error(`❌ Job ${job.id} failed: ${err.message}`, {
      stack: err.stack,
      name: job.name,
    });
  });

  worker.on('stalled', (job) => {
    logger.warn(`⚠️ Job ${job.id} stalled`, { name: job.name });
  });

  // -------------------- Graceful Shutdown --------------------
  process.on('SIGINT', async () => {
    logger.info('Shutting down worker...');
    await worker.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Shutting down worker...');
    await worker.close();
    process.exit(0);
  });
})();
