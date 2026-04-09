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
