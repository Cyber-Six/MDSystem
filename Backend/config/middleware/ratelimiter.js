const { rateLimitIP } = require("../redis.js");
const { detectRoleFromEmail } = require("../../utils/validator.js");
const { mapRoleToProfile, rateLimitMatrix } = require("../data/matrix.js");
const { detectPortalFromSubdomain } = require("../../utils/portal.js");

const logger = require('../../utils/logger.js');

function ipRateLimiter(profileName="genericLimiter", route = "r") {
  const profile = rateLimitMatrix[profileName];
  if (!profile) throw new Error(`Rate limit profile "${profileName}" does not exist.`);

  const { ipWindow, ipMax } = profile;

  return async function (req, res, next) {
    const ip = req.ip;

    const ipBlocked = await rateLimitIP(ip, route, ipMax, ipWindow);
    if (ipBlocked) {
      return res.status(429).json({
        error: "RATE_LIMITED",
        message: "Too many requests. Please slow down."
      });
    }

    next();
  };
}


function roleBasedIpRateLimiter(route = "r") {
  return function (req, res, next) {
    const email = req.body?.email;

    // If no email yet, skip — validation will handle it
    if (!email) return next();

    const role = detectRoleFromEmail(email);
    const profileName = mapRoleToProfile(role);

    // If role is not Student/Employee/Staff → skip limiter
    if (!profileName) return next();

    // Apply the correct IP limiter
    return ipRateLimiter(profileName, route)(req, res, next);
  };
}

function portalBasedIpRateLimiter(route = "r") {
  return function (req, res, next) {
    const portal = detectPortalFromSubdomain(req);
    logger.debug("Applying portalBasedIpRateLimiter middleware");

    const profileName = portal === "patient" ? "PatientAuthentication" : "staffAuthentication";

    // Apply the correct IP limiter
    return ipRateLimiter(profileName, route)(req, res, next);
  };
}


module.exports = { ipRateLimiter, roleBasedIpRateLimiter, portalBasedIpRateLimiter };
