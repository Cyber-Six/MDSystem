/**
 * Inventory Patient Search Service
 * 
 * Provides patient search for inventory staff using the /staff/id/* REST endpoints.
 * These endpoints only require jwtProtect("medical") — no EMR permissions needed.
 * 
 * Endpoints used:
 *   GET /staff/id/name/:name/:branch       → { users: [...] }
 *   GET /staff/id/identifier/:id/:branch   → { users: [...] }
 *   GET /staff/id/email?email=&branch=     → { users: [...] }
 */

import { axiosRequest } from '../../../packages-core-adapter';

// ── Search type detection ────────────────────────────────────────────────────

/**
 * Detect the type of search input.
 * @param {string} query
 * @returns {'identifier'|'email'|'name'}
 */
function detectSearchType(query) {
  const trimmed = query.trim();
  if (trimmed.includes('@')) return 'email';
  if (/^[\d\-]+$/.test(trimmed)) return 'identifier';
  return 'name';
}

/**
 * Format a full name as "Last, First MI."
 * @param {string|null} firstName
 * @param {string|null} middleName
 * @param {string|null} lastName
 * @returns {string}
 */
function formatFullName(firstName, middleName, lastName) {
  const last = (lastName || '').trim();
  const first = (firstName || '').trim();
  const mi = middleName ? ` ${middleName.trim()[0].toUpperCase()}.` : '';
  if (last && first) return `${last}, ${first}${mi}`;
  return last || first || 'Unknown';
}

// ── Individual search functions ──────────────────────────────────────────────

async function searchByName(name, branch) {
  const encoded = encodeURIComponent(name.trim());
  const branchParam = encodeURIComponent(branch);
  const response = await axiosRequest.get(`/staff/id/name/${encoded}/${branchParam}`);
  const users = response.data.users || [];
  return users.map((u) => ({
    id: u.id,
    name: formatFullName(u.firstName, u.middleName, u.lastName),
    identifier: u.identifier ?? null,
    email: null,
    searchType: 'name',
    searchQuery: name.trim(),
  }));
}

async function searchByIdentifier(identifier, branch) {
  const encoded = encodeURIComponent(identifier.trim());
  const branchParam = encodeURIComponent(branch);
  const response = await axiosRequest.get(`/staff/id/identifier/${encoded}/${branchParam}`);
  const users = response.data.users || [];
  return users.map((u) => ({
    id: u.id,
    name: formatFullName(u.firstName, u.middleName, u.lastName),
    identifier: u.identifier ?? identifier.trim(),
    email: null,
    searchType: 'identifier',
    searchQuery: identifier.trim(),
  }));
}

async function searchByEmail(email, branch) {
  const response = await axiosRequest.get(`/staff/id/email`, {
    params: { email: email.trim(), branch },
  });
  const users = response.data.users || [];
  return users.map((u) => ({
    id: u.id,
    name: formatFullName(u.firstName, u.middleName, u.lastName),
    identifier: u.identifier ?? null,
    email: u.email ?? email.trim(),
    searchType: 'email',
    searchQuery: email.trim(),
  }));
}

// ── Unified search ───────────────────────────────────────────────────────────

/**
 * Search for patients using staff REST endpoints (no EMR permission required).
 * Auto-detects whether query is a numeric identifier, email, or name.
 *
 * @param {string} query - The search term (name, email, or student/employee ID).
 * @param {string} branch - Staff branch: 'Manila' | 'QuezonCity' | 'Both'.
 * @returns {Promise<Array<{id, name, identifier, email, searchType, searchQuery}>>}
 */
export async function searchPatientsForInventory(query, branch) {
  const trimmed = (query || '').trim();
  if (trimmed.length < 2) return [];

  // branch is required — it must match the staff's own branch in UsersPersonal
  // (verified server-side). Never default to 'Both'; callers must supply it.
  if (!branch) return [];

  const type = detectSearchType(trimmed);

  try {
    switch (type) {
      case 'identifier':
        return await searchByIdentifier(trimmed, branch);
      case 'email':
        return await searchByEmail(trimmed, branch);
      case 'name':
      default:
        return await searchByName(trimmed, branch);
    }
  } catch (err) {
    throw err;
  }
}

/**
 * Format a patient result for display.
 * @param {Object} patient - Result from searchPatientsForInventory
 * @returns {string}
 */
export function formatInventoryPatientLabel(patient) {
  if (patient.identifier) return `ID: ${patient.identifier}`;
  if (patient.email) return patient.email;
  if (patient.searchQuery) return patient.searchQuery;
  return `Patient #${patient.id}`;
}
