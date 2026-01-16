// utils/converter.js

function convertIdentity(identity) {
  if (!identity) return null;

  const normalized = identity.toLowerCase();

  switch (normalized) {
    case "student":
    case "employee":
      return "patient";
    case "medical":
      return "medical";
    default:
      return null; // or "unknown"
  }
}

module.exports = { convertIdentity };
