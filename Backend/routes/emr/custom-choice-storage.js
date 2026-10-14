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

function employeeCategoryFromRole(role) {
  const value = String(role ?? "").trim();
  const knownRoles = new Set([
    "Faculty", "Staff", "AcademicHead", "Teaching", "Teaching (Officer)",
    "Non-Teaching", "Non-Teaching (Officer)", "Other",
  ]);
  return value && !knownRoles.has(value) ? value : null;
}

function roleForStorage(role, employmentCategoryOther) {
  const custom = String(employmentCategoryOther ?? "").trim();
  return role === "Other" && custom ? custom : role;
}

module.exports = {
  decodeOralApplianceNotes,
  encodeOralApplianceNotes,
  employeeCategoryFromRole,
  roleForStorage,
};
