export const SUPERIOR_DETAILS_DENIED_CUE = 'Not allowed to access Superior records.';

export function isSuperiorPatient(patient) {
  return String(patient?.profile_type || '').toLowerCase() === 'superior';
}

/**
 * Backend access_denied is authoritative when present.
 * Fallback to local permission state when a row has no explicit flag.
 */
export function canExpandPatientDetails(patient, canViewSuperiorDetails) {
  if (!isSuperiorPatient(patient)) return true;

  // Local permission is mandatory for any Superior expansion attempt.
  if (!canViewSuperiorDetails) return false;

  if (typeof patient?.access_denied === 'boolean') {
    return !patient.access_denied;
  }

  return true;
}
