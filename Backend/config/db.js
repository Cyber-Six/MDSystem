// Server/utils/db.js

const { Pool, types } = require('pg');
const { db: dbConfig } = require('./config');
const logger = require('../utils/logger.js');

// By default pg-types parses DATE (OID 1082) as `new Date(year, month-1, day)`
// which is LOCAL midnight. On non-UTC servers this shifts the date back one day
// when the Date is serialized to a UTC ISO string (e.g. "2026-04-04T16:00:00.000Z"
// for a date stored as 2026-04-05 on a UTC+8 server). Keep it as a plain
// YYYY-MM-DD string so all date comparisons on the frontend are timezone-safe.
types.setTypeParser(1082, val => val);

// For plain TIMESTAMP (OID 1114), return as string without timezone conversion.
// Plain TIMESTAMP values are stored as local time (e.g., "2026-04-14 21:00:00")
// If parsed as a JavaScript Date, the pg driver interprets it as UTC, causing
// an 8-hour offset on UTC+8 systems. Return the string as-is to preserve the
// stored value without reinterpretation.
types.setTypeParser(1114, val => val);

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
  statement_timeout: dbConfig.statement_timeout,
});

pool.on('connect', () => {
  logger.info('✅ Connected to Postgres');
  });

pool.on('error', (err) => {
  logger.error('❌ Unexpected Postgres error', err);
  process.exit(-1);
  });


module.exports = pool;