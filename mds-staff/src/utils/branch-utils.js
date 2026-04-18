/**
 * Maps a staff member's branch to the physical locations they can access.
 *
 * Branch values (stored in UsersPersonal.branch):
 *   'Manila'     → Arlegui, Casal
 *   'QuezonCity' → QuezonCity
 *   'Both'       → all three
 *
 * @param {string|null|undefined} branch
 * @returns {string[]} location names the branch grants access to
 */
export function getLocationsByBranch(branch) {
  switch (branch) {
    case 'Manila':
      return ['Arlegui', 'Casal'];
    case 'QuezonCity':
      return ['QuezonCity'];
    case 'Both':
      return ['Arlegui', 'Casal', 'QuezonCity'];
    default:
      return [];
  }
}

/**
 * Normalize a branch value for user-facing display.
 *
 * @param {string|null|undefined} branch
 * @param {{ fallback?: string|null, includeBothSuffix?: boolean }} [options]
 * @returns {string|null}
 */
export function formatBranchLabel(branch, options = {}) {
  const { fallback = null, includeBothSuffix = false } = options;

  if (branch === null || branch === undefined) {
    return fallback;
  }

  const raw = String(branch).trim();
  if (!raw) {
    return fallback;
  }

  const normalized = raw.toLowerCase().replace(/\s+/g, '');

  if (normalized === 'both') {
    return includeBothSuffix ? 'MLA & QC (Both)' : 'MLA & QC';
  }

  if (normalized === 'quezoncity' || normalized === 'qc') {
    return 'Quezon City';
  }

  if (normalized === 'manila') {
    return 'Manila';
  }

  return raw;
}
