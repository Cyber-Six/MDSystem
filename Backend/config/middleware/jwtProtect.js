const jwt = require("jsonwebtoken");
const logger = require("../../utils/logger.js");
const { getStaffAnchor } = require("../redis.js");
const { isActiveMedicalPersonnel } = require("../query.js");
const { convertIdentity } = require("../../utils/converter.js");
const { required } = require("joi");

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

    const token = authHeader.split(" ")[1];
    if (!token) {
      logger.warn(`[AUTH] Missing Bearer token route=${req.path}, ip=${req.ip}`);
      return res.status(401).json({
        error: "TOKEN_REQUIRED",
        message: "Bearer token missing"
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        audience: "mdsystem-app",
        issuer: "mdsystem-auth",
      });

      const role = decoded.role?.toLowerCase();

      if (decoded.id === undefined || role === undefined) {
        logger.warn(`[AUTH] Incomplete token payload route=${req.path}, ip=${req.ip}`);
        return res.status(401).json({
          error: "INVALID_TOKEN",
          message: "Token payload incomplete"
          });
        }

       // 🔍 Role enforcement
      if (requiredRole && role !== requiredRole.toLowerCase() && requiredRole !== "all") {
        logger.warn(`[AUTH] Role mismatch userId=${decoded.id}, required=${requiredRole}, got=${role}, route=${req.path}, ip=${req.ip}`);
        return res.status(403).json({
          error: "FORBIDDEN",
          message: "Access denied: role not authorized for this route."
        });
      }

      // 🩺 Extra validation for medical role only
      if (role === "medical") {
        // rawUser = ['Student', 'Employee', 'Superior', 'Medical']
        const identity = await isActiveMedicalPersonnel( decoded.id );

        if (!identity) {
          logger.warn(`[AUTH] Medical role validation failed userId=${decoded.id}, route=${req.path}, ip=${req.ip}`);
          return res.status(403).json({
            error: "FORBIDDEN",
            message: "Medical role not validated"
          });
        }

        if (!decoded.sid) {
          logger.warn(`[AUTH] Missing session anchor (sid) userId=${decoded.id}, route=${req.path}, ip=${req.ip}`);
          return res.status(401).json({
            error: "INVALID_SESSION",
            message: "Medical role requires a session anchor"
          });
        }

        const activeSession = await getStaffAnchor(decoded.id);
        if (!activeSession || activeSession !== decoded.sid) {
          logger.warn(`[AUTH] Invalid/expired session userId=${decoded.id}, expectedSid=${activeSession}, providedSid=${decoded.sid}, route=${req.path}, ip=${req.ip}`);
          return res.status(401).json({
            error: "INVALID_SESSION",
            message: "Session invalid or expired — please re‑login"
          });
        }
      }

      // ✅ Attach user payload to request for downstream use
      req.user = decoded;
      logger.debug(`[AUTH] Access granted userId=${decoded.id}, role=${role}, route=${req.path}, ip=${req.ip}`);
      next();
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        logger.warn(`[AUTH] Token expired route=${req.path}, ip=${req.ip}`);
        return res.status(401).json({ error: "TOKEN_EXPIRED", message: "JWT expired" });
      }
      logger.error(`[AUTH] JWT verification failed route=${req.path}, ip=${req.ip}, error=${err.message}`);
      return res.status(401).json({
        error: "INVALID_TOKEN",
        message: err.message
      });
    }
  };
}

module.exports = { jwtProtect };
