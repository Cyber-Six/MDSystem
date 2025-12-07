
const USER_STATUS = ["Student", "Employee", "Medical"];

function isUserStaff(status) {
  return status === "Medical";
}

function isStudentEmail(email) {
  const regex = /^[mq][a-z]+[0-9]*@tip\.edu\.ph$/;
  return regex.test(email);
}

// not yet verified
function isEmployeeEmail(email) {
  const regex = /^[a-z]+(\.[a-z]+)+@tip\.edu\.ph$/;
  return regex.test(email);
}

function detectRoleFromEmail(email) {
  if (isStudentEmail(email)) return "Student";
  if (isEmployeeEmail(email)) return "Employee";
  return null;
}

function validatePassword(password) {
  if (typeof password !== "string") return false;

  // Basic length rule
  if (password.length < 8 || password.length > 64) {
    return false;
  }

  // Optional: add more rules later if needed
  return true;
}




module.exports = {
  USER_STATUS,
  isStudentEmail,
  isEmployeeEmail,
  detectRoleFromEmail,
  validatePassword,
  isUserStaff,
};
