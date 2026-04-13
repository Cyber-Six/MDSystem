// portal.js
function detectPortalFromSubdomain(req) {
  // Support X-Forwarded-Host for local development portal switching
  const host = req.get("x-forwarded-host") || req.get("host") || "";

  if (host.startsWith("staff.")) {
    return "Medical";
  }

  return "Patient";
}

module.exports = { detectPortalFromSubdomain };
