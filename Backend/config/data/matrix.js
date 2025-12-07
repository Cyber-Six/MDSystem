const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../.env") });


const rateLimitMatrix = {
  studentAuthentication: {
    ipWindow: Number(process.env.STUDENT_AUTH_RATE_LIMIT_WINDOW) || 60,
    ipMax: Number(process.env.STUDENT_AUTH_RATE_LIMIT_MAX_REQUESTS) || 8,
    emailCooldown: Number(process.env.STUDENT_AUTH_RATE_LIMIT_EMAIL_COOLDOWN) || 900,
    emailMaxAttempts: Number(process.env.STUDENT_AUTH_RATE_LIMIT_EMAIL_ATTEMPTS) || 4
  },

  employeeAuthentication: {
    ipWindow: Number(process.env.EMPLOYEE_AUTH_RATE_LIMIT_WINDOW) || 60,
    ipMax: Number(process.env.EMPLOYEE_AUTH_RATE_LIMIT_MAX_REQUESTS) || 4,
    emailCooldown: Number(process.env.EMPLOYEE_AUTH_RATE_LIMIT_EMAIL_COOLDOWN) || 1200,
    emailMaxAttempts: Number(process.env.EMPLOYEE_AUTH_RATE_LIMIT_EMAIL_ATTEMPTS) || 2
  },

  staffAuthentication: {
    ipWindow: Number(process.env.STAFF_AUTH_RATE_LIMIT_WINDOW) || 60,
    ipMax: Number(process.env.STAFF_AUTH_RATE_LIMIT_MAX_REQUESTS) || 3,
    emailCooldown: Number(process.env.STAFF_AUTH_RATE_LIMIT_EMAIL_COOLDOWN) || 1800,
    emailMaxAttempts: Number(process.env.STAFF_AUTH_RATE_LIMIT_EMAIL_ATTEMPTS) || 2
  },

  genericLimiter: {
    ipWindow: Number(process.env.RATE_LIMIT_WINDOW) || 60,
    ipMax: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 30
  }
};

function mapRoleToProfile(role) {
  switch (role) {
    case "Student":
      return "studentAuthentication";
    case "Employee":
      return "employeeAuthentication";
    case "Staff":
      return "staffAuthentication";
    default:
      return null; // Not an institutional role
  }
}


module.exports = { mapRoleToProfile,  rateLimitMatrix }