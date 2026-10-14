const ORAL_APPLIANCE_META_PREFIX = "ORAL_APPLIANCE_META::";

function encodeOralApplianceNotes(notes, { otherDescription, otherArch } = {}) {
  const hasCustomChoice = otherDescription != null || otherArch != null;
  if (!hasCustomChoice) return notes;

  return `${ORAL_APPLIANCE_META_PREFIX}${JSON.stringify({
    notes: notes ?? null,
    otherDescription: otherDescription ?? null,
    otherArch: otherArch ?? null,
  })}`;
}

function decodeOralApplianceNotes(value) {
  if (typeof value !== "string" || !value.startsWith(ORAL_APPLIANCE_META_PREFIX)) {
    return { notes: value ?? null, otherDescription: null, otherArch: null };
  }

  try {
    const stored = JSON.parse(value.slice(ORAL_APPLIANCE_META_PREFIX.length));
    return {
      notes: stored.notes ?? null,
      otherDescription: stored.otherDescription ?? null,
      otherArch: stored.otherArch ?? null,
    };
  } catch {
    return { notes: value, otherDescription: null, otherArch: null };
  }
}

function employeeCategoryFromRole(role, employmentCategoryOther) {
  const custom = String(employmentCategoryOther ?? "").trim();
  if (role === "Other" && custom) return custom;

  const value = String(role ?? "").trim();
  const categoryByRole = {
    NonStaff: "Teaching",
    NonStaffOfficer: "Teaching (Officer)",
    Staff: "Non-Teaching",
    StaffOfficer: "Non-Teaching (Officer)",
  };
  if (categoryByRole[value]) return categoryByRole[value];
  if (["Faculty", "AcademicHead", "Teaching", "Teaching (Officer)", "Non-Teaching", "Non-Teaching (Officer)"].includes(value)) return value;
  return value && value !== "Other" ? value : null;
}

function roleForStorage(role) {
  // The PostgreSQL employeeRole enum cannot contain free-text categories.
  // Keep the canonical enum value in `role`; persist the description in its
  // dedicated text column instead.
  const roleByCategory = {
    Teaching: "NonStaff",
    "Teaching (Officer)": "NonStaffOfficer",
    "Non-Teaching": "Staff",
    "Non-Teaching (Officer)": "StaffOfficer",
  };
  return roleByCategory[role] || role;
}

module.exports = {
  decodeOralApplianceNotes,
  encodeOralApplianceNotes,
  employeeCategoryFromRole,
  roleForStorage,
};
