// Keep profile limits aligned with Backend/routes/profile/personal-input.js
// and the EmployeeProfile and EmergencyNumber column widths.
export const personalInfoLimits = Object.freeze({
  surname: 50,
  firstName: 50,
  middleName: 50,
  suffix: 10,
  nationality: 50,
  religion: 50,
  contactNumber: 15,
  address: 10000,
  provinceAddress: 10000,
  department: 50,
  position: 50,
});

const profileLabels = {
  surname: 'Surname', firstName: 'First name', middleName: 'Middle name',
  suffix: 'Suffix', nationality: 'Nationality', religion: 'Religion',
  contactNumber: 'Contact number', address: 'Present address', provinceAddress: 'Province address',
};

export function getPersonalInfoLengthErrors(info, { includeProfile = true, isEmployee = false } = {}) {
  const labels = {
    ...(includeProfile ? profileLabels : {}),
    ...(isEmployee ? { department: 'Department', position: 'Position' } : {}),
  };
  const errors = [];
  for (const [field, label] of Object.entries(labels)) {
    const limit = personalInfoLimits[field];
    if ([...(info[field] ?? '')].length > limit) {
      errors.push({ field, message: label + ' must be at most ' + limit + ' characters' });
    }
  }

  for (const [index, contact] of (info.emergencyContacts ?? []).entries()) {
    if ([...(contact?.contactNumber ?? '')].length > personalInfoLimits.contactNumber) {
      errors.push({
        field: 'emergencyContact' + (index + 1) + 'ContactNumber',
        message: 'Emergency contact ' + (index + 1) + ' number must be at most 15 characters',
      });
    }
  }
  return errors;
}
