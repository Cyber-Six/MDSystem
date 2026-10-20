const jwt = require("jsonwebtoken");
const logger = require("../../utils/logger.js");
const { getStaffAnchor, getSessionBlacklist } = require("../redis.js");
const { isActiveMedicalPersonnel } = require("../query.js");
const { isValidUserId } = require("../../utils/access-token-session");
const { assertAccountAllowed } = require("../../utils/authentication-state");

function jwtProtect(requiredRole = "patient") {
  return async (req, res, next) => {
    logger.debug(`[AUTH] Request entered jwtProtect route=${req.path}, ip=${req.ip}`);

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      logger.warn(`[AUTH] Missing Authorization header route=${req.path}, ip=${req.ip}`);
      return res.status(401).json({
        error: "TOKEN_REQUIRED",
        message: "Authorization header missing"
      });
    }

    const token = typeof authHeader === "string" ? /^Bearer ([^\s]+)$/i.exec(authHeader)?.[1] : null;
    if (!token) {
      logger.warn(`[AUTH] Missing Bearer token route=${req.path}, ip=${req.ip}`);
      return res.status(401).json({
        error: "TOKEN_REQUIRED",
        message: "Bearer token missing"
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"],
        audience: "mdsystem-app",
        issuer: "mdsystem-auth",
      });

      if (decoded.jti){
        const isBlacklisted = await getSessionBlacklist(decoded.jti);
        if (isBlacklisted) {
          logger.warn(`[AUTH] Token blacklisted jti=${decoded.jti}, route=${req.path}, ip=${req.ip}`);
          return res.status(401).json({
            error: "TOKEN_INVALID",
            message: "Token has been revoked"
          });
        }
      }
      const role = typeof decoded.role === "string" ? decoded.role.toLowerCase() : undefined;

      if (!isValidUserId(decoded.id) || role === undefined) {
        logger.warn(`[AUTH] Incomplete token payload route=${req.path}, ip=${req.ip}`);
        return res.status(401).json({
          error: "INVALID_TOKEN",
          message: "Token payload incomplete"
          });
        }

       // 🔍 Role enforcement
      if (!["patient", "medical"].includes(role) || (requiredRole && role !== requiredRole.toLowerCase() && requiredRole !== "all")) {
        logger.warn(`[AUTH] Role mismatch userId=${decoded.id}, required=${requiredRole}, got=${role}, route=${req.path}, ip=${req.ip}`);
        return res.status(403).json({
          error: "FORBIDDEN",
          message: "Access denied: role not authorized for this route."
        });
      }

      // 🩺 Extra validation for medical role only
      if (role === "medical") {
        if (!decoded.sid) {
          logger.warn(`[AUTH] Missing session anchor (sid) userId=${decoded.id}, route=${req.path}, ip=${req.ip}`);
          return res.status(401).json({
            error: "INVALID_SESSION",
            message: "Medical role requires a session anchor"
          });
        }

        const activeSession = await getStaffAnchor(decoded.id);
        if (!activeSession || activeSession !== decoded.sid) {
          logger.warn(`[AUTH] Invalid/expired session userId=${decoded.id}, route=${req.path}, ip=${req.ip}`);
          return res.status(401).json({
            error: "INVALID_SESSION",
            message: "Session invalid or expired — please re-login"
          });
        }

        const identity = await isActiveMedicalPersonnel( decoded.id );

        if (!identity) {
          logger.warn(`[AUTH] Medical role validation failed userId=${decoded.id}, route=${req.path}, ip=${req.ip}`);
          return res.status(403).json({
            error: "FORBIDDEN",
            message: "Medical role not validated"
          });
        }
      }

      await assertAccountAllowed(decoded.id);

      // ✅ Attach user payload to request for downstream use
      req.user = { ...decoded, role };
      logger.debug(`[AUTH] Access granted userId=${decoded.id}, role=${role}, route=${req.path}, ip=${req.ip}`);
      next();
    } catch (err) {
      if (err.message === 'Account locked' || err.message === 'Account unavailable') {
        return res.status(403).json({ error: 'ACCOUNT_UNAVAILABLE', message: 'Account access is unavailable.' });
      }
      if (err.name === "TokenExpiredError") {
        logger.warn(`[AUTH] Token expired route=${req.path}, ip=${req.ip}`);
        return res.status(401).json({ error: "TOKEN_EXPIRED", message: "JWT expired" });
      }
      logger.error(`[AUTH] JWT verification failed route=${req.path}, ip=${req.ip}, error=${err.message}`);
      return res.status(401).json({
        error: "INVALID_TOKEN",
        message: "Token is invalid or could not be verified"
      });
    }
  };
}

module.exports = { jwtProtect };
