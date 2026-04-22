/**
 * Inventory Patient Search Service
 * 
 * Provides patient search for inventory staff using the /staff/id/search endpoint.
 * Requires only jwtProtect("medical") — no EMR permissions needed.
 * 
 * Endpoint:
 *   GET /staff/id/search?query=&branch=  → { users: [...] }
 */

import { axiosRequest } from '../../../packages-core-adapter';
import { getPatientProfileLabel, getPatientYearLevelLabel } from '../../../utils/patient-year-level';

/**
 * Format a full name as "Last, First MI."
 */
function formatFullName(firstName, middleName, lastName) {
  const last = (lastName || '').trim();
  const first = (firstName || '').trim();
  const mi = middleName ? ` ${middleName.trim()[0].toUpperCase()}.` : '';
  if (last && first) return `${last}, ${first}${mi}`;
  return last || first || 'Unknown';
}

/**
 * Search for patients using the unified staff search endpoint.
 * Matches against name, identifier (ID number), and email simultaneously.
 *
 * @param {string} query - The search term.
 * @param {string} branch - Staff branch: 'Manila' | 'QuezonCity' | 'Both'.
 * @returns {Promise<Array<{id, name, identifier, email}>>}
 */
export async function searchPatientsForInventory(query, branch) {
  const trimmed = (query || '').trim();
  if (trimmed.length < 2) return [];
  if (!branch) return [];

  const response = await axiosRequest.get('/staff/id/search', {
    params: { query: trimmed, branch },
  });

  const users = response.data.users || [];
  return users.map((u) => ({
    id: u.id,
    name: formatFullName(u.firstName, u.middleName, u.lastName),
    identifier: u.identifier ?? null,
    email: u.email ?? null,
    profile_type: u.profile_type ?? null,
    program: u.program ?? null,
    year: u.year ?? null,
    department: u.department ?? null,
    role: u.role ?? null,
    profileLabel: getPatientProfileLabel(u),
    yearLevelLabel: getPatientYearLevelLabel(u),
  }));
}

