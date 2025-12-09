// portal.js
function detectPortalFromSubdomain(req) {
  const host = req.get("host") || "";

  if (host.startsWith("staff.")) {
    return "medical";
  }

  return "patient";
}

module.exports = { detectPortalFromSubdomain };
