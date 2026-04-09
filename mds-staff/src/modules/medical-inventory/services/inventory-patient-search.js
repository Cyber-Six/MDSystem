/**
 * Inventory Patient Search Service
 * 
 * Provides patient search for inventory staff using the /staff/id/* REST endpoints.
 * These endpoints only require jwtProtect("medical") — no EMR permissions needed.
 * 
 * Endpoints used:
 *   GET /staff/id/name/:name/:branch       → { users: [id, ...] }
 *   GET /staff/id/identifier/:id/:branch   → { users: [id, ...] }
 *   GET /staff/id/email/:email/:branch     → { userId: id }
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
  if (/^\d+$/.test(trimmed)) return 'identifier';
  if (trimmed.includes('@')) return 'email';
  return 'name';
}

// ── Individual search functions ──────────────────────────────────────────────

async function searchByName(name, branch) {
  const encoded = encodeURIComponent(name.trim());
  const branchParam = encodeURIComponent(branch);
  const response = await axiosRequest.get(`/staff/id/name/${encoded}/${branchParam}`);
  const userIds = response.data.users || [];
  return userIds.map((id) => ({
    id,
    name: `Patient #${id}`,
    identifier: null,
    email: null,
    searchType: 'name',
    searchQuery: name.trim(),
  }));
}

async function searchByIdentifier(identifier, branch) {
  const encoded = encodeURIComponent(identifier.trim());
  const branchParam = encodeURIComponent(branch);
  const response = await axiosRequest.get(`/staff/id/identifier/${encoded}/${branchParam}`);
  const userIds = response.data.users || [];
  return userIds.map((id) => ({
    id,
    name: `Patient #${id}`,
    identifier: identifier.trim(),
    email: null,
    searchType: 'identifier',
    searchQuery: identifier.trim(),
  }));
}

async function searchByEmail(email, branch) {
  const encoded = encodeURIComponent(email.trim());
  const branchParam = encodeURIComponent(branch);
  const response = await axiosRequest.get(`/staff/id/email/${encoded}/${branchParam}`);
  const userId = response.data.userId;
  if (!userId) return [];
  return [{
    id: userId,
    name: `Patient #${userId}`,
    identifier: null,
    email: email.trim(),
    searchType: 'email',
    searchQuery: email.trim(),
  }];
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
    // 404 = no results found, not an error
    if (err.response?.status === 404) return [];
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
