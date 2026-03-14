import { axiosRequest } from '../../packages-core-adapter';
import { getMockPatients } from './mock-patients';

const SEARCH_PATIENTS = `
  query SearchPatients($searchTerm: String!, $limit: Int) {
    searchPatients(searchTerm: $searchTerm, limit: $limit) {
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
      latest_ticket_id
      latest_status
      latest_scope
      latest_updated_at
    }
  }
`;

function mergePatients(apiPatients, mockPatients) {
  const merged = [];
  const seen = new Set();

  for (const item of [...apiPatients, ...mockPatients]) {
    const key = String(item.identifier || item.id || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

export async function searchPatients(searchTerm) {
  const response = await axiosRequest.post('/emr/medical', {
    query: SEARCH_PATIENTS,
    variables: { searchTerm, limit: 15 },
  });

  if (response.data.errors) {
    throw new Error(response.data.errors[0]?.message || 'Search failed');
  }

  const apiPatients = response.data.data.searchPatients || [];
  return mergePatients(apiPatients, getMockPatients(searchTerm));
}
