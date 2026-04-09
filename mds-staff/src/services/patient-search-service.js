import { axiosRequest } from '../packages-core-adapter';

// ── GraphQL ─────────────────────────────────────────────────────────────────────
const SEARCH_PATIENTS_QUERY = `
  query SearchPatients($searchTerm: String!, $branch: DesignationBranch, $limit: Int) {
    searchPatients(searchTerm: $searchTerm, branch: $branch, limit: $limit) {
      id
      identifier
      branch
      sex
      first_name
      last_name
      middle_name
      suffix
      profile_type
      program
      year
      department
      role
      credentials_status
      latest_ticket_id
      latest_status
      latest_scope
      latest_updated_at
    }
  }
`;

/**
 * Search patients by name, student/employee ID, or email.
 * @param {string} searchTerm - The text to search for (name / ID / email).
 * @param {number} [limit=15] - Maximum results to return.
 * @param {string} [branch] - Staff branch to scope results ('Manila'|'QuezonCity'|'Both').
 * @returns {Promise<Array>} Array of patient result objects.
 */
export async function searchPatients(searchTerm, limit = 15, branch = null) {
  const response = await axiosRequest.post('/emr/medical', {
    query: SEARCH_PATIENTS_QUERY,
    variables: { searchTerm, limit, branch },
  });
  if (response.data.errors) {
    throw new Error(response.data.errors[0]?.message || 'Search failed');
  }
  return response.data.data.searchPatients || [];
}

// ── Display helpers ─────────────────────────────────────────────────────────────

/** Format patient name as "Last, First M. Suffix" */
export function formatPatientName(patient) {
  if (!patient.last_name && !patient.first_name) return 'Unknown';
  if (!patient.last_name) return patient.first_name;
  return `${patient.last_name}, ${patient.first_name}${
    patient.middle_name ? ' ' + patient.middle_name[0] + '.' : ''
  }${patient.suffix ? ' ' + patient.suffix : ''}`;
}

/** Get uppercase initials from first + last name */
export function getPatientInitials(patient) {
  const f = patient.first_name?.[0] || '';
  const l = patient.last_name?.[0] || '';
  return (f + l).toUpperCase() || '?';
}

/** Get a profile label like "BSIT · 3rd Year" or "HR · Manager" */
export function getProfileLabel(patient) {
  if (patient.profile_type === 'Student')
    return patient.program ? `${patient.program} · ${patient.year || ''}` : 'Student';
  if (patient.profile_type === 'Employee')
    return patient.department ? `${patient.department} · ${patient.role || ''}` : 'Employee';
  return patient.profile_type || '';
}
