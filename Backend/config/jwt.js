const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "SuperSecretKey";

// Generate JWT
function generateToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role }, 
    JWT_SECRET, 
    { expiresIn: "1h" } // adjust expiration
  );
}

// Verify JWT
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function requireRole(token, allowedRoles) {
  const decoded = verifyToken(token);
  if (!decoded) return null; // invalid token

  if (!allowedRoles.includes(decoded.role)) return null; // role not allowed

  return decoded; // valid token & allowed role
}

module.exports = { generateToken, verifyToken, requireRole };
