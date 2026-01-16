const jwt = require("jsonwebtoken");

const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { getStaffAnchor } = require("../redis.js"); // adjust import if needed
const { getUserIdentity } = require("../query.js"); // adjust import if needed
const { convertIdentity } = require("../../utils/converter.js"); // if needed
const logger = require("../../utils/logger.js");

function jwtProtect(requiredRole = "patient") {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        error: "TOKEN_REQUIRED",
        message: "Authorization header missing"
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
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

      // 🔍 Role enforcement
      if (requiredRole && role !== requiredRole.toLowerCase()) {
        logger.warn(`Unauthorized role access attempt on userId ${decoded.id}: required=${requiredRole}, got=${role}`);
        return res.status(403).json({
          error: "FORBIDDEN",
          message: "Access denied: role not authorized for this route."
        });
      }

      // 🩺 Extra validation for medical role only
      if (role === "medical") {
        const user = await getUserIdentity(decoded.id);
        user = convertIdentity(user);
        if (!user || user.role.toLowerCase() !== "medical") {
          logger.warn(`Medical role validation failed for userId ${decoded.id}`);
          return res.status(403).json({
            error: "FORBIDDEN",
            message: "Medical role not validated"
          });
        }

        if (!decoded.sid) {
          return res.status(403).json({
            error: "FORBIDDEN",
            message: "Medical role requires a session anchor"
          });
        }

        const activeSession = await getStaffAnchor(decoded.id);
        if (!activeSession || activeSession !== decoded.sid) {
          return res.status(403).json({
            error: "FORBIDDEN",
            message: "Session invalid or expired"
          });
        }
      }

      // ✅ Attach user payload to request for downstream use
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({
        error: "INVALID_TOKEN",
        message: err.message
      });
    }
  };
}
module.exports = jwtProtect;
