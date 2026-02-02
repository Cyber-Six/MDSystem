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
  const regex = /^[^\s@]+@tip\.edu\.ph$/;
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

function normalizeName(name) {
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeNumber(number) {
  // Strip everything except digits
  const digits = number.replace(/\D/g, "");

  // Example: enforce PH country code (+63)
  if (digits.startsWith("0")) {
    return "+63" + digits.slice(1);
  }
  if (!digits.startsWith("+")) {
    return "+" + digits;
  }
  return digits;
}

function generateDomainCodes(names, domain) {
  if (!domain || !Array.isArray(names)) {
    throw new Error("Domain and names array are required");
  }

  return names.map(name => {
    if (!name) throw new Error("Name is required to generate code");

    const normalizedDomain = domain.trim().toLowerCase();
    const normalizedName = String(name).trim().toLowerCase();

    const slugDomain = normalizedDomain.replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const slugName = normalizedName.replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

    const code = `${slugDomain}_${slugName}`;
    return code.substring(0, 50);
  });
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
  normalizeName,
  normalizeNumber,
  generateDomainCodes
};
