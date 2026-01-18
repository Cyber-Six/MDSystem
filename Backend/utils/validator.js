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


function isMedicalEmail(email) {
  const regex = /^[a-z]+(\.[a-z]+)*\.mds@tip\.edu\.ph$/;
  return regex.test(email);
}


function detectRoleFromEmail(email) {
  if (isStudentEmail(email)) return "Student";
  if (isEmployeeEmail(email)) return "Employee";
  if (isMedicalEmail(email)) return "Medical";
  return null;
}

function isValidEmail(email) {
  const regex = /^[^\s@]+@tip\.edu\.ph$/i;
  return regex.test(email);
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

function getStudentBranchFromEmail(email) {
  if (!isStudentEmail(email)) {
    return null; // not a valid student email
  }

  // Extract the first character
  const firstChar = email.charAt(0).toLowerCase();

  if (firstChar === "m") {
    return "Manila";
  } else if (firstChar === "q") {
    return "Quezon City";
  }

  return null; // fallback
}




module.exports = {
  isStudentEmail,
  isEmployeeEmail,
  isMedicalEmail,
  detectRoleFromEmail,
  getStudentBranchFromEmail,
  isValidEmail,
  validatePassword,
  isUserStaff,
};
