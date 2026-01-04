// Server/utils/db.js

const { Pool } = require('pg');
const { db: dbConfig } = require('./config');
const logger = require('../utils/logger.js');
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

pool.on('connect', () => {
  logger.info('✅ Connected to Postgres');
  });

pool.on('error', (err) => {
  logger.error('❌ Unexpected Postgres error', err);
  process.exit(-1);
  });


module.exports = pool;