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

// Keep a generous upper age bound for human profiles while preventing future
// dates and obviously mistyped years from becoming negative or implausible ages.
export const MAX_REALISTIC_AGE = 125;

const formatLocalDate = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');

export function getDateOfBirthBounds(now = new Date()) {
  const maxDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const minDate = new Date(maxDate);
  minDate.setFullYear(minDate.getFullYear() - MAX_REALISTIC_AGE);
  return { min: formatLocalDate(minDate), max: formatLocalDate(maxDate) };
}

export function getDateOfBirthError(value, now = new Date()) {
  if (!value) return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return 'Enter a valid date of birth.';
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime()) || formatLocalDate(parsed) !== value) {
    return 'Enter a valid date of birth.';
  }
  const { min, max } = getDateOfBirthBounds(now);
  if (value > max) return 'Date of birth cannot be in the future.';
  if (value < min) return `Date of birth must be within the last ${MAX_REALISTIC_AGE} years.`;
  return '';
}

export function calculateAgeFromDateOfBirth(value, now = new Date()) {
  if (!value || getDateOfBirthError(value, now)) return '';
  const birthDate = new Date(`${value}T00:00:00`);
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) age--;
  return age;
}

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
