/**
 * Year level display formatting for student profiles.
 * Maps DB enum values (STUDENT_YEAR) to human-readable labels.
 */

export const YEAR_LEVEL_LABELS = Object.freeze({
  Grade11: 'Grade 11',
  Grade12: 'Grade 12',
  Freshman: 'Freshman',
  Sophomore: 'Sophomore',
  Junior: 'Junior',
  Senior: 'Senior',
  Masteral: 'Masters',
  Doctorate: 'Doctorate',
  Transferee: 'Transferee',
  Returnee: 'Returnee',
});

/**
 * Format a STUDENT_YEAR enum value into a readable label.
 * @param {string|null|undefined} year - Raw STUDENT_YEAR value from DB
 * @returns {string|null}
 */
export function formatYearLevel(year) {
  if (!year) return null;
  return YEAR_LEVEL_LABELS[year] || year;
}
