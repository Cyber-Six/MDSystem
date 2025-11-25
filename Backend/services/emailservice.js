// emailService.js
require('dotenv').config();
const crypto = require("crypto");
const nodemailer = require('nodemailer');
const { setKey } = require('../config/redis.js');

// Create reusable transporter objectconst transporter = nodemailer.createTransport({
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,            // use 465 with secure:true
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**z
 * Send an email
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML body content
 */
async function sendEmail(to, subject, htmlContent) {
  try {
    const info = await transporter.sendMail({
      from: {
        name: 'MDSystem',
        address: process.env.EMAIL_USER
        },
      to,
      subject,
      html: htmlContent,
    });
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

async function generateOTP(userId, expireSeconds = process.env.OTP_EXPIRATION) { // 5 min default
  const otp = crypto.randomInt(100000, 999999).toString(); // 6-digit OTP
  await setKey(`otp:${userId}`, otp, expireSeconds);
  return otp;
  }

function otpEmailTemplate(otp) {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
    <h2 style="color:#2F4F4F;">MDSystem Email Verification</h2>
    <p>Use the following One-Time Password (OTP) to verify your email address:</p>
    <div style="text-align:center; margin: 20px 0;">
      <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; background:#f0f0f0; padding:10px 20px; border-radius:5px;">${otp}</span>
    </div>
    <p>This OTP will expire in 5 minutes.</p>
    <p style="color:#888;">If you didn’t request this, ignore this email.</p>
  </div>
  `;
  }

async function sendOtpEmail(userEmail, otp) {
  const htmlContent = otpEmailTemplate(otp);
  const subject = "Your MDSystem OTP Verification";

  return await sendEmail(userEmail, subject, htmlContent);
  }

module.exports = { sendEmail, generateOTP, sendOtpEmail };
