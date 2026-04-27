const db = require('../query.js');
const logger = require('../../utils/logger.js');

/**
 * Middleware to check user credentials status
 * Ensures user has completed required credentials before accessing certain routes
 */
async function checkCredentialsStatus(req, res, next) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      logger.warn(`[CREDENTIALS] Missing user ID route=${req.path}, ip=${req.ip}`);
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "User authentication required."
      });
    }

    // Query user credentials status
    const sql = `
      SELECT credentials_status 
      FROM active_user_credentials 
      WHERE id = $1
      LIMIT 1;
    `;

    const result = await db.query(sql, [userId]);

    if (!result.rows || result.rows.length === 0) {
      logger.warn(`[CREDENTIALS] Credentials not found userId=${userId}, route=${req.path}, ip=${req.ip}`);
      return res.status(403).json({
        error: "CREDENTIALS_NOT_FOUND",
        message: "User credentials not found. Please complete registration."
      });
    }

    const status = result.rows[0].credentials_status;

    // Check if credentials are incomplete
    if (status !== 'Active') {
      logger.warn(`[CREDENTIALS] Incomplete credentials userId=${userId}, status=${status}, route=${req.path}, ip=${req.ip}`);
      return res.status(403).json({
        error: "CREDENTIALS_INCOMPLETE",
        message: "Access denied. Please complete your Initial Medical Record requirements.",
        credentials_status: status
      });
    }

    req.credentialsStatus = status;
    logger.debug(`[CREDENTIALS] Access granted userId=${userId}, status=${status}, route=${req.path}, ip=${req.ip}`);
    next();

  } catch (error) {
    logger.error(`[CREDENTIALS] Error checking credentials userId=${req.user?.id}, route=${req.path}, ip=${req.ip}, error=${error.message}`);
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: "Failed to verify credentials status."
    });
  }
}

/**
 * Middleware variant that allows specific statuses
 * @param {Array<string>} allowedStatuses - Array of allowed credential statuses
 */
function checkCredentialsStatusWith(allowedStatuses = ['Active']) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        logger.warn(`[CREDENTIALS] Missing user ID route=${req.path}, ip=${req.ip}`);
        return res.status(401).json({
          error: "UNAUTHORIZED",
          message: "User authentication required."
        });
      }

      const sql = `
        SELECT credentials_status 
        FROM active_user_credentials 
        WHERE id = $1
        LIMIT 1;
      `;

      const result = await db.query(sql, [userId]);

      if (!result.rows || result.rows.length === 0) {
        logger.warn(`[CREDENTIALS] Credentials not found userId=${userId}, route=${req.path}, ip=${req.ip}`);
        return res.status(403).json({
          error: "CREDENTIALS_NOT_FOUND",
          message: "User credentials not found."
        });
      }

      const status = result.rows[0].credentials_status;

      if (!allowedStatuses.includes(status)) {
        logger.warn(`[CREDENTIALS] Status not allowed userId=${userId}, required=${allowedStatuses.join(',')}, got=${status}, route=${req.path}, ip=${req.ip}`);
        return res.status(403).json({
          error: "CREDENTIALS_STATUS_NOT_ALLOWED",
          message: `Access denied. Required status: ${allowedStatuses.join(', ')}`,
          credentials_status: status,
          allowed_statuses: allowedStatuses
        });
      }

      req.credentialsStatus = status;
      logger.debug(`[CREDENTIALS] Access granted userId=${userId}, status=${status}, route=${req.path}, ip=${req.ip}`);
      next();

    } catch (error) {
      logger.error(`[CREDENTIALS] Error checking credentials userId=${req.user?.id}, route=${req.path}, ip=${req.ip}, error=${error.message}`);
      return res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to verify credentials status."
      });
    }
  };
}

module.exports = {
  checkCredentialsStatus,
  checkCredentialsStatusWith
};