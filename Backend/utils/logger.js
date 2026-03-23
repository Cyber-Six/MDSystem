const winston = require("winston");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const logDir = process.env.LOGGER_DIR || "logs";

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function getDailyLogFile() {
  return path.join(
    logDir,
    `app-${new Date().toISOString().slice(0, 10)}.log`
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",

  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const base = `${timestamp} ${level.toUpperCase()}: ${message}`;
      return Object.keys(meta).length
        ? `${base} ${JSON.stringify(meta)}`
        : base;
    })
  ),

  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const base = `${timestamp} ${level}: ${message}`;
          return Object.keys(meta).length
            ? `${base} ${JSON.stringify(meta)}`
            : base;
        })
      )
    }),

    new winston.transports.File({
      filename: getDailyLogFile(),
      format: winston.format.json()
    })
  ]
});

// ✅ Export in multiple ways
module.exports = logger;        // default
module.exports.logger = logger; // named
module.exports.info = logger.info.bind(logger);
module.exports.error = logger.error.bind(logger);
module.exports.warn = logger.warn.bind(logger);
module.exports.debug = logger.debug.bind(logger);
