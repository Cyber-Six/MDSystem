  const path = require('path');
  const dotenv = require('dotenv');
  dotenv.config({ path: path.resolve(__dirname, '../.env') });

  // .env loading complete, now build config object
  const config = {
    db: { // Database configuration
      host: process.env.POSTGRES_HOST,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      name: process.env.POSTGRES_DB,
      port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
      max: parseInt(process.env.POSTGRES_MAX_CONN, 10) || 5,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 30000,
      },
    jwt: { // JWT configuration
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '1h', // Default to 1 hour
      issuer: process.env.JWT_ISSUER || 'mdssyme-auth',
      },
    redis : { // redis configuration
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      username: process.env.REDIS_USERNAME || 'mdsadmin', // ACL user
      password: process.env.REDIS_PASSWORD,               // ACL password
      database: Number(process.env.REDIS_DB) || 0,
      },
    smtp : { // SMTP configuration
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    },
    totp: { // TOTP 2FA encryption key
      encryptionKey: process.env.TOTP_ENCRYPTION_KEY,
    },
  };

  // ✅ Fail-fast validation
  const requiredDbKeys = ['host', 'user', 'password', 'name'];
  for (const key of requiredDbKeys) {
    if (!config.db[key]) {
      throw new Error(`❌ Missing required DB config: ${key.toUpperCase()} in .env`);
    }
  }

  const requiredJwtKeys = ['secret'];
  for (const key of requiredJwtKeys) {
    if (!config.jwt[key]) {
      throw new Error(`❌ Missing required JWT config: ${key.toUpperCase()} in .env`);
    }
  }

  const requiredRedisKeys = ['host', 'port', 'username', 'password'];
  for (const key of requiredRedisKeys) {
    if (!config.redis[key]) {
      throw new Error(`❌ Missing required Redis config: ${key.toUpperCase()} in .env`);
    }
  }

  const requiredSmtpKeys = ['host', 'port', 'auth'];
  for (const key of requiredSmtpKeys) {
    if (!config.smtp[key]) {
      throw new Error(`❌ Missing required SMTP config: ${key.toUpperCase()} in .env`);
    }
  }
  
  if (!config.smtp.auth.user || !config.smtp.auth.pass) {
    throw new Error(`❌ Missing required SMTP AUTH config: USER or PASS in .env`);
  }

  if (!config.totp.encryptionKey || config.totp.encryptionKey.length !== 64) {
    throw new Error(`❌ TOTP_ENCRYPTION_KEY must be set to a 64-character hex string in .env. Generate one with: npm run setup:totp-key`);
  }

  module.exports = config;