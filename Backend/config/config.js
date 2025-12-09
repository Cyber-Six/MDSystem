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
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    },
  jwt: { // JWT configuration
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h', // Default to 1 hour
    issuer: process.env.JWT_ISSUER || 'mdssyme-auth',
    },

};
console.log(process.env.POSTGRES_HOST);

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



module.exports = config;