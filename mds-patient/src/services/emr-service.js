/**
 * EMR Service - Handles all GraphQL mutations and queries for EMR data
 */

import { completeCatalogPages } from './catalog-pages';
import { axiosRequest } from '../packages-core-adapter';
import { sendGraphQLRequest } from '../utils/graphql-client';
import { shouldRequireInitialRecordFromTicketStatus } from './record-status-utils';

/**
 * Fetch the current update ticket (id + status) without throwing.
 * Returns null if no ticket exists.
 */
const fetchCurrentUpdateTicket = async () => {
  const query = `
    query GetCurrentUpdateTicket {
      getUpdateTicket { id status scope }
    }
  `;
  try {
    const data = await sendGraphQLRequest(query, {});
    return data.getUpdateTicket ?? null;
  } catch {
    return null;
  }
};

/**
 * Create an update ticket (required before making any profile mutations)
 * @param {string} scope - 'Medical', 'Dental', or 'Both'
 */
const createUpdateTicket = async (scope = 'Both') => {
  console.log('[EMR Service] Creating update ticket with scope:', scope);
  
  const mutation = `
    mutation CreateUpdateTicket($scope: UpdateScope!) {
      createUpdateTicket(scope: $scope)
    }
  `;
  
  try {
    const data = await sendGraphQLRequest(mutation, { scope });
    console.log('[EMR Service] Update ticket created:', data.createUpdateTicket);
    return data.createUpdateTicket;
  } catch (error) {
    const isStaleTicket = error.message?.toLowerCase().includes('already in progress');
    if (isStaleTicket) {
      // Inspect the existing ticket before deciding what to do
      const existing = await fetchCurrentUpdateTicket();

      // Revision tickets are valid for all create mutations — reuse the existing ID
      // (cancelUpdateTicket only allows InProgress/Pending, so we cannot cancel it)
      if (existing?.status === 'Revision') {
        console.log('[EMR Service] Existing ticket is in Revision — reusing ticket id:', existing.id);
        return existing.id;
      }

      // For InProgress/Pending stale tickets — cancel and create a fresh one
      console.warn('[EMR Service] Stale update ticket detected — cancelling and retrying...');
      await cancelUpdateTicket();
      const retryData = await sendGraphQLRequest(mutation, { scope });
      console.log('[EMR Service] Update ticket created (after stale-ticket recovery):', retryData.createUpdateTicket);
      return retryData.createUpdateTicket;
    }
    throw error;
  }
};

/**
 * Submit the update ticket to finalize all changes
 */
const submitUpdateTicket = async () => {
  console.log('[EMR Service] Submitting update ticket...');
  
  const mutation = `
    mutation SubmitUpdateTicket {
      submitUpdateTicket
    }
  `;
  
  try {
    const data = await sendGraphQLRequest(mutation, {});
    console.log('[EMR Service] Update ticket submitted:', data.submitUpdateTicket);
    return data.submitUpdateTicket;
  } catch (error) {
    // Enhanced error message for backend team
    if (error.message && error.message.includes('Required records are missing')) {
      console.error('[EMR Service] ❌ BACKEND VALIDATION ERROR FOR INITIAL PATIENT RECORDS');
      console.error('[EMR Service] The backend is requiring staff-only records that patients cannot create:');
      console.error('[EMR Service] - VitalSigns: Only staff can measure blood pressure, heart rate, temperature');
      console.error('[EMR Service] - VisualAcuity: Requires catalog ID from eye chart tests + has null bug');
      console.error('[EMR Service] - DentalPhotoRecord: Requires photo UUIDs (staff takes photos)');
      console.error('[EMR Service] - DentalRecord: Requires tooth placements and oral findings (staff examination)');
      console.error('[EMR Service] - ObGynHistory: Required for males (should only validate for females)');
      console.error('[EMR Service]');
      console.error('[EMR Service] BACKEND TEAM ACTION REQUIRED:');
      console.error('[EMR Service] 1. Make validation optional for initial patient submissions (scope="Both")');
      console.error('[EMR Service] 2. Or create separate Medical/Dental scopes for patient initial records');
      console.error('[EMR Service] 3. Or auto-create empty staff records when patient submits');
      console.error('[EMR Service] 4. Fix ObGynHistory to only validate for female patients');
      console.error('[EMR Service] 5. Fix VisualAcuity null handling bug in createVisualAcuityProfile resolver');
    }
    throw error;
  }
};

/**
 * Cancel the update ticket (in case of errors)
 */
const cancelUpdateTicket = async () => {
  console.log('[EMR Service] Cancelling update ticket...');
  
  const mutation = `
    mutation CancelUpdateTicket {
      cancelUpdateTicket
    }
  `;
  
  try {
    const data = await sendGraphQLRequest(mutation, {});
    console.log('[EMR Service] Update ticket cancelled:', data.cancelUpdateTicket);
    return data.cancelUpdateTicket;
  } catch (error) {
    console.warn('[EMR Service] Failed to cancel update ticket:', error.message);
    return null;
  }
};

/**
 * Cancel the personal record log (in case of errors during initial submission)
 * This must be called when initial profile creation succeeds but a later step fails,
 * to prevent the "An update is already in progress" error on retry.
 */
const cancelPersonalRecordLog = async () => {
  console.log('[EMR Service] Cancelling personal record log...');

  const mutation = `
    mutation CancelPersonalRecordLog {
      cancelPersonalRecordLog
    }
  `;

  try {
    const data = await sendGraphQLRequest(mutation, {}, { endpoint: '/profile/patient' });
    console.log('[EMR Service] Personal record log cancelled:', data.cancelPersonalRecordLog);
    return data.cancelPersonalRecordLog;
  } catch (error) {
    console.warn('[EMR Service] Failed to cancel personal record log:', error.message);
    return null;
  }
};

/**
 * Create a complete initial medical record
 * OPTIMIZED: Batches all create mutations into a single GraphQL request
 * reducing ~17 sequential HTTP calls down to 3 (ticket + batch + submit)
 */
/**
 * Upload a file to the media staging REST API
 * @param {File|null} file - Browser File object (from an <input type="file">)
 * @returns {Promise<string|null>} Staged fileId UUID returned by the REST API, or null if no file provided
 */
const uploadMediaFile = async (file) => {
  if (!file) return null;

  const body = new FormData();
  body.append('file', file);

  try {
    const response = await axiosRequest.post('/media/stage/', body, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    console.log('[EMR Service] Media file staged, fileId:', response.data.fileId);
    return response.data.fileId;
  } catch (error) {
    console.error('[EMR Service] Failed to stage media file:', error.message);
    throw error;
  }
};

/**
 * Delete a previously staged media file to free the per-user staging quota
 * @param {string|null} fileId - UUID returned by uploadMediaFile
 */
const unstageMediaFile = async (fileId) => {
  if (!fileId) return;
  try {
    await axiosRequest.delete(`/media/unstage/${fileId}`);
    console.log('[EMR Service] Staged media file removed, fileId:', fileId);
  } catch (error) {
    // Non-fatal — staging TTL will eventually free the slot
    console.warn('[EMR Service] Failed to remove staged media file:', fileId, error.message);
  }
};

/**
 * Register the patient's branch by setting their student/employee ID (identifier).
 * This populates UsersPersonal.branch (derived from email prefix: m→Manila, q→QuezonCity)
 * so staff can filter tickets by branch.
 *
 * Endpoint: POST /profile/patient  (JWT guard: patient)
 * Only succeeds for unverified users — silently ignored if already set.
 *
 * @param {string} identifier - Student/employee number (e.g. "2022-12345")
 */
const registerBranchIdentifier = async (identifier) => {
  if (!identifier?.trim()) return;
  const mutation = `
    mutation CreateBranchIdentifier($input: BranchIdentifierInput!) {
      createBranchIdentifier(input: $input) {
        branch
        identifier
      }
    }
  `;
  try {
    const result = await sendGraphQLRequest(mutation, { input: { identifier: identifier.trim() } }, { endpoint: '/profile/patient' });
    console.log('[EMR Service] Branch identifier registered:', identifier, '→ branch:', result?.createBranchIdentifier?.branch);
  } catch (error) {
    // Non-fatal: user may already be verified (re-submission) or branch already set.
    console.warn('[EMR Service] Branch identifier not set (may already exist):', error.message);
  }
};

/**
 * Register initial profile using the reworked createInitialPersonalRecord mutation.
 * This single mutation atomically creates the personal record log AND sets the
 * branch identifier, replacing the old compound approach that called
 * createBranchIdentifier + createPersonalRecordLog separately.
 *
 * Used by unverified patients for both initial submissions and requested revisions.
 *
 * @param {string} identifier - Student/employee number (e.g. "2022-12345")
 * @param {object} personalInfo - formData.personalInfo
 * @param {object} [options]
 * @param {string} [options.branch] - Explicit branch for employees; students have it auto-detected by backend
 */
const registerInitialProfile = async (identifier, personalInfo, { branch } = {}) => {
  const pi = personalInfo || {};

  const input = {
    first_name:       pi.firstName?.trim()        || '',
    middle_name:      pi.middleName?.trim()       || '',
    last_name:        pi.surname?.trim()          || '',
    suffix:           pi.suffix?.trim()           || null,
    date_of_birth:    pi.birthday                 || null,
    sex:              pi.gender                   || null,
    civil_status:     pi.civilStatus              || null,
    nationality:      pi.nationality?.trim()      || '',
    religion:         pi.religion?.trim()         || '',
    contactNumber:    pi.contactNumber?.trim()    || '',
    present_address:  pi.address?.trim()          || '',
    province_address: pi.provinceAddress?.trim()  || pi.address?.trim() || '',
    branch:           branch                      || 'Manila', // Backend overrides for students based on email
    identifier:       identifier?.trim()          || '',
  };

  const mutation = `
    mutation CreateInitialPersonalRecord($input: userProfileInitialInput!) {
      createInitialPersonalRecord(input: $input) {
        first_name
        last_name
        branch
        identifier
      }
    }
  `;

  try {
    const result = await sendGraphQLRequest(mutation, { input }, { endpoint: '/profile/patient' });
    console.log('[EMR Service] Initial profile created:', {
      name: `${result?.createInitialPersonalRecord?.first_name} ${result?.createInitialPersonalRecord?.last_name}`,
      branch: result?.createInitialPersonalRecord?.branch,
      identifier: result?.createInitialPersonalRecord?.identifier,
    });
    return result;
  } catch (error) {
    console.error('[EMR Service] Failed to create initial profile:', error);
    throw error;
  }
};

export const createInitialMedicalRecord = async (formData, { isRevision = false } = {}) => {
  console.log('[EMR Service] Starting initial medical record creation (batched)', isRevision ? '(revision)' : '(new)');
  console.log('[EMR Service] Form data received:', formData);

  let ticketCreated = false;
  // profileLogCreated tracks whether a NEW log was created (not an update).
  // For revisions we update the existing log, so cleanup on error is not needed.
  let profileLogCreated = false;
  // Track staged file IDs so they can be cleaned up if the submission fails
  let upperTeethFileId = null;
  let lowerTeethFileId = null;

  try {
    const results = {};

    // ======== REQUEST 1: Profile setup (branch identifier + personal info) ========
    // The profile endpoint updates the existing personal log during a revision.
    await registerInitialProfile(formData.personalInfo?.studentNumber, formData.personalInfo);
    profileLogCreated = !isRevision;

    // ======== REQUEST 2 (parallel): Resolve ticket + upload dental photos ========
    // For revisions: pre-fetch the existing Revision ticket to avoid a 400 from
    // createUpdateTicket, then reuse its ID directly.
    // For new submissions: createUpdateTicket and both photo uploads fire together.
    console.log('[EMR Service] [2/3] Creating ticket & uploading photos (parallel)...');

    let ticketPromise;
    if (isRevision) {
      const existing = await fetchCurrentUpdateTicket();
      if (existing?.status !== 'Revision') throw new Error('This ticket is no longer open for revision.');
      ticketPromise = Promise.resolve(existing.id);
    } else {
      // Resume an existing draft when the patient submits.
      const existing = await fetchCurrentUpdateTicket();
      if (existing?.id && existing.status === 'InProgress') {
        console.log('[EMR Service] Reusing early-created ticket:', existing.id);
        ticketPromise = Promise.resolve(existing.id);
      } else {
        ticketPromise = createUpdateTicket('Both');
      }
    }

    const [ticketResult, upperResult, lowerResult] = await Promise.allSettled([
      ticketPromise,
      uploadMediaFile(formData.dentalHistory?.upperTeethPhoto?.file ?? null),
      uploadMediaFile(formData.dentalHistory?.lowerTeethPhoto?.file ?? null),
    ]);

    // Capture partial results so cleanup always works even if one operation fails
    // For revisions reusing an existing ticket, ticketCreated stays false so we
    // don't cancel the revision ticket if a later step fails.
    if (ticketResult.status === 'fulfilled') {
      if (!isRevision) ticketCreated = true;
      results.ticketId = ticketResult.value;
    }
    upperTeethFileId = upperResult.status === 'fulfilled' ? upperResult.value : null;
    lowerTeethFileId = lowerResult.status === 'fulfilled' ? lowerResult.value : null;

    // Re-throw the first failure (cleanup in catch will now have correct state)
    const parallelError = [ticketResult, upperResult, lowerResult].find(r => r.status === 'rejected');
    if (parallelError) throw parallelError.reason;

    console.log('[EMR Service] Ticket + photos ready:', { ticketId: results.ticketId, upperTeethFileId, lowerTeethFileId });

    // ======== REQUEST 3: Batch all create mutations + submit in one request ========
    // submitUpdateTicket is appended as the last field in the same mutation document
    // so the server processes it after all creates complete (GraphQL serial execution).
    console.log('[EMR Service] [3/3] Fetching all catalogs & sending batched mutations...');
    const allCatalogs = await fetchAllCatalogs();
    const inputs = buildBatchInputs(formData, { upperTeethFileId, lowerTeethFileId }, allCatalogs);
    const batchResult = await sendBatchedCreateMutations(inputs, formData);
    Object.assign(results, batchResult);
    results.submitStatus = batchResult.submitTicket;
    console.log('[EMR Service] Initial medical record creation completed successfully');
    return { success: true, data: results };

  } catch (error) {
    console.error('[EMR Service] Failed to create initial medical record:', error);

    // Clean up any staged media files to free the per-user staging quota
    if (upperTeethFileId || lowerTeethFileId) {
      console.log('[EMR Service] Cleaning up staged media files...');
      await Promise.all([
        unstageMediaFile(upperTeethFileId),
        unstageMediaFile(lowerTeethFileId),
      ]);
    }

    // Cancel the EMR update ticket so a retry can create a fresh one
    if (ticketCreated) {
      console.log('[EMR Service] Attempting to cancel update ticket due to error...');
      await cancelUpdateTicket();
    }

    // Cancel the profile record log so a retry is not blocked by the
    // "An update is already in progress" guard on createPersonalRecordLog
    if (profileLogCreated) {
      console.log('[EMR Service] Attempting to cancel personal record log due to error...');
      await cancelPersonalRecordLog();
    }

    throw error;
  }
};

// ─── Catalog Fetchers ────────────────────────────────────────────────────────

/**
 * Create a complete initial medical record for an employee
 * Same 3-phase flow as createInitialMedicalRecord but uses employeeId as identifier
 */
export const createInitialEmployeeRecord = async (formData, { isRevision = false } = {}) => {
  console.log('[EMR Service] Starting initial EMPLOYEE medical record creation (batched)', isRevision ? '(revision)' : '(new)');

  let ticketCreated = false;
  let profileLogCreated = false;
  let upperTeethFileId = null;
  let lowerTeethFileId = null;

  try {
    const results = {};

    // ======== REQUEST 1: Profile setup (branch identifier + personal info) ========
    // The profile endpoint updates the existing personal log during a revision.
    await registerInitialProfile(formData.personalInfo?.employeeId, formData.personalInfo, { branch: formData.personalInfo?.branch });
    profileLogCreated = !isRevision;

    // ======== REQUEST 2 (parallel): Create ticket + upload dental photos ========
    // For revisions: pre-fetch and reuse the existing Revision ticket when present.
    // For new submissions: create/reuse the active InProgress ticket.
    console.log('[EMR Service] [2/3] Creating ticket & uploading photos (parallel)...');

    let ticketPromise;
    if (isRevision) {
      const existing = await fetchCurrentUpdateTicket();
      if (existing?.status !== 'Revision') throw new Error('This ticket is no longer open for revision.');
      ticketPromise = Promise.resolve(existing.id);
    } else {
      const existing = await fetchCurrentUpdateTicket();
      if (existing?.id && existing.status === 'InProgress') {
        console.log('[EMR Service] Employee flow reusing early-created ticket:', existing.id);
        ticketPromise = Promise.resolve(existing.id);
      } else {
        ticketPromise = createUpdateTicket('Both');
      }
    }

    const [ticketResult, upperResult, lowerResult] = await Promise.allSettled([
      ticketPromise,
      uploadMediaFile(formData.dentalHistory?.upperTeethPhoto?.file ?? null),
      uploadMediaFile(formData.dentalHistory?.lowerTeethPhoto?.file ?? null),
    ]);

    if (ticketResult.status === 'fulfilled') {
      if (!isRevision) ticketCreated = true;
      results.ticketId = ticketResult.value;
    }
    upperTeethFileId = upperResult.status === 'fulfilled' ? upperResult.value : null;
    lowerTeethFileId = lowerResult.status === 'fulfilled' ? lowerResult.value : null;

    const parallelError = [ticketResult, upperResult, lowerResult].find(r => r.status === 'rejected');
    if (parallelError) throw parallelError.reason;

    console.log('[EMR Service] Ticket + photos ready:', { ticketId: results.ticketId, upperTeethFileId, lowerTeethFileId });

    // ======== REQUEST 3: Batch all create mutations + submit in one request ========
    console.log('[EMR Service] [3/3] Fetching all catalogs & sending batched mutations...');
    const allCatalogs = await fetchAllCatalogs();
    const inputs = buildBatchInputs(formData, { upperTeethFileId, lowerTeethFileId }, allCatalogs);
    const batchResult = await sendBatchedCreateMutations(inputs, formData);
    Object.assign(results, batchResult);
    results.submitStatus = batchResult.submitTicket;
    console.log('[EMR Service] Initial employee medical record creation completed successfully');
    return { success: true, data: results };

  } catch (error) {
    console.error('[EMR Service] Failed to create initial employee medical record:', error);

    if (upperTeethFileId || lowerTeethFileId) {
      console.log('[EMR Service] Cleaning up staged media files...');
      await Promise.all([
        unstageMediaFile(upperTeethFileId),
        unstageMediaFile(lowerTeethFileId),
      ]);
    }

    if (ticketCreated) {
      console.log('[EMR Service] Attempting to cancel update ticket due to error...');
      await cancelUpdateTicket();
    }

    if (profileLogCreated) {
      console.log('[EMR Service] Attempting to cancel personal record log due to error...');
      await cancelPersonalRecordLog();
    }

    throw error;
  }
};

/**
 * Fetch ALL catalogs needed to render the initial-record form in a SINGLE HTTP request.
 * Uses GraphQL field aliases to combine all 7 catalog queries into one round-trip,
 * reducing network overhead from 7 calls to 1.
 * Exported so form components can load options before the patient submits.
 * Gracefully degrades — any resolver failure returns empty arrays for that catalog.
 */
export const fetchAllCatalogs = async () => {
  const query = `
    query FetchAllCatalogs {
      medicalConditionCatalog: getDomainCatalogs(domain: MedicalCondition, limit: 200) {
        id
        code
        name
      }
      hospitalizationCatalog: getDomainCatalogs(domain: Hospitalization, limit: 200) {
        id
        code
        name
      }
      operationCatalog: getDomainCatalogs(domain: Operation, limit: 200) {
        id
        code
        name
      }
      medicationCatalog: getDomainCatalogs(domain: Medication, limit: 200) {
        id
        code
        name
      }
      immunizationCatalog: getDomainCatalogs(domain: Immunization, limit: 200) {
        id
        code
        name
      }
      allergenCatalog: getAllergenCatalogs(limit: 200) {
        id
        allergen
        type
      }
      oralApplianceCatalog: getOralApplianceCatalogs(limit: 200) {
        id
        name
        description
      }
      visualAcuityCatalog: getDomainCatalogs(domain: VisualAcuity, limit: 200) {
        id
        code
        name
      }
      dentalProcedureCatalog: getDomainCatalogs(domain: DentalProcedure, limit: 200) {
        id
        code
        name
      }
    }
  `;
  try {
    const data = await sendGraphQLRequest(query, {});
    await completeCatalogPages(data, { medicalConditionCatalog: 'getDomainCatalogs(domain: MedicalCondition,', hospitalizationCatalog: 'getDomainCatalogs(domain: Hospitalization,', operationCatalog: 'getDomainCatalogs(domain: Operation,', medicationCatalog: 'getDomainCatalogs(domain: Medication,', immunizationCatalog: 'getDomainCatalogs(domain: Immunization,', visualAcuityCatalog: 'getDomainCatalogs(domain: VisualAcuity,', dentalProcedureCatalog: 'getDomainCatalogs(domain: DentalProcedure,', allergenCatalog: 'getAllergenCatalogs(', oralApplianceCatalog: 'getOralApplianceCatalogs(' }, sendGraphQLRequest);
    console.log('[EMR Service] All catalogs loaded in 1 request:', {
      medicalConditions: data.medicalConditionCatalog?.length,
      hospitalizations: data.hospitalizationCatalog?.length,
      operations: data.operationCatalog?.length,
      medications: data.medicationCatalog?.length,
      immunizations: data.immunizationCatalog?.length,
      allergens: data.allergenCatalog?.length,
      oralAppliances: data.oralApplianceCatalog?.length,
      visualAcuityTypes: data.visualAcuityCatalog?.length,
      dentalProcedures: data.dentalProcedureCatalog?.length,
    });
    return {
      medicalConditionCatalog: data.medicalConditionCatalog || [],
      hospitalizationCatalog: data.hospitalizationCatalog || [],
      operationCatalog: data.operationCatalog || [],
      medicationCatalog: data.medicationCatalog || [],
      immunizationCatalog: data.immunizationCatalog || [],
      allergenCatalog: data.allergenCatalog || [],
      oralApplianceCatalog: data.oralApplianceCatalog || [],
      visualAcuityCatalog: data.visualAcuityCatalog || [],
      dentalProcedureCatalog: data.dentalProcedureCatalog || [],
    };
  } catch (error) {
    console.warn('[EMR Service] Could not fetch catalogs:', error.message);
    return {
      medicalConditionCatalog: [],
      hospitalizationCatalog: [],
      operationCatalog: [],
      medicationCatalog: [],
      immunizationCatalog: [],
      allergenCatalog: [],
      oralApplianceCatalog: [],
      visualAcuityCatalog: [],
      dentalProcedureCatalog: [],
    };
  }
};

/**
 * Search for student programs by label (used by the program search field in personal info).
 * @param {string} query - The text the patient typed
 * @returns {Promise<Array<{id, label}>>}
 */
export const searchStudentProgram = async (query) => {
  const gql = `
    query SearchStudentProgram($label: String) {
      searchStudentProgram(label: $label, limit: 20) {
        id label
      }
    }
  `;
  try {
    const data = await sendGraphQLRequest(gql, { label: query || '' });
    return data.searchStudentProgram || [];
  } catch (err) {
    console.warn('[EMR Service] searchStudentProgram failed:', err.message);
    return [];
  }
};

/**
 * Search for immunization catalog entries by name (used by the "Others" vaccine search field).
 * Calls searchDomainCatalogs with the Immunization domain.
 * @param {string} query - The text the patient typed
 * @returns {Promise<Array<{id, name, code, domain, isValid}>>}
 */
export const searchImmunizationCatalog = async (query) => {
  const gql = `
    query SearchImmunizations($names: [String!]!) {
      searchDomainCatalogs(domain: "Immunization", filterIsValid: true, names: $names) {
        id domain name code isValid
      }
    }
  `;
  try {
    const data = await sendGraphQLRequest(gql, { names: [query] });
    return data.searchDomainCatalogs || [];
  } catch (err) {
    console.warn('[EMR Service] searchImmunizationCatalog failed:', err.message);
    return [];
  }
};

/**
 * Create a new immunization catalog entry (used when patient types a vaccine not in the system).
 * Calls createDomainCatalogs with the Immunization domain.
 * @param {string} name - The vaccine name to create
 * @returns {Promise<Array<{id, name, code, domain, isValid}>>}
 */
export const createImmunizationCatalog = async (name) => {
  const mutation = `
    mutation CreateImmunization($names: [String!]!) {
      createDomainCatalogs(domain: Immunization, names: $names) {
        id domain name code isValid
      }
    }
  `;
  const data = await sendGraphQLRequest(mutation, { names: [name] });
  return data.createDomainCatalogs || [];
};

/**
 * Generic search for domain catalog entries by name (used by "Others" search fields).
 * @param {string} domain - The domain type (e.g., "Hospitalization", "Operation", "Medication")
 * @param {string} query - The text the patient typed
 * @returns {Promise<Array<{id, name, code, domain, isValid}>>}
 */
export const searchDomainCatalog = async (domain, query) => {
  const gql = `
    query SearchDomainCatalog($domain: String, $names: [String!]!) {
      searchDomainCatalogs(domain: $domain, filterIsValid: true, names: $names) {
        id domain name code isValid
      }
    }
  `;
  try {
    const data = await sendGraphQLRequest(gql, { domain, names: [query] });
    return data.searchDomainCatalogs || [];
  } catch (err) {
    console.warn(`[EMR Service] searchDomainCatalog(${domain}) failed:`, err.message);
    return [];
  }
};

/**
 * Generic create for domain catalog entries (used by "Others" create buttons).
 * @param {string} domain - The domain type enum value (e.g., "Hospitalization")
 * @param {string} name - The entry name to create
 * @returns {Promise<Array<{id, name, code, domain, isValid}>>}
 */
export const createDomainCatalog = async (domain, name) => {
  const mutation = `
    mutation CreateDomainCatalog($names: [String!]!) {
      createDomainCatalogs(domain: ${domain}, names: $names) {
        id domain name code isValid
      }
    }
  `;
  const data = await sendGraphQLRequest(mutation, { names: [name] });
  return data.createDomainCatalogs || [];
};

/**
 * Search allergen catalog entries by name (used by "Others" allergen search field).
 * @param {string} query - The text the patient typed
 * @returns {Promise<Array<{id, allergen, type, isValid}>>}
 */
export const searchAllergenCatalogByName = async (query) => {
  const gql = `
    query SearchAllergens($allergens: [String!]!) {
      searchAllergenCatalogs(allergens: $allergens, filterIsValid: true) {
        id allergen type isValid
      }
    }
  `;
  try {
    const data = await sendGraphQLRequest(gql, { allergens: [query] });
    return data.searchAllergenCatalogs || [];
  } catch (err) {
    console.warn('[EMR Service] searchAllergenCatalogByName failed:', err.message);
    return [];
  }
};

/**
 * Create a new allergen catalog entry (used when patient types an allergen not in the system).
 * @param {string} allergen - The allergen name
 * @param {string} type - The allergen type (Food, Drug, Environmental, Insect, Chemical, Other)
 * @returns {Promise<Array<{id, allergen, type, isValid}>>}
 */
export const createAllergenCatalogEntry = async (allergen, type = 'Other') => {
  const mutation = `
    mutation CreateAllergen($allergens: [AllergenCatalogInput!]!) {
      createAllergenCatalogs(allergens: $allergens) {
        id allergen type isValid
      }
    }
  `;
  const data = await sendGraphQLRequest(mutation, { allergens: [{ allergen, type }] });
  return data.createAllergenCatalogs || [];
};

// ─── Record Builder Functions ─────────────────────────────────────────────────

/**
 * Build MedicalHistory.conditions from checked catalog IDs.
 * formData.medicalHistory.self  = { [conditionCatalogId]: true/false }
 * formData.medicalHistory.family = { [conditionCatalogId]: true/false }
 * formData.medicalHistory.familyWhoHasIt = { [conditionCatalogId]: "Mother / Father / ..." }
 */
const buildMedicalConditionRecords = (medicalHistory) => {
  const conditions = [
    // Self conditions
    ...Object.entries(medicalHistory?.self || {})
      .filter(([id, checked]) => checked && /^[1-9]\d*$/.test(id))
      .map(([id]) => ({ conditionId: id, diagnosedDate: null, relationship: null, description: null })),
    // Family conditions — relationship field carries the family member name
    ...Object.entries(medicalHistory?.family || {})
      .filter(([id, checked]) => checked && /^[1-9]\d*$/.test(id))
      .map(([id]) => {
        const who = medicalHistory.familyWhoHasIt?.[id] || 'Family';
        return { conditionId: id, diagnosedDate: null, relationship: who, description: null };
      }),
  ];
  return { conditions };
};

/**
 * Build AllergyProfile.allergies from checked allergen catalog IDs.
 * formData.medicalBackground.allergies = { [allergenCatalogId]: true/false }
 */
const buildAllergyRecords = (medicalBackground) => {
  if (medicalBackground?.hasAllergies !== 'Yes') return { allergies: [], notes: null };
  const notes = [];
  const allergies = Object.entries(medicalBackground.allergies || {})
    .filter(([, val]) => (typeof val === 'object' ? val?.checked : val))
    .map(([id, val]) => ({
      allergenCatalogId: id,
      status: (typeof val === 'object' && val?.status) ? val.status : 'Active',
      severity: (typeof val === 'object' && val?.severity) ? val.severity : 'Unknown',
      notes: null,
      date_identified: null,
    }));
  if (medicalBackground.allergyOther) notes.push(`Other: ${medicalBackground.allergyOther}`);
  const sectionNotes = notes.length ? notes.join('; ') : null;
  if (sectionNotes && allergies.length) allergies[0].notes = sectionNotes;
  return { allergies, notes: null };
};

/**
 * Build HospitalizationProfile.hospitalizations from checked catalog IDs.
 * formData.medicalBackground.hospitalizationConditions = { [conditionCatalogId]: true/false }
 */
const buildHospitalizationRecords = (medicalBackground) => {
  if (medicalBackground?.hasHospitalization !== 'Yes') return { hospitalizations: [], notes: null };
  const today = new Date().toISOString().split('T')[0];
  const hospitalizations = Object.entries(medicalBackground.hospitalizationConditions || {})
    .filter(([, checked]) => checked)
    .map(([id]) => ({
      conditionId: id,
      admissionDate: medicalBackground.hospitalizationDates?.[id]?.admissionDate || today,
      dischargeDate: medicalBackground.hospitalizationDates?.[id]?.dischargeDate || null,
      notes: medicalBackground.hospitalizationNotes || null
    }));
  return { hospitalizations, notes: medicalBackground.hospitalizationNotes || null };
};

/**
 * Build OperationProfile.operations from checked catalog IDs.
 * formData.medicalBackground.operationConditions = { [procedureCatalogId]: true/false }
 */
const buildOperationRecords = (medicalBackground) => {
  if (medicalBackground?.hasOperation !== 'Yes') return { operations: [], notes: null };
  const today = new Date().toISOString().split('T')[0];
  const operations = Object.entries(medicalBackground.operationConditions || {})
    .filter(([, checked]) => checked)
    .map(([id]) => ({
      procedureId: id,
      operationDate: medicalBackground.operationDates?.[id] || today,
      notes: medicalBackground.operationNotes || null
    }));
  return { operations, notes: medicalBackground.operationNotes || null };
};

/**
 * Build MedicationProfile.medications from checked catalog IDs.
 * formData.medicalBackground.selectedMedications = { [medicineCatalogId]: true/false }
 */
const buildMedicationRecords = (medicalBackground) => {
  if (medicalBackground?.hasMedications !== 'Yes') return { medications: [], notes: null };
  const medications = Object.entries(medicalBackground.selectedMedications || {})
    .filter(([, checked]) => checked)
    .map(([id]) => ({ medicineId: id, description: medicalBackground.medicationReason || null }));
  return { medications, notes: medicalBackground.medicationNotes || null };
};

/**
 * Build ImmunizationProfile.immunizations from checked catalog IDs.
 * formData.medicalBackground.immunizations = { [vaccineTypeCatalogId]: true/false }
 * Keys are now catalog IDs (not old hardcoded frontend string keys).
 */
const buildImmunizationRecords = (medicalBackground, catalog) => {
  const today = new Date().toISOString().split('T')[0];
  const validIds = new Set(catalog.map(c => c.id));
  const immunizationRecords = Object.entries(medicalBackground?.immunizations || {})
    .filter(([, checked]) => checked)
    .flatMap(([id]) => {
      if (!validIds.has(id)) return [];
      const date = medicalBackground?.immunizationDates?.[id] || today;
      const dose = medicalBackground?.immunizationDoses?.[id];
      return [{ vaccineTypeId: id, immunizationDate: date, doseNumber: dose ? parseInt(dose, 10) : 1 }];
    });
  return { immunizationRecords };
};

/**
 * Build OralApplianceProfile.appliances from checked oral appliance catalog IDs.
 * formData.dentalHistory.intraOralAppliances = { [tagId]: true/false }
 * formData.dentalHistory.applianceLocation = 'Upper' | 'Lower' | 'Both'
 */
const buildOralApplianceRecords = (dentalHistory, catalog) => {
  const validIds = new Set(catalog.map(c => c.id));
  const today = new Date().toISOString().split('T')[0];
  const appliances = Object.entries(dentalHistory?.intraOralAppliances || {})
    .filter(([, val]) => (typeof val === 'object' ? val?.checked : val))
    .flatMap(([id, val]) => {
      if (!validIds.has(id)) return [];
      const itemArch = (typeof val === 'object' && val?.arch) ? val.arch : 'None';
      return [{ tagId: id, status: 'Active', dateIssued: today, arch: itemArch }];
    });
  const other = dentalHistory?.intraOralAppliances?.other;
  const otherChecked = typeof other === 'object' ? Boolean(other?.checked) : Boolean(other);
  return {
    appliances,
    notes: null,
    otherDescription: otherChecked ? dentalHistory?.applianceOther?.trim() || null : null,
    otherArch: otherChecked && typeof other === 'object' ? other.arch || null : null,
  };
};

const VISUAL_ACUITY_META_PREFIX = 'VA_META::';

const normalizeVisualGrade = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const parseLegacyVisualAcuityFlags = (notes = '') => ({
  eyeglasses: notes.includes('Eyeglasses: Yes'),
  contactLenses: notes.includes('Contact Lenses: Yes'),
});

const parseVisualAcuityMetaNotes = (rawNotes) => {
  if (typeof rawNotes !== 'string') return null;
  if (!rawNotes.startsWith(VISUAL_ACUITY_META_PREFIX)) return null;

  try {
    const payload = JSON.parse(rawNotes.slice(VISUAL_ACUITY_META_PREFIX.length));
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
};

const buildVisualAcuityPayload = (medicalBackground = {}) => {
  const eyeglasses = !!medicalBackground.eyeglasses;
  const contactLenses = !!medicalBackground.contactLenses;

  const baseOD = normalizeVisualGrade(medicalBackground.gradeOD);
  const baseOS = normalizeVisualGrade(medicalBackground.gradeOS);

  const eyeglassesOD = normalizeVisualGrade(medicalBackground.gradeODEyeglasses) || (eyeglasses ? baseOD : '');
  const eyeglassesOS = normalizeVisualGrade(medicalBackground.gradeOSEyeglasses) || (eyeglasses ? baseOS : '');
  const contactOD = normalizeVisualGrade(medicalBackground.gradeODContactLenses) || (contactLenses && !eyeglasses ? baseOD : '');
  const contactOS = normalizeVisualGrade(medicalBackground.gradeOSContactLenses) || (contactLenses && !eyeglasses ? baseOS : '');

  const rightEye = eyeglasses
    ? (eyeglassesOD || contactOD || baseOD || 'N/A')
    : (contactOD || baseOD || 'N/A');
  const leftEye = eyeglasses
    ? (eyeglassesOS || contactOS || baseOS || 'N/A')
    : (contactOS || baseOS || 'N/A');

  const metadata = {
    version: 2,
    eyeglasses,
    contactLenses,
    grades: {
      eyeglasses: {
        od: eyeglassesOD,
        os: eyeglassesOS,
      },
      contactLenses: {
        od: contactOD,
        os: contactOS,
      },
    },
  };

  return {
    notes: `Eyeglasses: ${eyeglasses ? 'Yes' : 'No'}, Contact Lenses: ${contactLenses ? 'Yes' : 'No'}`,
    acuityNotes: `${VISUAL_ACUITY_META_PREFIX}${JSON.stringify(metadata)}`,
    leftEye,
    rightEye,
  };
};

/**
 * Build all input objects from form data for the batched mutation
 * @param {object} formData           - Form data from the initial record form
 * @param {object} photoIds           - Staged fileIds from the media REST API
 * @param {string|null} photoIds.upperTeethFileId - Staged fileId for the upper teeth photo
 * @param {string|null} photoIds.lowerTeethFileId - Staged fileId for the lower teeth photo
 * @param {object} allCatalogs - Pre-fetched result of fetchAllCatalogs()
 */
const buildBatchInputs = (formData, photoIds = {}, allCatalogs = {}) => {
  const {
    medicalConditionCatalog = [],
    hospitalizationCatalog: _hCat = [],
    operationCatalog: _oCat = [],
    medicationCatalog: _mCat = [],
    immunizationCatalog = [],
    allergenCatalog: _aCat = [],
    oralApplianceCatalog = [],
    visualAcuityCatalog = [],
    dentalProcedureCatalog = [],
  } = allCatalogs;
  const inputs = {};

  // Student Profile (conditional)
  if (formData.personalInfo.programId) {
    inputs.studentProfile = {
      programId: formData.personalInfo.programId,
      year: mapYearLevel(formData.personalInfo.studentCategory)
    };
  }

  // Employee Profile (conditional)
  if (formData.personalInfo.department) {
    const ROLE_MAP = {
      'Teaching':              'NonStaff',
      'Teaching (Officer)':    'NonStaffOfficer',
      'Non-Teaching':          'Staff',
      'Non-Teaching (Officer)':'StaffOfficer',
      'Other':                 'Other',
    };
    const mappedRole = ROLE_MAP[formData.personalInfo.employmentCategory] || 'Other';
    inputs.employeeProfile = {
      department: formData.personalInfo.department,
      role: mappedRole,
      position: formData.personalInfo.position || '',
      employmentCategoryOther: formData.personalInfo.employmentCategory === 'Other'
        ? formData.personalInfo.employmentCategoryOther?.trim() || null
        : null,
    };
  }

  // Emergency Contacts
  if (formData.personalInfo.emergencyContacts?.length >= 2) {
    inputs.emergencyContact = {
      firstContact: {
        contactName: formData.personalInfo.emergencyContacts[0].name,
        relationship: formData.personalInfo.emergencyContacts[0].relationship,
        contactNumber: formData.personalInfo.emergencyContacts[0].contactNumber,
        address: formData.personalInfo.emergencyContacts[0].address || null
      },
      secondContact: {
        contactName: formData.personalInfo.emergencyContacts[1].name,
        relationship: formData.personalInfo.emergencyContacts[1].relationship,
        contactNumber: formData.personalInfo.emergencyContacts[1].contactNumber,
        address: formData.personalInfo.emergencyContacts[1].address || null
      }
    };
  }

  // Medical History — self + family conditions via catalog IDs
  const { conditions: medConditions } = buildMedicalConditionRecords(formData.medicalHistory);
  inputs.medicalHistory = { conditions: medConditions };

  // Allergy Profile — allergen catalog IDs
  const { allergies, notes: allergyNotes } = buildAllergyRecords(formData.medicalBackground);
  inputs.allergyProfile = { allergies, notes: allergyNotes };

  // Hospitalization Profile — hospitalization catalog IDs
  const { hospitalizations, notes: hospNotes } = buildHospitalizationRecords(formData.medicalBackground);
  inputs.hospitalizationProfile = { hospitalizations, notes: hospNotes };

  // Operation Profile — operation catalog IDs
  const { operations, notes: opNotes } = buildOperationRecords(formData.medicalBackground);
  inputs.operationProfile = { operations, notes: opNotes };

  // Medication Profile — medication catalog IDs
  const { medications, notes: medicalNotes } = buildMedicationRecords(formData.medicalBackground);
  inputs.medicationProfile = { medications, notes: medicalNotes };

  // Immunization Profile — vaccine catalog IDs (direct)
  const { immunizationRecords } = buildImmunizationRecords(
    formData.medicalBackground,
    immunizationCatalog
  );
  inputs.immunizationProfile = { immunizations: immunizationRecords };

  // Lifestyle
  const yearsVaping = parseInt(formData.medicalBackground.yearsVaping, 10);
  inputs.lifestyle = {
    smoker: formData.medicalBackground.smoker === 'yes',
    numberOfCigarettesPerDay: formData.medicalBackground.smoker === 'yes'
      ? parseInt(formData.medicalBackground.smokerSticksPerDay) || null : null,
    yearsSmoked: formData.medicalBackground.smoker === 'yes'
      ? parseInt(formData.medicalBackground.smokerYears) || null : null,
    alcoholConsumer: formData.medicalBackground.alcoholDrinker === 'yes',
    frequencyOfAlcoholConsumption: formData.medicalBackground.alcoholDrinker === 'yes'
      ? formData.medicalBackground.alcoholFrequency || null : null,
    vapeUser: formData.medicalBackground.vaper === 'yes',
    vapeType: formData.medicalBackground.vaper === 'yes'
      ? formData.medicalBackground.vapeType || null : null,
    vapeFrequency: formData.medicalBackground.vaper === 'yes'
      ? formData.medicalBackground.vapeFrequency || null : null,
    yearsVaping: formData.medicalBackground.vaper === 'yes' && !Number.isNaN(yearsVaping) ? yearsVaping : null,
    notes: null
  };

  // Visual Acuity Profile
  const hasVisualAcuity = formData.medicalBackground.eyeglasses || formData.medicalBackground.contactLenses;
  const visualAcuityPayload = buildVisualAcuityPayload(formData.medicalBackground);
  // Use the first catalog entry for acuityId — falls back to null (acuity omitted) if catalog is empty
  const visualAcuityId = visualAcuityCatalog[0]?.id ?? null;
  inputs.visualAcuityProfile = {
    notes: hasVisualAcuity
      ? visualAcuityPayload.notes
      : null,
    acuity: hasVisualAcuity && visualAcuityId
      ? {
          acuityId: visualAcuityId,
          left_eye: visualAcuityPayload.leftEye,
          right_eye: visualAcuityPayload.rightEye,
          notes: visualAcuityPayload.acuityNotes,
          recorded_at: formData.medicalBackground.visualAcuityDate
            ? new Date(formData.medicalBackground.visualAcuityDate).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0]
        }
      : null
  };

  // Dental History
  const mappedDentalCleaning = mapDentalCleaningRange(formData.dentalHistory.lastDentalCleaning);
  const seenByDentist = formData.dentalHistory.firstTimeDentist === 'no';
  inputs.dentalHistory = {
    seenByDentist,
    lastDentalCleaning: mappedDentalCleaning,
    purpose: null,
    // type="month" gives YYYY-MM — append -01 to make it a valid full date
    lastVisitDate: formData.dentalHistory.lastDentalConsultation
      ? new Date(formData.dentalHistory.lastDentalConsultation + '-01').toISOString().split('T')[0]
      : null
  };

  // Dental Procedure Profile — built from selected catalog IDs
  const today = new Date().toISOString().split('T')[0];
  const validProcedureIds = new Set(dentalProcedureCatalog.map(c => c.id));
  const dentalProcedures = Object.entries(formData.dentalHistory.selectedDentalProcedures || {})
    .filter(([id, checked]) => checked && validProcedureIds.has(id))
    .map(([id]) => ({ procedureTypeId: id, procedureDate: today }));
  inputs.dentalProcedureProfile = { procedures: dentalProcedures, notes: null };

  // Oral Appliance Profile — oral appliance catalog IDs
  const { appliances, notes: oralNotes, otherDescription, otherArch } = buildOralApplianceRecords(formData.dentalHistory, oralApplianceCatalog);
  inputs.oralApplianceProfile = { appliances, notes: oralNotes, otherDescription, otherArch };

  // Dental Photo Record – use real staged fileIds from the media REST API
  inputs.dentalPhotoRecord = {
    upperTeeth: photoIds.upperTeethFileId ?? null,
    lowerTeeth: photoIds.lowerTeethFileId ?? null
  };

  // OB-GYNE (conditional - female only)
  if (formData.personalInfo.gender === 'Female') {
    if (formData.obgyne) {
      const lmpDate = formData.obgyne.lastMenstrualPeriod
        ? new Date(formData.obgyne.lastMenstrualPeriod).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      const noteParts = [];
      if (formData.obgyne.menstruationDuration)
        noteParts.push(`Duration: ${formData.obgyne.menstruationDuration} days`);
      if (formData.obgyne.menarcheYearAge)
        noteParts.push(`Menarche: ${formData.obgyne.menarcheYearAge}`);
      if (formData.obgyne.padsPerDay)
        noteParts.push(`Pads/day: ${formData.obgyne.padsPerDay}`);
      inputs.obgynHistory = {
        lastMenstrualPeriod: lmpDate,
        hasDysmenorrhea: formData.obgyne.dysmenorrhea === 'Yes',
        notes: noteParts.length ? noteParts.join('; ') : null
      };
    } else {
      inputs.obgynHistory = {
        lastMenstrualPeriod: new Date().toISOString().split('T')[0],
        hasDysmenorrhea: false,
        notes: null
      };
    }
  }

  return inputs;
};

/**
 * Build and send a single compound GraphQL mutation with all create operations
 */
const sendBatchedCreateMutations = async (inputs, formData) => {
  // Dynamically build the mutation string and variables based on which inputs are present
  const mutationParts = [];
  const variableDefs = [];
  const variables = {};

  // Helper to add a mutation to the batch
  const addMutation = (alias, mutationName, inputType, inputKey, varName, fields = 'id') => {
    variableDefs.push(`$${varName}: ${inputType}!`);
    mutationParts.push(`${alias}: ${mutationName}(input: $${varName}) { ${fields} }`);
    variables[varName] = inputs[inputKey];
  };

  // Conditionally include student profile
  if (inputs.studentProfile) {
    addMutation('studentProfile', 'createStudentProfile', 'StudentProfileInput', 'studentProfile', 'studentInput');
  }

  // Conditionally include employee profile
  if (inputs.employeeProfile) {
    addMutation('employeeProfile', 'createEmployeeProfile', 'EmployeeProfileInput', 'employeeProfile', 'empInput');
  }

  // Emergency contact
  if (inputs.emergencyContact) {
    addMutation('emergencyContact', 'createEmergencyContact', 'EmergencyContactInput', 'emergencyContact', 'emergencyInput');
  }

  // Always-required mutations
  addMutation('medicalHistory', 'createMedicalHistory', 'MedicalHistoryInput', 'medicalHistory', 'medHistInput');
  addMutation('allergyProfile', 'createAllergyProfile', 'AllergyProfileInput', 'allergyProfile', 'allergyInput');
  addMutation('hospitalizationProfile', 'createHospitalizationProfile', 'HospitalizationProfileInput', 'hospitalizationProfile', 'hospInput');
  addMutation('operationProfile', 'createOperationProfile', 'OperationProfileInput', 'operationProfile', 'opInput');
  addMutation('medicationProfile', 'createMedicationProfile', 'MedicationProfileInput', 'medicationProfile', 'medInput');
  addMutation('immunizationProfile', 'createImmunizationProfile', 'ImmunizationProfileInput', 'immunizationProfile', 'immuInput');
  addMutation('lifestyle', 'createLifestyle', 'LifestyleInput', 'lifestyle', 'lifeInput');
  addMutation('visualAcuityProfile', 'createVisualAcuityProfile', 'VisualAcuityProfileInput', 'visualAcuityProfile', 'vaInput');
  addMutation('dentalHistory', 'createDentalHistory', 'DentalHistoryInput', 'dentalHistory', 'dentalHistInput');
  addMutation('dentalProcedureProfile', 'createDentalProcedureProfile', 'DentalProcedureProfileInput', 'dentalProcedureProfile', 'dentalProcInput');
  addMutation('oralApplianceProfile', 'createOralApplianceProfile', 'OralApplianceProfileInput', 'oralApplianceProfile', 'oralAppInput');
  addMutation('dentalPhotoRecord', 'createDentalPhotoRecord', 'DentalPhotoRecordInput', 'dentalPhotoRecord', 'dentalPhotoInput', 'id upperTeeth lowerTeeth');

  // OB-GYNE (female only)
  if (inputs.obgynHistory) {
    addMutation('obgynHistory', 'createObgynHistory', 'ObgynHistoryInput', 'obgynHistory', 'obgynInput');
  }

  // Submit ticket as the final field — GraphQL executes mutations serially
  // so this runs only after all creates above have completed.
  mutationParts.push('submitTicket: submitUpdateTicket');

  const mutation = `
    mutation BatchCreateInitialRecords(${variableDefs.join(', ')}) {
      ${mutationParts.join('\n      ')}
    }
  `;

  console.log('[EMR Service] Batch mutation:', mutation);
  console.log('[EMR Service] Batch variables:', JSON.stringify(variables, null, 2));

  const data = await sendGraphQLRequest(mutation, variables);
  return data;
};

// Individual mutation functions

const createStudentProfile = async (input) => {
  const mutation = `
    mutation CreateStudentProfile($input: StudentProfileInput!) {
      createStudentProfile(input: $input) {
        id
        program
        year
      }
    }
  `;
  
  const data = await sendGraphQLRequest(mutation, { input });
  return data.createStudentProfile;
};

const createEmergencyContact = async (input) => {
  const mutation = `
    mutation CreateEmergencyContact($input: EmergencyContactInput!) {
      createEmergencyContact(input: $input) {
        id
        firstContact {
          id
          contactName
          relationship
          contactNumber
        }
        secondContact {
          id
          contactName
          relationship
          contactNumber
        }
      }
    }
  `;
  
  const data = await sendGraphQLRequest(mutation, { input });
  return data.createEmergencyContact;
};

const createMedicalHistory = async (input) => {
  const mutation = `
    mutation CreateMedicalHistory($input: MedicalHistoryInput!) {
      createMedicalHistory(input: $input) {
        id
        conditions {
          id
          conditionId
          relationship
        }
      }
    }
  `;
  
  const data = await sendGraphQLRequest(mutation, { input });
  return data.createMedicalHistory;
};

const createAllergyProfile = async (input) => {
  const mutation = `
    mutation CreateAllergyProfile($input: AllergyProfileInput!) {
      createAllergyProfile(input: $input) {
        id
        allergies {
          id
          allergenCatalogId
          status
          severity
        }
      }
    }
  `;
  
  const data = await sendGraphQLRequest(mutation, { input });
  return data.createAllergyProfile;
};

const createHospitalizationProfile = async (input) => {
  const mutation = `
    mutation CreateHospitalizationProfile($input: HospitalizationProfileInput!) {
      createHospitalizationProfile(input: $input) {
        id
        hospitalizations {
          id
          conditionId
        }
      }
    }
  `;
  
  const data = await sendGraphQLRequest(mutation, { input });
  return data.createHospitalizationProfile;
};

const createOperationProfile = async (input) => {
  const mutation = `
    mutation CreateOperationProfile($input: OperationProfileInput!) {
      createOperationProfile(input: $input) {
        id
        operations {
          id
          procedureId
        }
      }
    }
  `;
  
  const data = await sendGraphQLRequest(mutation, { input });
  return data.createOperationProfile;
};

const createMedicationProfile = async (input) => {
  const mutation = `
    mutation CreateMedicationProfile($input: MedicationProfileInput!) {
      createMedicationProfile(input: $input) {
        id
        medications {
          id
          medicineId
        }
      }
    }
  `;
  
  const data = await sendGraphQLRequest(mutation, { input });
  return data.createMedicationProfile;
};

const createImmunizationProfile = async (input) => {
  const mutation = `
    mutation CreateImmunizationProfile($input: ImmunizationProfileInput!) {
      createImmunizationProfile(input: $input) {
        id
        immunizations {
          id
          vaccineTypeId
        }
      }
    }
  `;
  
  const data = await sendGraphQLRequest(mutation, { input });
  return data.createImmunizationProfile;
};

const createLifestyle = async (input) => {
  const mutation = `
    mutation CreateLifestyle($input: LifestyleInput!) {
      createLifestyle(input: $input) {
        id
        smoker
        alcoholConsumer
      }
    }
  `;
  
  const data = await sendGraphQLRequest(mutation, { input });
  return data.createLifestyle;
};

const createVisualAcuityProfile = async (input) => {
  const mutation = `
    mutation CreateVisualAcuityProfile($input: VisualAcuityProfileInput!) {
      createVisualAcuityProfile(input: $input) {
        id
        notes
        acuity {
          id
          left_eye
          right_eye
          recorded_at
        }
      }
    }
  `;
  
  const data = await sendGraphQLRequest(mutation, { input });
  return data.createVisualAcuityProfile;
};

const createDentalHistory = async (input) => {
  const mutation = `
    mutation CreateDentalHistory($input: DentalHistoryInput!) {
      createDentalHistory(input: $input) {
        id
        seenByDentist
        lastDentalCleaning
      }
    }
  `;
  
  const data = await sendGraphQLRequest(mutation, { input });
  return data.createDentalHistory;
};

const createDentalProcedureProfile = async (input) => {
  const mutation = `
    mutation CreateDentalProcedureProfile($input: DentalProcedureProfileInput!) {
      createDentalProcedureProfile(input: $input) {
        id
        procedures {
          id
          procedureTypeId
        }
      }
    }
  `;
  
  const data = await sendGraphQLRequest(mutation, { input });
  return data.createDentalProcedureProfile;
};

const createOralApplianceProfile = async (input) => {
  const mutation = `
    mutation CreateOralApplianceProfile($input: OralApplianceProfileInput!) {
      createOralApplianceProfile(input: $input) {
        id
        appliances {
          id
          tagId
        }
      }
    }
  `;
  
  const data = await sendGraphQLRequest(mutation, { input });
  return data.createOralApplianceProfile;
};

const createDentalPhotoRecord = async (input) => {
  const mutation = `
    mutation CreateDentalPhotoRecord($input: DentalPhotoRecordInput!) {
      createDentalPhotoRecord(input: $input) {
        id
        upperTeeth
        lowerTeeth
        isValid
      }
    }
  `;
  
  const data = await sendGraphQLRequest(mutation, { input });
  return data.createDentalPhotoRecord;
};

const createObgynHistory = async (input) => {
  const mutation = `
    mutation CreateObgynHistory($input: ObgynHistoryInput!) {
      createObgynHistory(input: $input) {
        id
        lastMenstrualPeriod
        hasDysmenorrhea
      }
    }
  `;
  
  const data = await sendGraphQLRequest(mutation, { input });
  return data.createObgynHistory;
};

// Utility function to map student category to year level
const mapYearLevel = (category) => {
  // New dropdown values already match backend STUDENT_YEAR enum values
  const validEnumValues = new Set(['Grade11', 'Grade12', 'Freshman', 'Sophomore', 'Junior', 'Senior', 'Masteral', 'Doctorate', 'Returnee']);
  if (validEnumValues.has(category)) return category;
  // Legacy mappings for backward compatibility with old stored data
  const legacyMapping = {
    'Freshmen': 'Freshman',
    'Freshmen - New student': 'Freshman',
    'Transferee': 'Sophomore',
    'Graduate studies (New student)': 'Masteral',
    'Graduate studies (Old student)': 'Masteral',
    'Returnee': 'Sophomore',
    'Old Student': 'Junior'
  };
  return legacyMapping[category] || 'Freshman';
};

// Utility function to map dental cleaning range to backend enum
const mapDentalCleaningRange = (frontendValue) => {
  const mapping = {
    '0 to 6 months ago': '0-6',
    '7 to 11 months ago': '7-12',
    '1 year or more': '12-24',
    '': '' // Empty string for not specified
  };
  
  return mapping[frontendValue] || '';
};

/**
 * Check if the current user needs to complete their initial medical record
 * Returns true if user needs to fill out the form (no approved record exists)
 * Returns false if user has already completed their initial record
 */
/**
 * Fetch the current patient's branch identifier from the profile endpoint.
 * Returns { branch, identifier } or null if not yet set.
 */
// ─── Revision Pre-fill ────────────────────────────────────────────────────────

/** Reverse mapping: backend dental cleaning enum → form dropdown value */
const reverseMapDentalCleaningRange = (backendValue) => {
  const mapping = {
    '0-6':   '0 to 6 months ago',
    '7-12':  '7 to 11 months ago',
    '12-24': '1 year or more',
  };
  return mapping[backendValue] || '';
};

/** Reverse mapping: backend year level → form student category */
const reverseMapYearLevel = (backendYear) => {
  // Backend STUDENT_YEAR enum values match the form dropdown values directly
  const validEnumValues = new Set(['Grade11', 'Grade12', 'Freshman', 'Sophomore', 'Junior', 'Senior', 'Masteral', 'Doctorate', 'Returnee']);
  if (validEnumValues.has(backendYear)) return backendYear;
  return '';
};

/** Reverse mapping: backend employee role → form employment category */
const reverseMapEmploymentCategory = (backendRole = '') => {
  const role = String(backendRole || '').trim();
  if (!role) {
    return { employmentCategory: '', employmentCategoryOther: '' };
  }

  const roleMap = {
    Faculty: 'Teaching',
    Staff: 'Non-Teaching',
    AcademicHead: 'Teaching (Officer)',
    NonStaff: 'Teaching',
    NonStaffOfficer: 'Teaching (Officer)',
    StaffOfficer: 'Non-Teaching (Officer)',
    Teaching: 'Teaching',
    'Teaching (Officer)': 'Teaching (Officer)',
    'Non-Teaching': 'Non-Teaching',
    'Non-Teaching (Officer)': 'Non-Teaching (Officer)',
  };

  if (roleMap[role]) {
    return { employmentCategory: roleMap[role], employmentCategoryOther: '' };
  }

  if (role === 'Other') {
    return { employmentCategory: 'Other', employmentCategoryOther: '' };
  }

  // Preserve unknown role strings in the free-text field.
  return { employmentCategory: 'Other', employmentCategoryOther: role };
};

/** Known program values (matches the form's programOptions list) */
const KNOWN_PROGRAMS = new Set([
  'BS Architecture',
  'BS Chemical Engineering',
  'BS Civil Engineering',
  'BS Computer Engineering',
  'BS Electrical Engineering',
  'BS Electronics Engineering',
  'BS Industrial Engineering',
  'BS Mechanical Engineering',
  'BS Environmental and Sanitary Engineering',
  'BS Computer Science',
  'BS Data Science and Analytics',
  'BS Entertainment and Multimedia Computing',
  'BS Information Technology',
  'BS Information Systems',
  'BS Accountancy',
  'BS Accounting Information Systems',
  'BSBA Financial Management',
  'BSBA Human Resource Management',
  'BSBA Logistics and Supply Chain Management',
  'BSBA Marketing Management',
  'Bachelor of Arts in English Language',
  'Bachelor of Arts in Political Science',
  'Bachelor of Secondary Education Major in English',
  'Bachelor of Secondary Education Major in Mathematics',
  'Bachelor of Secondary Education Major in Sciences',
  'Bachelor of Special Needs Education',
  'Teaching Certificate Program',
]);

/**
 * Map fetched backend data back to the InitialMedicalRecordForm's formData shape.
 */
export const mapRevisionDataToFormData = (profileData, emrData) => {
  // personalLog = candidate data from UsersPersonalLog (the patient's submitted form)
  const pr  = profileData?.personalLog || {};
  const bid = profileData?.branchId;
  const emr = emrData || {};

  // ── Personal Info ──────────────────────────────────────────
  const emrProfile       = emr?.emrProfile || {};
  const patientBasicInfo = emr?.patientBasicInfo || {};
  const rawProgram       = emrProfile?.program || patientBasicInfo?.program || '';
  const rawYear          = emrProfile?.year || patientBasicInfo?.year || '';
  const rawDepartment    = emrProfile?.department || patientBasicInfo?.department || '';
  const rawRole          = emrProfile?.role || patientBasicInfo?.role || '';
  const rawPosition      = emrProfile?.position || patientBasicInfo?.position || '';
  const identifier       = bid?.identifier || patientBasicInfo?.identifier || '';
  const branch           = bid?.branch || patientBasicInfo?.branch || '';
  const ec               = emr?.emergencyContact || {};
  const contactPhone = (number) => number === '+' ? '' : number || '';
  const { employmentCategory, employmentCategoryOther: mappedEmploymentCategoryOther } = reverseMapEmploymentCategory(rawRole);
  const employmentCategoryOther = emrProfile?.employmentCategoryOther
    ?? patientBasicInfo?.employmentCategoryOther
    ?? mappedEmploymentCategoryOther;

  const personalInfo = {
    firstName:          pr.first_name     || '',
    surname:            pr.last_name      || '',
    middleName:         pr.middle_name    || '',
    suffix:             pr.suffix         || '',
    birthday:           pr.date_of_birth
                          ? new Date(pr.date_of_birth).toISOString().split('T')[0]
                          : '',
    age:                '',   // auto-computed by the form on mount
    gender:             pr.sex            || '',
    civilStatus:        pr.civil_status   || '',
    nationality:        pr.nationality    || '',
    religion:           pr.religion       || '',
    address:            pr.present_address   || '',
    provinceAddress:    pr.province_address  || '',
    contactNumber:      pr.contactNumber     || '',
    studentNumber:      identifier,
    program:            rawProgram,
    programId:          '',   // resolved asynchronously in fetchRevisionPrefill
    studentCategory:    reverseMapYearLevel(rawYear),
    employeeId:         identifier,
    department:         rawDepartment,
    employmentCategory,
    employmentCategoryOther,
    employmentStatus:   '',   // not persisted in backend
    position:           rawPosition,
    branch,
    emergencyContacts: [
      {
        name:          ec.firstContact?.contactName   || '',
        relationship:  ec.firstContact?.relationship  || '',
        contactNumber: contactPhone(ec.firstContact?.contactNumber),
        address:       ec.firstContact?.address       || '',
      },
      {
        name:          ec.secondContact?.contactName   || '',
        relationship:  ec.secondContact?.relationship  || '',
        contactNumber: contactPhone(ec.secondContact?.contactNumber),
        address:       ec.secondContact?.address       || '',
      },
    ],
  };

  // ── Medical History ──────────────────────────────────────
  const conditions = emr?.medicalHistory?.conditions || [];
  const selfConditions   = {};
  const familyConditions = {};
  const familyWhoHasIt   = {};
  for (const c of conditions) {
    if (!c.conditionId) continue;
    if (!c.relationship) {
      selfConditions[c.conditionId] = true;
    } else {
      familyConditions[c.conditionId] = true;
      familyWhoHasIt[c.conditionId]   = c.relationship;
    }
  }
  const medicalHistory = {
    self:           selfConditions,
    family:         familyConditions,
    familyWhoHasIt,
  };

  // ── Medical Background ───────────────────────────────────
  const allergies    = emr?.allergyProfile?.allergies        || [];
  const hosps        = emr?.hospitalizationProfile?.hospitalizations || [];
  const ops          = emr?.operationProfile?.operations     || [];
  const meds         = emr?.medicationProfile?.medications   || [];
  const immunizations = emr?.immunizationProfile?.immunizations || [];
  const ls           = emr?.lifestyle                        || {};
  const va           = emr?.visualAcuity                     || {};

  const allergyMap  = Object.fromEntries(allergies.map(a => [a.allergenCatalogId, { checked: true, severity: a.severity || 'Unknown', status: a.status || 'Active' }]));
  const hospMap         = Object.fromEntries(hosps.map(h => [h.conditionId, true]));
  const hospDatesMap    = Object.fromEntries(hosps.map(h => [h.conditionId, {
    admissionDate: h.admissionDate ? new Date(h.admissionDate).toISOString().split('T')[0] : '',
    dischargeDate: h.dischargeDate ? new Date(h.dischargeDate).toISOString().split('T')[0] : '',
  }]));
  const opsMap          = Object.fromEntries(ops.map(o => [o.procedureId, true]));
  const opsDatesMap     = Object.fromEntries(ops.map(o => [o.procedureId,
    o.operationDate ? new Date(o.operationDate).toISOString().split('T')[0] : ''
  ]));
  const medsMap         = Object.fromEntries(meds.map(m => [m.medicineId, true]));
  const immunMap        = Object.fromEntries(immunizations.map(i => [i.vaccineTypeId, true]));
  const immunDatesMap   = Object.fromEntries(immunizations.map(i => [i.vaccineTypeId,
    i.immunizationDate ? new Date(i.immunizationDate).toISOString().split('T')[0] : ''
  ]));
  const immunDosesMap   = Object.fromEntries(immunizations.map(i => [i.vaccineTypeId, i.doseNumber || 1]));

  const vaNotesStr = va.notes || '';
  const vaAcuityNotesStr = va.acuity?.notes || '';
  const vaMeta = parseVisualAcuityMetaNotes(vaAcuityNotesStr);
  const vaLegacyFlags = parseLegacyVisualAcuityFlags(`${vaNotesStr} ${vaAcuityNotesStr}`);
  const vaFallbackOD = va.acuity?.right_eye || '';
  const vaFallbackOS = va.acuity?.left_eye || '';
  const eyeglassesFromMeta = typeof vaMeta?.eyeglasses === 'boolean' ? vaMeta.eyeglasses : null;
  const contactLensesFromMeta = typeof vaMeta?.contactLenses === 'boolean' ? vaMeta.contactLenses : null;
  const hasAcuityValues = !!(vaFallbackOD || vaFallbackOS);
  const resolvedEyeglasses = (eyeglassesFromMeta ?? vaLegacyFlags.eyeglasses) || hasAcuityValues;
  const resolvedContactLenses = contactLensesFromMeta ?? vaLegacyFlags.contactLenses;
  const eyeglassesGrades = vaMeta?.grades?.eyeglasses || {};
  const contactLensGrades = vaMeta?.grades?.contactLenses || {};

  const medicalBackground = {
    immunizations:             immunMap,
    immunizationDates:         immunDatesMap,
    immunizationDoses:         immunDosesMap,
    hasAllergies:              allergies.length > 0    ? 'Yes' : 'No',
    allergies:                 allergyMap,
    allergyOther:              (emr?.allergyProfile?.notes || allergies[0]?.notes || '').replace(/^Other: /, ''),
    hasHospitalization:        hosps.length > 0        ? 'Yes' : 'No',
    hospitalizationConditions: hospMap,
    hospitalizationDates:      hospDatesMap,
    hospitalizationNotes:      emr?.hospitalizationProfile?.notes || hosps.find(h => h.notes)?.notes || '',
    hasOperation:              ops.length > 0          ? 'Yes' : 'No',
    operationConditions:       opsMap,
    operationDates:            opsDatesMap,
    operationNotes:            emr?.operationProfile?.notes || ops.find(o => o.notes)?.notes || '',
    hasMedications:            meds.length > 0         ? 'Yes' : 'No',
    selectedMedications:       medsMap,
    medicationReason:          meds[0]?.description    || '',
    medicationNotes:           emr?.medicationProfile?.notes || '',
    smoker:                    ls.smoker ? 'yes' : 'no',
    smokerSticksPerDay:        ls.numberOfCigarettesPerDay != null
                                 ? String(ls.numberOfCigarettesPerDay) : '',
    smokerYears:               ls.yearsSmoked != null
                                 ? String(ls.yearsSmoked) : '',
    alcoholDrinker:            ls.alcoholConsumer ? 'yes' : 'no',
    alcoholFrequency:          ls.frequencyOfAlcoholConsumption || '',
    vaper:                     ls.vapeUser ? 'yes' : 'no',
    vapeType:                  ls.vapeType || '',
    vapeFrequency:             ls.vapeFrequency || '',
    yearsVaping:               ls.yearsVaping ?? '',
    eyeglasses:                resolvedEyeglasses,
    contactLenses:             resolvedContactLenses,
    gradeOD:                   vaFallbackOD,
    gradeOS:                   vaFallbackOS,
    gradeODEyeglasses:         normalizeVisualGrade(eyeglassesGrades.od) || (resolvedEyeglasses ? vaFallbackOD : ''),
    gradeOSEyeglasses:         normalizeVisualGrade(eyeglassesGrades.os) || (resolvedEyeglasses ? vaFallbackOS : ''),
    gradeODContactLenses:      normalizeVisualGrade(contactLensGrades.od) || (resolvedContactLenses ? vaFallbackOD : ''),
    gradeOSContactLenses:      normalizeVisualGrade(contactLensGrades.os) || (resolvedContactLenses ? vaFallbackOS : ''),
    visualAcuityDate:          va.acuity?.recorded_at
                                 ? new Date(va.acuity.recorded_at).toISOString().split('T')[0]
                                 : '',
  };

  // ── Dental History ───────────────────────────────────────
  const dh        = emr?.dentalHistory || {};
  const oaProfile = emr?.oralAppliance || {};
  const appliances = oaProfile.appliances || [];
  const applianceMap = Object.fromEntries(appliances.map(a => [a.tagId, { checked: true, arch: a.arch || '' }]));

  const dpProcedures = emr?.dentalProcedureProfile?.procedures || [];
  const selectedDentalProcedures = Object.fromEntries(dpProcedures.map(p => [p.procedureTypeId, true]));

  const dentalHistory = {
    // seenByDentist=true means patient has been seen before → firstTimeDentist='no'
    // seenByDentist=false means patient has NEVER been seen → firstTimeDentist='yes'
    firstTimeDentist:     dh.seenByDentist === true  ? 'no'
                        : dh.seenByDentist === false ? 'yes' : '',
    lastDentalConsultation: dh.lastVisitDate
                              ? String(dh.lastVisitDate).slice(0, 7)  // YYYY-MM-DD → YYYY-MM
                              : '',
    lastDentalCleaning:   reverseMapDentalCleaningRange(dh.lastDentalCleaning || ''),
    hasIntraOralAppliance: appliances.length > 0 || Boolean(oaProfile.otherDescription) ? 'yes' : 'no',
    intraOralAppliances: {
      ...applianceMap,
      ...(oaProfile.otherDescription ? { other: { checked: true, arch: oaProfile.otherArch || '' } } : {}),
    },
    applianceOther:       oaProfile.otherDescription || '',
    applianceLocation:     oaProfile.otherArch || appliances[0]?.arch || '',
    selectedDentalProcedures,
    toothExtraction:       '',   // never persisted to backend
    dentalFilling:         '',   // never persisted to backend
    upperTeethPhoto:       null, // files must be re-uploaded
    lowerTeethPhoto:       null,
  };

  // ── OB-GYNE ─────────────────────────────────────────────
  const obg = emr?.obgyne || {};
  let menstruationDuration = '';
  if (obg.notes) {
    const durationMatch = obg.notes.match(/Duration:\s*(\d+)\s*days/i);
    if (durationMatch) menstruationDuration = durationMatch[1];
  }
  const obgyne = {
    lastMenstrualPeriod: obg.lastMenstrualPeriod
                           ? new Date(obg.lastMenstrualPeriod).toISOString().split('T')[0]
                           : '',
    menstruationDuration,
    dysmenorrhea: obg.hasDysmenorrhea ? 'Yes' : 'no',
  };

  return { personalInfo, medicalHistory, medicalBackground, dentalHistory, obgyne };
};

const normalizeRevisionScope = (scope) => (
  scope === 'Medical' || scope === 'Dental' || scope === 'Both' ? scope : 'Both'
);

const buildRevisionPrefillEMRQuery = (scope = 'Both') => {
  const normalizedScope = normalizeRevisionScope(scope);
  const includeMedical = normalizedScope === 'Medical' || normalizedScope === 'Both';
  const includeDental = normalizedScope === 'Dental' || normalizedScope === 'Both';

  let query = `query GetRevisionEMRData {
    emrProfile: getProfile {
      ... on StudentProfile { program year }
      ... on EmployeeProfile { department role position employmentCategoryOther }
    }
    patientBasicInfo: getPatientBasicInfo(userId: "self") {
      identifier
      branch
      profile_type
      program
      year
      department
      role
      employmentCategoryOther
    }
    emergencyContact: getEmergencyContact {
      firstContact  { contactName relationship contactNumber address }
      secondContact { contactName relationship contactNumber address }
    }`;

  if (includeMedical) {
    query += `
    medicalHistory: getMedicalHistory {
      conditions { conditionId relationship }
    }
    allergyProfile: getAllergyProfile {
      allergies { allergenCatalogId status severity notes dateIdentified }
      notes
    }
    hospitalizationProfile: getHospitalizationProfile {
      hospitalizations { conditionId admissionDate dischargeDate notes }
      notes
    }
    operationProfile: getOperationProfile {
      operations { procedureId operationDate notes }
      notes
    }
    medicationProfile: getMedicationProfile {
      medications { medicineId description }
      notes
    }
    immunizationProfile: getImmunizationProfile {
      immunizations { vaccineTypeId immunizationDate doseNumber }
    }
    lifestyle: getLifestyle {
      smoker numberOfCigarettesPerDay yearsSmoked
      alcoholConsumer frequencyOfAlcoholConsumption
      vapeUser vapeType vapeFrequency yearsVaping notes
    }
    visualAcuity: getVisualAcuityProfile {
      notes
      acuity { left_eye right_eye notes recorded_at }
    }
    obgyne: getObgynHistory {
      lastMenstrualPeriod hasDysmenorrhea notes
    }`;
  }

  if (includeDental) {
    query += `
    dentalHistory: getDentalHistory {
      seenByDentist lastDentalCleaning lastVisitDate
    }
    dentalProcedureProfile: getDentalProcedureProfile {
      procedures { procedureTypeId }
    }
    dentalPhotoRecord: getDentalPhotoRecord {
      upperTeeth lowerTeeth
    }
    oralAppliance: getOralApplianceProfile {
      appliances { tagId arch }
      otherDescription
      otherArch
    }`;
  }

  query += `
  }`;

  return query;
};

const fetchRevisionPrefillEMRData = async (scope = 'Both') => {
  return sendGraphQLRequest(
    buildRevisionPrefillEMRQuery(scope),
    {},
    { allowPartialData: true }
  );
};

/**
 * Fetch all existing record data for a patient in Revision status so the
 * initial record form can be pre-populated with their previous submission.
 *
 * Makes two parallel requests:
 *   1. /profile/patient — personal details + branch identifier
 *   2. /emr/patient     — all EMR records in one batched query
 *
 * @returns {object|null} FormData-shaped object or null on complete failure
 */
export const fetchRevisionPrefill = async (scope = 'Both') => {
  const normalizedScope = normalizeRevisionScope(scope);
  console.log('[EMR Service] Fetching revision pre-fill data (scope:', normalizedScope + ')...');

  const [profileResult, emrResult] = await Promise.allSettled([
    // ── Request 1: personal profile ──────────────────────
    // Only queries getPersonalRecordLog (UsersPersonalLog) which contains
    // the patient's submitted form data. getPersonalRecord (UsersPersonal)
    // is intentionally excluded because its personal fields are null until
    // staff approval runs applyUpdatePersonalRecord.
    sendGraphQLRequest(
      `query GetRevisionPersonalData {
        personalLog: getPersonalRecordLog {
          first_name middle_name last_name suffix
          date_of_birth sex civil_status nationality religion
          contactNumber present_address province_address
        }
        branchId: getPersonalRecord {
          branch
          identifier
        }
      }`,
      {},
      { endpoint: '/profile/patient', allowPartialData: true }
    ),

    // ── Request 2: scope-aware EMR data (batched) ───────────────────────────────────
    fetchRevisionPrefillEMRData(normalizedScope),
  ]);

  if (profileResult.status === 'rejected') {
    console.warn('[EMR Service] Profile prefill fetch failed:', profileResult.reason?.message);
  }
  if (emrResult.status === 'rejected') {
    console.warn('[EMR Service] EMR prefill fetch failed:', emrResult.reason?.message);
  }

  // Even on a GraphQL error the response may carry partial data. Recover it.
  const profileData = profileResult.status === 'fulfilled'
    ? profileResult.value
    : (profileResult.reason?.data || {});
  const emrData = emrResult.status === 'fulfilled'
    ? emrResult.value
    : (emrResult.reason?.data || {});

  // If no usable profile or EMR data at all, start the form blank
  if (!profileData?.personalLog && Object.keys(emrData).length === 0) {
    console.error('[EMR Service] fetchRevisionPrefill: both requests failed, form will start blank');
    return null;
  }

  const mapped = mapRevisionDataToFormData(profileData, emrData);

  // Resolve the student programId from the label returned by the backend.
  // StudentProfile.program is a label string; StudentProfileInput requires programId: ID!
  const rawProgramLabel = emrData?.emrProfile?.program || emrData?.patientBasicInfo?.program;
  if (rawProgramLabel) {
    try {
      const programs = await searchStudentProgram(rawProgramLabel);
      const match = programs.find(p => p.label === rawProgramLabel);
      if (match) {
        mapped.personalInfo.programId = match.id;
        mapped.personalInfo.program   = match.label;
      }
    } catch (err) {
      console.warn('[EMR Service] Could not resolve programId from label:', err.message);
    }
  }

  // Preview saved photos without staging them again. A null upload ID keeps
  // the existing picture on this ticket unless the patient picks a new file.
  const dentalPhotoRecord = emrData?.dentalPhotoRecord;
  if (dentalPhotoRecord?.upperTeeth) {
    try {
      const preview = await fetchDentalPhotoPreview(dentalPhotoRecord.upperTeeth);
      if (preview) {
        mapped.dentalHistory.upperTeethPhoto = {
          preview,
          name: 'Upper Teeth (previous submission)',
        };
      }
    } catch (err) {
      console.warn('[EMR Service] Could not fetch upper teeth photo preview:', err.message);
    }
  }
  if (dentalPhotoRecord?.lowerTeeth) {
    try {
      const preview = await fetchDentalPhotoPreview(dentalPhotoRecord.lowerTeeth);
      if (preview) {
        mapped.dentalHistory.lowerTeethPhoto = {
          preview,
          name: 'Lower Teeth (previous submission)',
        };
      }
    } catch (err) {
      console.warn('[EMR Service] Could not fetch lower teeth photo preview:', err.message);
    }
  }

  console.log('[EMR Service] Revision pre-fill data mapped successfully');
  return mapped;
};

/**
 * Fetch an existing dental photo for preview in the initial revision form.
 *
 * @param {string} fileId - UUID from DentalPhotoRecord.upperTeeth / lowerTeeth
 * @returns {Promise<string|null>}
 */
const fetchDentalPhotoPreview = async (fileId) => {
  if (!fileId) return null;
  try {
    const response = await axiosRequest({
      method: 'GET',
      url: `/media/record/dentalPhoto/${fileId}`,
      responseType: 'blob',
    });
    return URL.createObjectURL(response.data);
  } catch (err) {
    console.warn('[EMR Service] Could not load prior dental photo:', err.message);
    return null;
  }
};

export const getMyBranchIdentifier = async () => {
  const query = `
    query GetMyBranchIdentifier {
      getPersonalRecord {
        branch
        identifier
      }
    }
  `;
  try {
    const data = await sendGraphQLRequest(query, {}, { endpoint: '/profile/patient' });
    const record = data?.getPersonalRecord;
    if (!record) return null;
    return { branch: record.branch ?? null, identifier: record.identifier ?? null };
  } catch (error) {
    console.warn('[EMR Service] Could not fetch branch identifier:', error.message);
    return null;
  }
};

export const getMyPersonalEmail = async () => {
  // getLoginEmail queries UserCredentials directly, so it works for all users
  // including those who haven't submitted the initial record yet (no UsersPersonal row).
  const query = `
    query GetLoginEmail {
      getLoginEmail
    }
  `;
  try {
    const data = await sendGraphQLRequest(query, {}, { endpoint: '/profile/patient' });
    return data?.getLoginEmail || null;
  } catch (error) {
    console.warn('[EMR Service] Could not fetch login email:', error.message);
    return null;
  }
};

// Module-level cache so multiple components can call getPatientProfile
// without triggering duplicate network requests in the same session.
let _patientProfileCache = null;

const _extractEmergencyContactNumber = (contact) => {
  if (!contact) return null;
  if (typeof contact === 'string') return contact;
  if (typeof contact?.contactNumber === 'string') return contact.contactNumber;
  return null;
};

export const getPatientProfile = async () => {
  if (_patientProfileCache) return _patientProfileCache;

  // Three independent requests so a failure in getMyProfile never blocks
  // the emergency contact fetch.
  const [profileResult, emergencyResult, myProfileResult] = await Promise.allSettled([
    sendGraphQLRequest(
      `query GetPatientProfileData {
        personalLog: getPersonalRecordLog {
          id
          first_name middle_name last_name suffix
          contactNumber
        }
        personalRecord: getPersonalRecord {
          id
          identifier
        }
        personalLogStatus: getPersonalRecordLogStatus
        loginEmail: getLoginEmail
      }`,
      {},
      { endpoint: '/profile/patient' }
    ),
    // Emergency contacts in its own request so it is never blocked by getMyProfile
    sendGraphQLRequest(
      `query GetEmergencyContact {
        emergencyContact: getEmergencyContact(approved: true) {
          firstContact { contactNumber }
          secondContact { contactNumber }
        }
      }`,
      {}
    ),
    // getMyProfile is optional — fails gracefully if backend schema cache is stale
    sendGraphQLRequest(
      `query GetMyProfile {
        myProfile: getMyProfile {
          __typename
          ... on StudentProfile { program year }
          ... on EmployeeProfile { department }
        }
      }`,
      {}
    ),
  ]);

  const profileData = profileResult.status === 'fulfilled'
    ? profileResult.value
    : (profileResult.reason?.data || {});

  if (profileResult.status === 'rejected') {
    console.warn('[EMR Service] Could not fetch patient profile data:', profileResult.reason?.message);
  }

  const emergencyData = emergencyResult.status === 'fulfilled'
    ? emergencyResult.value
    : null;

  if (emergencyResult.status === 'rejected') {
    console.warn('[EMR Service] Could not fetch emergency contact:', emergencyResult.reason?.message);
  }

  const myProfileData = myProfileResult.status === 'fulfilled'
    ? myProfileResult.value
    : null;

  if (myProfileResult.status === 'rejected') {
    console.warn('[EMR Service] Could not fetch profile type (non-critical):', myProfileResult.reason?.message);
  }

  const log = profileData?.personalLog || {};

  const latestEmergency = emergencyData?.emergencyContact
    || (Array.isArray(emergencyData?.emergencyContacts) ? emergencyData.emergencyContacts[0] : null)
    || null;
  const nameParts = [log.first_name, log.middle_name, log.last_name, log.suffix].filter(Boolean);

  const myProfile = myProfileData?.myProfile || null;
  const profileTypeName = myProfile?.__typename || null;

  _patientProfileCache = {
    name: nameParts.length > 0 ? nameParts.join(' ') : null,
    firstName: log.first_name || null,
    email: profileData?.loginEmail || null,
    contactNumber: log.contactNumber || null,
    firstEmergencyContactNumber: _extractEmergencyContactNumber(latestEmergency?.firstContact),
    secondEmergencyContactNumber: _extractEmergencyContactNumber(latestEmergency?.secondContact),
    identifier: profileData?.personalRecord?.identifier || null,
    // Student/Employee profile data
    profileType: profileTypeName, // 'StudentProfile' | 'EmployeeProfile' | null
    yearLevel: profileTypeName === 'StudentProfile' ? (myProfile?.year || null) : null,
    program: profileTypeName === 'StudentProfile' ? (myProfile?.program || null) : null,
    department: profileTypeName === 'EmployeeProfile' ? (myProfile?.department || null) : null,
  };

  return _patientProfileCache;
};

export const checkInitialRecordStatus = async () => {
  console.log('[EMR Service] Checking initial record status...');

  // Query credential status (profile) and update ticket (EMR) in parallel.
  // getCredentialStatus is the authoritative signal: Unverified = new patient.
  const [credentialResult, ticketResult] = await Promise.allSettled([
    sendGraphQLRequest(
      `query GetCredentialStatus { getCredentialStatus }`,
      {},
      { endpoint: '/profile/patient' }
    ),
    sendGraphQLRequest(
      `query GetUpdateTicket { getUpdateTicket { id status scope notes created_at } }`,
      {}
    ),
  ]);

  const credentialStatus = credentialResult.status === 'fulfilled'
    ? credentialResult.value?.getCredentialStatus
    : null;

  const ticket = ticketResult.status === 'fulfilled'
    ? ticketResult.value?.getUpdateTicket
    : null;

  console.log('[EMR Service] Credential status:', credentialStatus);
  console.log('[EMR Service] Update ticket:', ticket);

  // Primary check: Unverified credential status means the patient is new and
  // must complete the initial record form regardless of any ticket state.
  if (credentialStatus === 'Unverified') {
    const ticketStatus = ticket?.status || null;
    console.log('[EMR Service] Credential is Unverified — initial record required. Ticket status:', ticketStatus);
    return {
      needsInitialRecord: true,
      status: ticketStatus,
      scope: ticket?.scope ?? null,
      ticketId: ticket?.id ?? null,
      notes: ticket?.notes ?? null,
      ticketCreatedAt: ticket?.created_at ?? null,
      credentialStatus,
    };
  }

  // Secondary check: non-Unverified credential (Active / Locked / Disabled) means
  // the patient has already completed and passed the initial record step.
  if (credentialStatus && credentialStatus !== 'Unverified') {
    console.log('[EMR Service] Credential is', credentialStatus, '— initial record already completed');
    return {
      needsInitialRecord: false,
      status: ticket?.status ?? null,
      scope: ticket?.scope ?? null,
      ticketId: ticket?.id ?? null,
      notes: ticket?.notes ?? null,
      ticketCreatedAt: ticket?.created_at ?? null,
      credentialStatus,
    };
  }

  // Fallback (credential fetch failed): fall back to update-ticket heuristic.
  console.warn('[EMR Service] Could not fetch credential status — falling back to ticket heuristic');

  if (!ticket) {
    console.log('[EMR Service] No update ticket found - initial record required');
    return { needsInitialRecord: true, status: null, credentialStatus: null, ticketCreatedAt: null };
  }

  const needsInitialRecord = shouldRequireInitialRecordFromTicketStatus(ticket.status);

  console.log('[EMR Service] Initial record status (fallback):', {
    needsInitialRecord,
    currentStatus: ticket.status,
  });

  return {
    needsInitialRecord,
    status: ticket.status,
    scope: ticket.scope ?? null,
    ticketId: ticket.id,
    notes: ticket.notes ?? null,
    ticketCreatedAt: ticket.created_at ?? null,
    credentialStatus: null,
  };
};

export default {
  createInitialMedicalRecord,
  createInitialEmployeeRecord,
  checkInitialRecordStatus
};
