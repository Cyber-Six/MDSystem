
const nodemailer = require('nodemailer');
const { Worker } = require('bullmq');

const path = require('path');
const dotenv = require('dotenv');

const { buildEmailTemplate } = require('./emailservice.js');


const { connection, initRedis, setOTP } = require('../config/redis.js');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// -------------------- SMTP Transporter --------------------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE === 'true' || true,
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER,
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error('SMTP connection failed:', error);
  } else {
    console.log('SMTP server is ready to take messages');
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

  console.log("Using Redis password:", process.env.REDIS_PASSWORD ? "yes" : "no");
  console.log("Using Redis username:", process.env.REDIS_USERNAME);

const worker = new Worker('emailQueue', async job => {
  await sleep(Number(process.env.EMAIL_DELAY) || 1000);
  console.log(`Processing job ${job.id} of type ${job.name}`);

  try {
    const { userEmail, otp, portal, to, subject, htmlContent } = job.data;

    // ✅ Use buildEmailTemplate for OTP jobs
    let emailDetails;
    if (job.name === 'sendEmailVerification' || job.name === 'sendEmail2FA') {
      emailDetails = buildEmailTemplate(job.name, userEmail, otp);
    } else if (job.name === 'sendEmail') {
      emailDetails = { to, subject, htmlContent };
    }

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

        await setOTP(userEmail, otp, codeMap[job.name], portal);
        console.log("portal: ", portal);
        console.log(`✅ OTP stored for ${userEmail}`);
      } catch (redisErr) {
        console.error(`⚠️ Email sent but failed to store OTP: ${redisErr.message}`);
      }
    }

    console.log(`✅ Email sent: ${info.messageId}`);
    return { status: 'sent', id: info.messageId };
  } catch (error) {
    console.error(`❌ Error sending email: ${error.message}`);
    throw error;
    }
  }, { connection }
  );



  // -------------------- Graceful Shutdown --------------------
  process.on('SIGINT', async () => {
    console.log('Shutting down worker...');
    await worker.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Shutting down worker...');
    await worker.close();
    process.exit(0);
  });
})();
