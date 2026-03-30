function isUserStaff(status) {
  return status === "Medical";
}

function isStudentEmail(email) {
  const regex = /^[mq][a-z]+[0-9]*@tip\.edu\.ph$/;
  return regex.test(email);
}

// not yet verified
function isEmployeeEmail(email) {
  const regex = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+@tip\.edu\.ph$/;
  return regex.test(email);
}


function isMedicalEmail(email) {
  const regex = /^[a-z][a-z0-9]*(\.([a-z][a-z0-9]*))*\.mds@tip\.edu\.ph$/;
  return regex.test(email);
}

function isSuperiorEmail(email) {
  const regex = /^[a-z][a-z0-9]*(\.([a-z][a-z0-9]*))*\.superior@tip\.edu\.ph$/;
  return regex.test(email);
}

function detectRoleFromEmail(email) {
  if (isStudentEmail(email)) return "Student";
  if (isEmployeeEmail(email)) return "Employee";
  if (isSuperiorEmail(email)) return "Superior";
  if (isMedicalEmail(email)) return "Medical";
  return null;
}

function deduceRoleFromEmail(email) {
  const role = detectRoleFromEmail(email);
  if (!role) return role;
  if (role === "Student") return "Student";
  return "Employee";
}

function PatientRoleFromEmail(email) {
  const role = detectRoleFromEmail(email);
  if (!role) return role;
  if (role === "Medical") return "Employee";
  return role;
}

function isValidEmail(email) {
  const regex = /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*@tip\.edu\.ph$/;
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
    console.log("Email does not match student pattern:", email);
    return null; // not a valid student email
  }

  // Extract the first character
  const firstChar = email.charAt(0).toLowerCase();

  if (firstChar === "m") {
    return "Manila";
  } else if (firstChar === "q") {
    return "QuezonCity";
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

function ValidateBranchbyUserBranch(userBranch, location) {
  const valid =
    (userBranch === "Manila" && ["Arlegui", "Casal"].includes(location)) ||
    (userBranch === "QuezonCity" && location === "QuezonCity") ||
    (userBranch === "Both");

  return valid;
}


module.exports = {
  isStudentEmail,
  isEmployeeEmail,
  isMedicalEmail,
  isSuperiorEmail,
  detectRoleFromEmail,
  deduceRoleFromEmail,
  PatientRoleFromEmail,
  getStudentBranchFromEmail,
  isValidEmail,
  validatePassword,
  isUserStaff,
  normalizeName,
  normalizeNumber,
  generateDomainCodes,
  ValidateBranchbyUserBranch
};
