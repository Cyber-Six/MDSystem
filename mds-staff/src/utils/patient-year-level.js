const YEAR_LEVEL_LABELS = Object.freeze({
  Grade11: 'Grade 11',
  Grade12: 'Grade 12',
  Freshman: 'Freshman',
  Sophomore: 'Sophomore',
  Junior: 'Junior',
  Senior: 'Senior',
  Masteral: 'Masters',
  Doctorate: 'Doctorate',
});

const YEAR_LEVEL_ALIASES = Object.freeze({
  GRADE11: 'Grade11',
  GRADE12: 'Grade12',
  FRESHMAN: 'Freshman',
  FIRST: 'Freshman',
  FIRSTYEAR: 'Freshman',
  YEAR1: 'Freshman',
  '1ST': 'Freshman',
  '1STYEAR': 'Freshman',
  SOPHOMORE: 'Sophomore',
  SECOND: 'Sophomore',
  SECONDYEAR: 'Sophomore',
  YEAR2: 'Sophomore',
  '2ND': 'Sophomore',
  '2NDYEAR': 'Sophomore',
  JUNIOR: 'Junior',
  THIRD: 'Junior',
  THIRDYEAR: 'Junior',
  YEAR3: 'Junior',
  '3RD': 'Junior',
  '3RDYEAR': 'Junior',
  SENIOR: 'Senior',
  FOURTH: 'Senior',
  FOURTHYEAR: 'Senior',
  YEAR4: 'Senior',
  '4TH': 'Senior',
  '4THYEAR': 'Senior',
  MASTERAL: 'Masteral',
  MASTERS: 'Masteral',
  MASTER: 'Masteral',
  DOCTORATE: 'Doctorate',
  DOCTORAL: 'Doctorate',
  PHD: 'Doctorate',
});

function normalizeToken(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase();
}

export function formatStudentYearLevel(year) {
  const raw = String(year || '').trim();
  if (!raw) return '';

  if (YEAR_LEVEL_LABELS[raw]) {
    return YEAR_LEVEL_LABELS[raw];
  }

  const canonical = YEAR_LEVEL_ALIASES[normalizeToken(raw)];
  if (!canonical) return raw;
  return YEAR_LEVEL_LABELS[canonical] || canonical;
}

export function getPatientYearLevelLabel(patient) {
  const profileType = String(patient?.profile_type || '').trim();
  const normalizedProfile = profileType.toLowerCase();

  if (normalizedProfile === 'employee') return 'Employee';
  if (normalizedProfile === 'student') {
    return formatStudentYearLevel(patient?.year) || 'Student';
  }

  return profileType;
}

export function getPatientProfileLabel(patient) {
  const profileType = String(patient?.profile_type || '').trim().toLowerCase();

  if (profileType === 'student') {
    const yearLabel = formatStudentYearLevel(patient?.year);
    if (patient?.program && yearLabel) return `${patient.program} · ${yearLabel}`;
    if (patient?.program) return patient.program;
    return yearLabel || 'Student';
  }

  if (profileType === 'employee') {
    return 'Employee';
  }

  return String(patient?.profile_type || '').trim();
}
