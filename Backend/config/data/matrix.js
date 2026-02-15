const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../.env") });


const rateLimitMatrix = {
  PatientAuthentication: {
    ipWindow: Number(process.env.PATIENT_AUTH_RATE_LIMIT_WINDOW) || 60,
    ipMax: Number(process.env.PATIENT_AUTH_RATE_LIMIT_MAX_REQUESTS) || 8,
    emailCooldown_2fa: Number(process.env.PATIENT_EMAIL_COOLDOWN_2FA) || 30, // seconds
    emailAttemptMax_2fa: Number(process.env.PATIENT_EMAIL_ATTEMPTS_2FA) || 2,
    emailCooldown_emailv: Number(process.env.PATIENT_EMAIL_COOLDOWN_EMAILV) || 30,
    emailAttemptMax_emailv: Number(process.env.PATIENT_EMAIL_ATTEMPTS_EMAILV) || 2, // seconds

    emailCooldown_resetpw: Number(process.env.GENERIC_EMAIL_COOLDOWN_RESETPW) || 30,
    emailAttemptMax_resetpw: Number(process.env.GENERIC_EMAIL_ATTEMPTS_RESETPW) || 2,
    penaltyCooldown_resetpw: Number(process.env.GENERIC_PENALTY_COOLDOWN_RESETPW) || 300,
    },

  staffAuthentication: {
    ipWindow: Number(process.env.STAFF_AUTH_RATE_LIMIT_WINDOW) || 60,
    ipMax: Number(process.env.STAFF_AUTH_RATE_LIMIT_MAX_REQUESTS) || 3,
    emailCooldown_2fa: Number(process.env.STAFF_EMAIL_COOLDOWN_2FA) || 30, // seconds
    emailAttemptMax_2fa: Number(process.env.STAFF_EMAIL_ATTEMPTS_2FA) || 2,
    emailCooldown_emailv: Number(process.env.STAFF_EMAIL_COOLDOWN_EMAILV) || 30,
    emailAttemptMax_emailv: Number(process.env.STAFF_EMAIL_ATTEMPTS_EMAILV) || 2, // seconds

    emailCooldown_resetpw: Number(process.env.GENERIC_EMAIL_COOLDOWN_RESETPW) || 30,
    emailAttemptMax_resetpw: Number(process.env.GENERIC_EMAIL_ATTEMPTS_RESETPW) || 2,
    penaltyCooldown_resetpw: Number(process.env.GENERIC_PENALTY_COOLDOWN_RESETPW) || 300,

  },

  genericLimiter: {
    ipWindow: Number(process.env.GENERIC_ROUTE_RATE_LIMIT_WINDOW) || 60,
    ipMax: Number(process.env.GENERIC_ROUTE_RATE_LIMIT_MAX_REQUESTS) || 30
  }
};

function mapRoleToProfile(role) {
  switch (role) {
    case "Student":
      return "PatientAuthentication";
    case "Employee":
      return "PatientAuthentication";
    case "Superior": // superior is stricted as staff
      return "staffAuthentication";
    case "Medical":
      return "staffAuthentication";
    default:
      return null; // Not an institutional role
  }
}


module.exports = { mapRoleToProfile,  rateLimitMatrix }