/**
 * EMR Service - Handles all GraphQL mutations and queries for EMR data
 */

import { axiosRequest } from '../packages-core-adapter';
import { sendGraphQLRequest } from '../utils/graphql-client';

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
 * Ensure an update ticket exists for the current user.
 * If one already exists (InProgress or Revision), returns its ID.
 * Otherwise creates a new ticket with the given scope.
 * Silently returns null on failure so callers can treat it as non-blocking.
 * @param {string} scope - 'Medical', 'Dental', or 'Both'
 * @returns {Promise<string|null>} ticket ID or null
 */
export const ensureUpdateTicket = async (scope = 'Both') => {
  try {
    const existing = await fetchCurrentUpdateTicket();
    if (existing?.id && (existing.status === 'InProgress' || existing.status === 'Revision')) {
      console.log('[EMR Service] Update ticket already exists:', existing.id, existing.status);
      return existing.id;
    }
    const ticketId = await createUpdateTicket(scope);
    console.log('[EMR Service] Early update ticket created:', ticketId);
    return ticketId;
  } catch (error) {
    console.warn('[EMR Service] ensureUpdateTicket failed (non-blocking):', error.message);
    return null;
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
 * This must be called when registerProfileSetup succeeds but a later step fails,
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
 * Batch both profile setup mutations (branch identifier + personal info)
 * into a single POST /profile/patient request.
 *
 * @param {string} identifier - Student/employee number
 * @param {object} personalInfo - formData.personalInfo
 * @param {boolean} isRevision - When true, pre-cancels the existing InProgress log before creating a new one
 */
const registerProfileSetup = async (identifier, personalInfo, isRevision = false, { branch } = {}) => {
  const pi = personalInfo || {};
  const hasIdentifier = !!identifier?.trim();

  const personalInput = {
    first_name:       pi.firstName?.trim()        || '',
    middle_name:      pi.middleName?.trim()       || '',
    last_name:        pi.surname?.trim()          || '',
    suffix:           pi.suffix?.trim()           || null,
    date_of_birth:    pi.birthday                || null,
    sex:              pi.gender                  || null,
    civil_status:     pi.civilStatus             || null,
    nationality:      pi.nationality?.trim()     || '',
    religion:         pi.religion?.trim()        || '',
    contactNumber:    pi.contactNumber?.trim()   || '',
    present_address:  pi.address?.trim()         || '',
    province_address: pi.provinceAddress?.trim() || pi.address?.trim() || '',
  };

  // For revisions: cancel the existing Revision log so createInitialPersonalRecord
  // won't be blocked by the "revision still pending" guard.
  if (isRevision) {
    await cancelPersonalRecordLog();
    console.log('[EMR Service] Revision: pre-cancelled existing personal record log');
  }

  // For revisions, use createInitialPersonalRecord (works for Unverified users and
  // atomically handles the branch identifier via UPSERT — safe to re-send existing values).
  if (isRevision) {
    const initialInput = {
      ...personalInput,
      identifier: identifier?.trim() || '',
      branch: branch || 'Manila', // backend overrides for students based on email prefix
    };

    const revisionMutation = `mutation ProfileSetup($input: userProfileInitialInput!) {
      createInitialPersonalRecord(input: $input) { first_name last_name branch identifier }
    }`;

    try {
      const result = await sendGraphQLRequest(revisionMutation, { input: initialInput }, { endpoint: '/profile/patient' });
      console.log('[EMR Service] Revision profile setup complete:', {
        branch: result?.createInitialPersonalRecord?.branch,
        identifier: result?.createInitialPersonalRecord?.identifier,
      });
    } catch (error) {
      const msg = error.message?.toLowerCase() || '';
      if (msg.includes('already in progress') || msg.includes('revision still pending')) {
        console.warn('[EMR Service] Stale log on revision — cancelling and retrying...', error.message);
        try { await cancelPersonalRecordLog(); } catch (_) { /* ignore */ }
        const result = await sendGraphQLRequest(revisionMutation, { input: initialInput }, { endpoint: '/profile/patient' });
        console.log('[EMR Service] Revision profile setup complete (after stale-log recovery):', {
          branch: result?.createInitialPersonalRecord?.branch,
          identifier: result?.createInitialPersonalRecord?.identifier,
        });
        return;
      }
      console.error('[EMR Service] Failed to register revision profile setup:', error);
      throw error;
    }
    return;
  }

  // --- Non-revision path (legacy): batch createBranchIdentifier + createPersonalRecordLog ---
  // createBranchIdentifier is conditional — skip it if no identifier is available.
  const mutation = hasIdentifier
    ? `mutation ProfileSetup($branchInput: BranchIdentifierInput!, $input: userProfileInput!) {
        createBranchIdentifier(input: $branchInput) { branch identifier }
        createPersonalRecordLog(input: $input) { first_name last_name }
      }`
    : `mutation ProfileSetup($input: userProfileInput!) {
        createPersonalRecordLog(input: $input) { first_name last_name }
      }`;

  const branchInput = { identifier: identifier.trim() };
  if (branch) branchInput.branch = branch;

  const variables = hasIdentifier
    ? { branchInput, input: personalInput }
    : { input: personalInput };

  try {
    const result = await sendGraphQLRequest(mutation, variables, { endpoint: '/profile/patient' });
    console.log('[EMR Service] Profile setup complete:', {
      branch: result?.createBranchIdentifier?.branch,
      identifier: result?.createBranchIdentifier?.identifier,
    });
  } catch (error) {
    // If a stale record log is blocking the submission, auto-cancel it and retry.
    const msg = error.message?.toLowerCase() || '';
    const isStaleLog = msg.includes('already in progress');
    const isPartialFailure = msg.includes('identifier') && msg.includes('branch');

    if (isStaleLog || isPartialFailure) {
      console.warn('[EMR Service] Stale/partial state detected — cleaning up and retrying...', error.message);
      try { await cancelPersonalRecordLog(); } catch (_) { /* ignore */ }

      if (hasIdentifier) {
        try {
          const retryBranchInput = { identifier: identifier.trim() };
          if (branch) retryBranchInput.branch = branch;
          const branchMutation = `mutation RetryBranch($branchInput: BranchIdentifierInput!) {
            createBranchIdentifier(input: $branchInput) { branch identifier }
          }`;
          await sendGraphQLRequest(branchMutation, { branchInput: retryBranchInput }, { endpoint: '/profile/patient' });
        } catch (branchErr) {
          console.warn('[EMR Service] Branch retry warning (may already exist):', branchErr.message);
        }
      }

      const retryMutation = `mutation ProfileSetupRetry($input: userProfileInput!) {
        createPersonalRecordLog(input: $input) { first_name last_name }
      }`;
      await sendGraphQLRequest(retryMutation, { input: personalInput }, { endpoint: '/profile/patient' });
      console.log('[EMR Service] Profile setup complete (after stale-log recovery):', {
        branch: null,
        identifier: identifier?.trim() || null,
      });
      return;
    }

    console.error('[EMR Service] Failed to register profile setup:', error);
    throw error;
  }
};

/**
 * Register initial profile using the reworked createInitialPersonalRecord mutation.
 * This single mutation atomically creates the personal record log AND sets the
 * branch identifier, replacing the old compound approach that called
 * createBranchIdentifier + createPersonalRecordLog separately.
 *
 * Only works for unverified users. Used for both initial submissions and (via
 * registerProfileSetup) revision resubmissions.
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
    // For new submissions: uses createInitialPersonalRecord which atomically
    // creates both the personal record log and branch identifier in a single mutation.
    // For revisions: registerProfileSetup cancels the existing Revision log then
    // also calls createInitialPersonalRecord (Unverified users only).
    console.log('[EMR Service] [1/3] Registering profile + branch identifier...');
    if (isRevision) {
      await registerProfileSetup(formData.personalInfo?.studentNumber, formData.personalInfo, isRevision);
    } else {
      await registerInitialProfile(formData.personalInfo?.studentNumber, formData.personalInfo);
    }
    profileLogCreated = !isRevision; // only mark for cleanup if a new log was created

    // ======== REQUEST 2 (parallel): Resolve ticket + upload dental photos ========
    // For revisions: pre-fetch the existing Revision ticket to avoid a 400 from
    // createUpdateTicket, then reuse its ID directly.
    // For new submissions: createUpdateTicket and both photo uploads fire together.
    console.log('[EMR Service] [2/3] Creating ticket & uploading photos (parallel)...');

    let ticketPromise;
    if (isRevision) {
      const existing = await fetchCurrentUpdateTicket();
      if (existing?.status === 'Revision') {
        console.log('[EMR Service] Revision: reusing existing ticket:', existing.id);
        ticketPromise = Promise.resolve(existing.id);
        // ticket already exists — no new ticket to cancel on error
      } else {
        // Unexpected state (e.g. ticket was already submitted) — fall through to create
        ticketPromise = createUpdateTicket('Both');
      }
    } else {
      // Check if a ticket was already created early (e.g. by ensureUpdateTicket on form mount)
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
export const createInitialEmployeeRecord = async (formData) => {
  console.log('[EMR Service] Starting initial EMPLOYEE medical record creation (batched)');

  let ticketCreated = false;
  let profileLogCreated = false;
  let upperTeethFileId = null;
  let lowerTeethFileId = null;

  try {
    const results = {};

    // ======== REQUEST 1: Profile setup (branch identifier + personal info) ========
    // Uses the reworked createInitialPersonalRecord which atomically creates both
    // the personal record log and branch identifier in a single mutation.
    console.log('[EMR Service] [1/3] Registering profile + branch identifier...');
    await registerInitialProfile(formData.personalInfo?.employeeId, formData.personalInfo, { branch: formData.personalInfo?.branch });
    profileLogCreated = true;

    // ======== REQUEST 2 (parallel): Create ticket + upload dental photos ========
    console.log('[EMR Service] [2/3] Creating ticket & uploading photos (parallel)...');
    const [ticketResult, upperResult, lowerResult] = await Promise.allSettled([
      createUpdateTicket('Both'),
      uploadMediaFile(formData.dentalHistory?.upperTeethPhoto?.file ?? null),
      uploadMediaFile(formData.dentalHistory?.lowerTeethPhoto?.file ?? null),
    ]);

    if (ticketResult.status === 'fulfilled') { ticketCreated = true; results.ticketId = ticketResult.value; }
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
      medicalConditionCatalog: getDomainCatalogs(domain: MedicalCondition, filterIsValid: true, limit: 200) {
        id
        code
        name
      }
      hospitalizationCatalog: getDomainCatalogs(domain: Hospitalization, filterIsValid: true, limit: 200) {
        id
        code
        name
      }
      operationCatalog: getDomainCatalogs(domain: Operation, filterIsValid: true, limit: 200) {
        id
        code
        name
      }
      medicationCatalog: getDomainCatalogs(domain: Medication, filterIsValid: true, limit: 200) {
        id
        code
        name
      }
      immunizationCatalog: getDomainCatalogs(domain: Immunization, filterIsValid: true, limit: 200) {
        id
        code
        name
      }
      allergenCatalog: getAllergenCatalogs(filterIsValid: true, limit: 200) {
        id
        allergen
        type
      }
      oralApplianceCatalog: getOralApplianceCatalogs(filterIsValid: true, limit: 200) {
        id
        name
        description
      }
      visualAcuityCatalog: getDomainCatalogs(domain: VisualAcuity, filterIsValid: true, limit: 200) {
        id
        code
        name
      }
      dentalProcedureCatalog: getDomainCatalogs(domain: DentalProcedure, filterIsValid: true, limit: 200) {
        id
        code
        name
      }
    }
  `;
  try {
    const data = await sendGraphQLRequest(query, {});
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

// ─── Record Builder Functions ─────────────────────────────────────────────────

/**
 * Build MedicalHistory.conditions from checked catalog IDs.
 * formData.medicalHistory.self  = { [conditionCatalogId]: true/false }
 * formData.medicalHistory.family = { [conditionCatalogId]: true/false }
 * formData.medicalHistory.familyWhoHasIt = { [conditionCatalogId]: "Mother / Father / ..." }
 */
const buildMedicalConditionRecords = (medicalHistory) => {
  const notes = [];
  const conditions = [
    // Self conditions
    ...Object.entries(medicalHistory?.self || {})
      .filter(([, checked]) => checked)
      .map(([id]) => ({ conditionId: id, diagnosedDate: null, relationship: null, description: null })),
    // Family conditions — relationship field carries the family member name
    ...Object.entries(medicalHistory?.family || {})
      .filter(([, checked]) => checked)
      .map(([id]) => {
        const who = medicalHistory.familyWhoHasIt?.[id] || 'Family';
        return { conditionId: id, diagnosedDate: null, relationship: who, description: null };
      }),
  ];
  // Free-text "other" entries (no catalog ID) → append to notes
  if (medicalHistory?.selfOther) notes.push(`Self: ${medicalHistory.selfOther}`);
  if (medicalHistory?.familyOther) {
    const who = medicalHistory.familyOtherWhoHasIt;
    notes.push(who
      ? `Family other: ${medicalHistory.familyOther} (${who})`
      : `Family other: ${medicalHistory.familyOther}`);
  }
  return { conditions, notes: notes.length ? notes.join('; ') : null };
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
      status: 'Active',
      severity: (typeof val === 'object' && val?.severity) ? val.severity : 'Unknown',
      notes: null,
      date_identified: null,
    }));
  if (medicalBackground.allergyOther) notes.push(`Other: ${medicalBackground.allergyOther}`);
  return { allergies, notes: notes.length ? notes.join('; ') : null };
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
  const noteParts = [];
  const immunizationRecords = Object.entries(medicalBackground?.immunizations || {})
    .filter(([, checked]) => checked)
    .flatMap(([id]) => {
      if (!validIds.has(id)) { noteParts.push(id); return []; }
      const date = medicalBackground?.immunizationDates?.[id] || today;
      return [{ vaccineTypeId: id, immunizationDate: date, doseNumber: 1 }];
    });
  if (medicalBackground?.immunizationOther?.trim()) {
    noteParts.push(`Other: ${medicalBackground.immunizationOther.trim()}`);
  }
  return { immunizationRecords, immunizationNotes: noteParts.length ? noteParts.join('; ') : null };
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
  return { appliances, notes: dentalHistory?.applianceOther || null };
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
  if (formData.personalInfo.program) {
    inputs.studentProfile = {
      program: formData.personalInfo.program === 'Other' 
        ? formData.personalInfo.programOther 
        : formData.personalInfo.program,
      year: mapYearLevel(formData.personalInfo.studentCategory)
    };
  }

  // Employee Profile (conditional)
  if (formData.personalInfo.department) {
    const ROLE_MAP = {
      'Teaching':              'Faculty',
      'Teaching (Officer)':    'AcademicHead',
      'Non-Teaching':          'Staff',
      'Non-Teaching (Officer)':'AcademicHead',
      'Other':                 'Other',
    };
    const rawCategory = formData.personalInfo.employmentCategory === 'Other'
      ? formData.personalInfo.employmentCategoryOther
      : formData.personalInfo.employmentCategory;
    const mappedRole = ROLE_MAP[rawCategory] || 'Employee';
    inputs.employeeProfile = {
      department: formData.personalInfo.department,
      role: mappedRole,
      position: formData.personalInfo.position || ''
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
  const { conditions: medConditions, notes: medNotes } = buildMedicalConditionRecords(formData.medicalHistory);
  inputs.medicalHistory = { conditions: medConditions, notes: medNotes };

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
  const { immunizationRecords, immunizationNotes } = buildImmunizationRecords(
    formData.medicalBackground,
    immunizationCatalog
  );
  inputs.immunizationProfile = { immunizations: immunizationRecords, notes: immunizationNotes };

  // Lifestyle
  inputs.lifestyle = {
    smoker: formData.medicalBackground.smoker === 'yes',
    vapeUser: formData.medicalBackground.smoker === 'vape',
    vapeType: formData.medicalBackground.smoker === 'vape' 
      ? formData.medicalBackground.vapeType || null : null,
    vapeFrequency: formData.medicalBackground.smoker === 'vape'
      ? formData.medicalBackground.vapeFrequency || null : null,
    yearsVaping: formData.medicalBackground.smoker === 'vape'
      ? (formData.medicalBackground.yearsVaping ? parseInt(formData.medicalBackground.yearsVaping) : null) : null,
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
    notes: null
  };

  // Visual Acuity Profile
  const hasVisualAcuity = formData.medicalBackground.eyeglasses || formData.medicalBackground.contactLenses;
  // Use the first catalog entry for acuityId — falls back to null (acuity omitted) if catalog is empty
  const visualAcuityId = visualAcuityCatalog[0]?.id ?? null;
  inputs.visualAcuityProfile = {
    notes: hasVisualAcuity
      ? `Eyeglasses: ${formData.medicalBackground.eyeglasses ? 'Yes' : 'No'}, Contact Lenses: ${formData.medicalBackground.contactLenses ? 'Yes' : 'No'}`
      : null,
    acuity: hasVisualAcuity && visualAcuityId
      ? {
          acuityId: visualAcuityId,
          left_eye: formData.medicalBackground.gradeOS || "N/A",
          right_eye: formData.medicalBackground.gradeOD || "N/A",
          notes: null,
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
  const { appliances, notes: oralNotes } = buildOralApplianceRecords(formData.dentalHistory, oralApplianceCatalog);
  inputs.oralApplianceProfile = { appliances, notes: oralNotes };

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
  const addMutation = (alias, mutationName, inputType, inputKey, varName) => {
    variableDefs.push(`$${varName}: ${inputType}!`);
    mutationParts.push(`${alias}: ${mutationName}(input: $${varName}) { id }`);
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
  addMutation('dentalPhotoRecord', 'createDentalPhotoRecord', 'DentalPhotoRecordInput', 'dentalPhotoRecord', 'dentalPhotoInput');

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
  const validEnumValues = new Set(['Grade11', 'Grade12', 'Freshman', 'Sophomore', 'Junior', 'Senior', 'Masteral', 'Doctorate']);
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
  const validEnumValues = new Set(['Grade11', 'Grade12', 'Freshman', 'Sophomore', 'Junior', 'Senior', 'Masteral', 'Doctorate']);
  if (validEnumValues.has(backendYear)) return backendYear;
  return '';
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
const mapRevisionDataToFormData = (profileData, emrData) => {
  // personalLog = candidate data from UsersPersonalLog (the patient's submitted form)
  const pr  = profileData?.personalLog || {};
  const bid = profileData?.branchId;
  const emr = emrData || {};

  // ── Personal Info ──────────────────────────────────────────
  const rawProgram       = emr?.emrProfile?.program || '';
  const isKnownProgram   = KNOWN_PROGRAMS.has(rawProgram);
  const ec               = emr?.emergencyContact || {};

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
    studentNumber:      bid?.identifier   || '',
    program:            isKnownProgram ? rawProgram : (rawProgram ? 'Other' : ''),
    programOther:       isKnownProgram ? '' : rawProgram,
    studentCategory:    reverseMapYearLevel(emr?.emrProfile?.year || ''),
    drugTestDone:       '',   // not persisted
    lastSchoolAttended: '',   // not persisted
    emergencyContacts: [
      {
        name:          ec.firstContact?.contactName   || '',
        relationship:  ec.firstContact?.relationship  || '',
        contactNumber: ec.firstContact?.contactNumber || '',
        address:       ec.firstContact?.address       || '',
      },
      {
        name:          ec.secondContact?.contactName   || '',
        relationship:  ec.secondContact?.relationship  || '',
        contactNumber: ec.secondContact?.contactNumber || '',
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

  const allergyMap  = Object.fromEntries(allergies.map(a => [a.allergenCatalogId, { checked: true, severity: a.severity || 'Unknown' }]));
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

  const vaNotesStr = va.notes || '';
  const medicalBackground = {
    immunizations:             immunMap,
    immunizationDates:         immunDatesMap,
    immunizationOther:         '',
    hasAllergies:              allergies.length > 0    ? 'Yes' : 'No',
    allergies:                 allergyMap,
    allergyOther:              '',
    hasHospitalization:        hosps.length > 0        ? 'Yes' : 'No',
    hospitalizationConditions: hospMap,
    hospitalizationDates:      hospDatesMap,
    hospitalizationNotes:      emr?.hospitalizationProfile?.notes || '',
    hasOperation:              ops.length > 0          ? 'Yes' : 'No',
    operationConditions:       opsMap,
    operationDates:            opsDatesMap,
    operationNotes:            emr?.operationProfile?.notes || '',
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
    eyeglasses:                vaNotesStr.includes('Eyeglasses: Yes') || !!(va.acuity?.right_eye || va.acuity?.left_eye),
    contactLenses:             vaNotesStr.includes('Contact Lenses: Yes'),
    gradeOD:                   va.acuity?.right_eye    || '',
    gradeOS:                   va.acuity?.left_eye     || '',
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
    hasIntraOralAppliance: appliances.length > 0 ? 'yes' : 'no',
    intraOralAppliances:   applianceMap,
    applianceLocation:     appliances[0]?.arch || '',
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
export const fetchRevisionPrefill = async () => {
  console.log('[EMR Service] Fetching revision pre-fill data...');

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
      { endpoint: '/profile/patient' }
    ),

    // ── Request 2: all EMR data (batched) ─────────────────
    sendGraphQLRequest(
      `query GetRevisionEMRData {
        emrProfile: getProfile {
          ... on StudentProfile { program year }
          ... on EmployeeProfile { department role }
        }
        emergencyContact: getEmergencyContact {
          firstContact  { contactName relationship contactNumber address }
          secondContact { contactName relationship contactNumber address }
        }
        medicalHistory: getMedicalHistory {
          conditions { conditionId relationship }
          notes
        }
        allergyProfile: getAllergyProfile {
          allergies { allergenCatalogId status severity }
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
          immunizations { vaccineTypeId immunizationDate }
          notes
        }
        lifestyle: getLifestyle {
          smoker numberOfCigarettesPerDay yearsSmoked
          alcoholConsumer frequencyOfAlcoholConsumption
          vapeUser vapeType vapeFrequency
        }
        visualAcuity: getVisualAcuityProfile {
          notes
          acuity { left_eye right_eye recorded_at }
        }
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
        }
        obgyne: getObgynHistory {
          lastMenstrualPeriod hasDysmenorrhea notes
        }
      }`,
      {}
    ),
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

  // Fetch previously submitted dental photos.
  // Store them as { file, preview } so uploadMediaFile() can re-stage the photo
  // via the normal flow — passing a permanent UUID directly to createDentalPhotoRecord
  // would fail because the backend expects a staged file UUID.
  const dentalPhotoRecord = emrData?.dentalPhotoRecord;
  if (dentalPhotoRecord?.upperTeeth) {
    try {
      const result = await fetchDentalPhotoAsBlob(dentalPhotoRecord.upperTeeth, 'upper-teeth');
      if (result) {
        mapped.dentalHistory.upperTeethPhoto = {
          file: result.file,
          preview: result.preview,
          name: 'Upper Teeth (previous submission)',
        };
      }
    } catch (err) {
      console.warn('[EMR Service] Could not fetch upper teeth photo preview:', err.message);
    }
  }
  if (dentalPhotoRecord?.lowerTeeth) {
    try {
      const result = await fetchDentalPhotoAsBlob(dentalPhotoRecord.lowerTeeth, 'lower-teeth');
      if (result) {
        mapped.dentalHistory.lowerTeethPhoto = {
          file: result.file,
          preview: result.preview,
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
 * Fetch a dental photo from the backend and return a File + preview URL.
 * The File is used by uploadMediaFile() to re-stage the photo so the normal
 * stage → createDentalPhotoRecord flow works correctly on revision submission.
 *
 * @param {string} fileId - UUID from DentalPhotoRecord.upperTeeth / lowerTeeth
 * @param {string} label  - Human-readable label used as the file name
 * @returns {Promise<{file: File, preview: string}|null>}
 */
const fetchDentalPhotoAsBlob = async (fileId, label = 'teeth') => {
  if (!fileId) return null;
  try {
    const response = await axiosRequest({
      method: 'GET',
      url: `/media/record/dentalPhoto/${fileId}`,
      responseType: 'blob',
    });
    const blob = response.data;
    const ext = blob.type?.split('/')[1] || 'jpg';
    const file = new File([blob], `${label}.${ext}`, { type: blob.type || 'image/jpeg' });
    const preview = URL.createObjectURL(blob);
    return { file, preview };
  } catch (err) {
    console.warn('[EMR Service] fetchDentalPhotoAsBlob failed:', err.message);
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

  const [profileResult, emergencyResult] = await Promise.allSettled([
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
    sendGraphQLRequest(
      `query GetEmergencyContact {
        emergencyContact: getEmergencyContact(approved: true) {
          firstContact { contactNumber }
          secondContact { contactNumber }
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
    console.warn('[EMR Service] Active emergency contact fetch failed:', emergencyResult.reason?.message);
  }

  const log = profileData?.personalLog || {};

  const latestEmergency = emergencyData?.emergencyContact
    || (Array.isArray(emergencyData?.emergencyContacts) ? emergencyData.emergencyContacts[0] : null)
    || null;
  const nameParts = [log.first_name, log.middle_name, log.last_name, log.suffix].filter(Boolean);

  _patientProfileCache = {
    name: nameParts.length > 0 ? nameParts.join(' ') : null,
    firstName: log.first_name || null,
    email: profileData?.loginEmail || null,
    contactNumber: log.contactNumber || null,
    firstEmergencyContactNumber: _extractEmergencyContactNumber(latestEmergency?.firstContact),
    secondEmergencyContactNumber: _extractEmergencyContactNumber(latestEmergency?.secondContact),
    identifier: profileData?.personalRecord?.identifier || null,
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
      `query GetUpdateTicket { getUpdateTicket { id status notes } }`,
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
    return { needsInitialRecord: true, status: ticketStatus, ticketId: ticket?.id ?? null, notes: ticket?.notes ?? null };
  }

  // Secondary check: non-Unverified credential (Active / Locked / Disabled) means
  // the patient has already completed and passed the initial record step.
  if (credentialStatus && credentialStatus !== 'Unverified') {
    console.log('[EMR Service] Credential is', credentialStatus, '— initial record already completed');
    return { needsInitialRecord: false, status: ticket?.status ?? null, ticketId: ticket?.id ?? null, notes: ticket?.notes ?? null };
  }

  // Fallback (credential fetch failed): fall back to update-ticket heuristic.
  console.warn('[EMR Service] Could not fetch credential status — falling back to ticket heuristic');

  if (!ticket) {
    console.log('[EMR Service] No update ticket found - initial record required');
    return { needsInitialRecord: true, status: null };
  }

  const completedStatuses = ['Pending', 'Approved', 'RevisionSubmitted'];
  const needsInitialRecord = !completedStatuses.includes(ticket.status);

  console.log('[EMR Service] Initial record status (fallback):', {
    needsInitialRecord,
    currentStatus: ticket.status,
  });

  return { needsInitialRecord, status: ticket.status, ticketId: ticket.id, notes: ticket.notes ?? null };
};

export default {
  createInitialMedicalRecord,
  createInitialEmployeeRecord,
  checkInitialRecordStatus
};
