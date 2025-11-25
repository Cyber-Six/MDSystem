// Server/utils/db.js

const { Pool } = require('pg');
const { db: dbConfig } = require('./config');

//console.log('DB Config:', dbConfig); // Debugging line
// Set up a PostgreSQL connection pool using config.js
const pool = new Pool({
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.name,
  port: dbConfig.port,
  max: dbConfig.max,
  idleTimeoutMillis: dbConfig.idleTimeoutMillis,
  connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
});

// Optional: test connection on startup
/*
(async () => {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ DB connected at:', result.rows[0].now);
  } catch (err) {
    console.error('❌ DB connection error:', err.message);
    process.exit(1); // Fail fast
  }
})();
*/
module.exports = pool;