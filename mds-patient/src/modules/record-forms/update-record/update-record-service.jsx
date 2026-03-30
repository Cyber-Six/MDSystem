/**
 * Update Record Service
 * 
 * Handles GraphQL mutations for creating/updating medical and dental records
 * Supports three update scopes: Medical, Dental, Both
 */

import { axiosRequest } from '../../../packages-core-adapter';
import { updatePersonalInfo } from './personal-info-service';

// Debug logging - set to false to silence console logs
const DEBUG = false;

// Helper function for conditional logging
const log = (...args) => DEBUG && console.log(...args);
const warn = (...args) => DEBUG && console.warn(...args);

/**
 * Upload a file to the media staging endpoint
 * @param {File|null} file - Browser File object
 * @returns {Promise<string|null>} Staged fileId UUID, or null if no file
 */
async function uploadMediaFile(file) {
  if (!file) return null;
  const body = new FormData();
  body.append('file', file);
  const response = await axiosRequest.post('/media/stage/', body, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  console.log('📸 Media file staged, fileId:', response.data.fileId);
  return response.data.fileId;
}

/**
 * Delete a previously staged media file
 * @param {string|null} fileId - UUID returned by uploadMediaFile
 */
async function unstageMediaFile(fileId) {
  if (!fileId) return;
  try {
    await axiosRequest.delete(`/media/unstage/${fileId}`);
    console.log('🗑️ Staged media file removed:', fileId);
  } catch (error) {
    console.warn('⚠️ Failed to remove staged media file:', fileId, error.message);
  }
}

/**
 * Sends GraphQL request to backend
 * @param {string} query - GraphQL query or mutation string
 * @param {object} variables - Query/mutation variables
 * @returns {Promise<object>} GraphQL response data
 */
async function sendGraphQLRequest(query, variables = {}) {
  try {
    const response = await axiosRequest({
      method: 'POST',
      url: '/emr/patient',
      data: {
        query,
        variables
      }
    });

    // Handle GraphQL errors gracefully
    if (response.data.errors && response.data.errors.length > 0) {
      console.warn('⚠️ GraphQL Errors:', response.data.errors.map(e => e.message).join(', '));
      
      // If we have partial data (field-level errors in scope-aware queries), accept it
      // This happens when querying only Dental fields but backend returns "No active profile" 
      // for medical fields that weren't included in the query
      if (response.data.data && Object.keys(response.data.data).length > 0) {
        console.log('✓ Returning partial data despite field-level errors');
        return response.data.data;
      }
      
      // If data is completely null (backend table missing, no records, etc.), return empty object
      if (response.data.data === null) {
        return {};
      }
      
      // Otherwise, throw the error
      throw new Error(response.data.errors.map(e => e.message).join(', '));
    }

    // Return the actual GraphQL data object
    return response.data.data || response.data;
  } catch (error) {
    console.error('✗ GraphQL Request Error:', error.message);
    throw error;
  }
}

// ==================== UPDATE TICKET MANAGEMENT ====================

/**
 * Gets the current active update ticket status
 * @returns {Promise<object>} Ticket details {id, status} or null if no active ticket
 */
export async function getUpdateTicketStatus() {
  const query = `
    query GetUpdateTicketStatus {
      getUpdateTicket {
        id
        status
        scope
      }
    }
  `;

  try {
    console.log('🔍 Fetching current update ticket status...');
    const response = await sendGraphQLRequest(query, {});
    
    if (response.getUpdateTicket) {
      console.log('✓ Current ticket status:', response.getUpdateTicket);
      return response.getUpdateTicket;
    }
    
    console.log('✓ No active update ticket');
    return null;
  } catch (error) {
    console.log('ℹ️ Could not fetch ticket status:', error.message);
    return null;
  }
}

/**
 * Get the current update ticket with full details including status and revision notes
 * Used to detect if patient has a pending revision request from staff
 * @returns {Promise<{id, status, notes} | null>} Ticket details or null if no ticket
 */
export async function getUpdateRevisionStatus() {
  const query = `
    query GetUpdateTicket {
      getUpdateTicket {
        id
        status
        scope
        notes
      }
    }
  `;

  try {
    console.log('[UpdateRevision] 🔍 Checking for revision status...');
    const response = await sendGraphQLRequest(query, {});
    
    if (response.getUpdateTicket) {
      const ticket = response.getUpdateTicket;
      console.log('[UpdateRevision] ✓ Ticket status:', ticket.status, 'Scope:', ticket.scope);
      
      if (ticket.status === 'Revision') {
        console.log('[UpdateRevision] ⚠️ REVISION DETECTED - Staff notes:', ticket.notes);
      }
      
      return ticket;
    }
    
    console.log('[UpdateRevision] ✓ No active ticket');
    return null;
  } catch (error) {
    console.log('[UpdateRevision] ℹ️ Could not fetch revision status:', error.message);
    return null;
  }
}

/**
 * Fetch the patient's previous medical/dental records for pre-filling the form during revision
 * Builds a scope-specific query based on the revision scope (Medical/Dental/Both)
 * @returns {Promise<object>} Previous form data to pre-fill the revision form
 */
export async function fetchUpdateRevisionPrefill() {
  console.log('[UpdateRevision] 📥 Fetching previous submission data for revision pre-fill...');
  
  try {
    // First, get the ticket scope to build the appropriate query
    const ticket = await getUpdateTicketStatus();
    const scope = ticket?.scope || 'Both'; // Default to Both if no scope
    
    console.log('[UpdateRevision] Query scope:', scope);
    
    // Build query based on scope - only request fields relevant to the revision scope
    let query = `query GetRevisionEMRData {`;
    
    // Always fetch profile and emergency contact (needed for all scopes)
    query += `
      emrProfile: getProfile {
        ... on StudentProfile { program year }
        ... on EmployeeProfile { department role }
      }
      emergencyContact: getEmergencyContact {
        firstContact { contactName relationship contactNumber address }
        secondContact { contactName relationship contactNumber address }
      }`;
    
    // Add medical fields only for Medical or Both scope
    if (scope === 'Medical' || scope === 'Both') {
      query += `
      medicalHistory: getMedicalHistory {
        conditions { conditionId relationship }
        notes
      }
      allergyProfile: getAllergyProfile {
        allergies { allergenCatalogId status severity notes }
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
        notes
      }
      lifestyle: getLifestyle {
        smoker numberOfCigarettesPerDay yearsSmoked
        alcoholConsumer frequencyOfAlcoholConsumption
        notes
      }
      visualAcuityProfile: getVisualAcuityProfile {
        notes
        acuity { acuityId left_eye right_eye notes }
      }
      obgynHistory: getObgynHistory {
        lastMenstrualPeriod hasDysmenorrhea
        notes
      }`;
    }
    
    // Add dental fields only for Dental or Both scope
    if (scope === 'Dental' || scope === 'Both') {
      query += `
      dentalHistory: getDentalHistory {
        seenByDentist lastDentalCleaning purpose lastVisitDate
      }
      dentalProcedureProfile: getDentalProcedureProfile {
        procedures { procedureTypeId procedureDate }
        notes
      }
      dentalPhotoRecord: getDentalPhotoRecord {
        upperTeeth lowerTeeth
      }
      oralApplianceProfile: getOralApplianceProfile {
        appliances { tagId status dateIssued arch }
        notes
      }`;
    }
    
    query += `
    }`;
    
    const response = await sendGraphQLRequest(query, {});
    console.log('[UpdateRevision] ✅ Pre-fill data fetched:', response);
    
    // Transform backend data to form data structure
    const formData = await mapRevisionDataToFormData(response);
    console.log('[UpdateRevision] ✅ Pre-fill data mapped to form structure:', formData);
    
    return formData;
  } catch (error) {
    console.warn('[UpdateRevision] ⚠️ Could not fetch pre-fill data:', error.message);
    // Return empty object on error - form will still be accessible, just without pre-fill
    return {};
  }
}

/**
 * Transform backend GraphQL data to form field names and structures
 * Maps database field names to component form field names
 * @param {object} backendData - Data from GraphQL query (see fetchUpdateRevisionPrefill)
 * @returns {Promise<object>} Form data with all fields properly renamed and structured
 */
async function mapRevisionDataToFormData(backendData) {
  const formData = {};

  console.log('[MapRevisionData] ========== STARTING DATA TRANSFORMATION ==========');
  console.log('[MapRevisionData] Backend data received:', JSON.stringify(backendData, null, 2));

  // ======== PERSONAL INFO ========
  
  // Emergency Contact
  if (backendData.emergencyContact?.firstContact) {
    const firstContact = backendData.emergencyContact.firstContact;
    formData.emergencyContact1Name = firstContact.contactName || '';
    formData.emergencyContact1Relationship = firstContact.relationship || '';
    formData.emergencyContact1Number = firstContact.contactNumber || '';
  }

  if (backendData.emergencyContact?.secondContact) {
    const secondContact = backendData.emergencyContact.secondContact;
    formData.emergencyContact2Name = secondContact.contactName || '';
    formData.emergencyContact2Relationship = secondContact.relationship || '';
    formData.emergencyContact2Number = secondContact.contactNumber || '';
  }

  // School/Employee Profile
  if (backendData.emrProfile?.program) {
    formData.program = backendData.emrProfile.program || '';
    formData.schoolYear = backendData.emrProfile.year || '';
  }
  if (backendData.emrProfile?.department) {
    formData.employeeDepartment = backendData.emrProfile.department || '';
    formData.employeeRole = backendData.emrProfile.role || '';
  }

  // ======== MEDICAL HISTORY ========
  
  // Medical Conditions
  console.log('[MapRevisionData] Medical history data:', backendData.medicalHistory);
  if (backendData.medicalHistory?.conditions && Array.isArray(backendData.medicalHistory.conditions) && backendData.medicalHistory.conditions.length > 0) {
    formData.selfConditions = {};
    formData.familyConditions = {};
    
    for (const condition of backendData.medicalHistory.conditions) {
      console.log('[MapRevisionData] Processing condition:', condition);
      // Self conditions have relationship === null or undefined
      if (!condition.relationship || condition.relationship === 'Self' || condition.relationship === null) {
        formData.selfConditions[condition.conditionId] = true;
        console.log('[MapRevisionData] Added self condition:', condition.conditionId);
      } else if (condition.relationship) {
        // Family conditions have a relationship name
        formData.familyConditions[condition.conditionId] = {
          checked: true,
          relationship: condition.relationship
        };
        console.log('[MapRevisionData] Added family condition:', condition.conditionId, 'relationship:', condition.relationship);
      }
    }
    console.log('[MapRevisionData] Conditions prefilled - Self:', formData.selfConditions, 'Family:', formData.familyConditions);
  } else {
    console.log('[MapRevisionData] No medical conditions to prefill');
    formData.selfConditions = {};
    formData.familyConditions = {};
  }

  // Allergies
  console.log('[MapRevisionData] Allergy profile data:', backendData.allergyProfile);
  if (backendData.allergyProfile?.allergies && Array.isArray(backendData.allergyProfile.allergies)) {
    formData.hasAllergies = 'yes';
    formData.selectedAllergies = [];
    formData.allergyDetails = {};

    for (const allergy of backendData.allergyProfile.allergies) {
      formData.selectedAllergies.push(allergy.allergenCatalogId);
      formData.allergyDetails[allergy.allergenCatalogId] = {
        status: allergy.status || 'Active',
        severity: allergy.severity || 'Mild'
      };
    }
  } else {
    formData.hasAllergies = 'no';
  }

  // Hospitalization
  console.log('[MapRevisionData] Hospitalization profile data:', backendData.hospitalizationProfile);
  if (backendData.hospitalizationProfile?.hospitalizations && Array.isArray(backendData.hospitalizationProfile.hospitalizations) && backendData.hospitalizationProfile.hospitalizations.length > 0) {
    formData.hasHospitalizations = 'yes';
    const hosp = backendData.hospitalizationProfile.hospitalizations[0];
    formData.hospitalizationCondition = hosp.conditionId || '';
    // Convert ISO dates to yyyy-MM-dd format
    formData.admissionDate = hosp.admissionDate ? hosp.admissionDate.split('T')[0] : '';
    formData.dischargeDate = hosp.dischargeDate ? hosp.dischargeDate.split('T')[0] : '';
  } else {
    formData.hasHospitalizations = 'no';
  }

  // Surgery/Operations
  console.log('[MapRevisionData] Operation profile data:', backendData.operationProfile);
  if (backendData.operationProfile?.operations && Array.isArray(backendData.operationProfile.operations) && backendData.operationProfile.operations.length > 0) {
    formData.hasSurgeries = 'yes';
    const op = backendData.operationProfile.operations[0];
    formData.surgeryType = op.procedureId || '';
    // Convert ISO date to yyyy-MM-dd format
    formData.operationDate = op.operationDate ? op.operationDate.split('T')[0] : '';
  } else {
    formData.hasSurgeries = 'no';
  }

  // Medications
  console.log('[MapRevisionData] Medication profile data:', backendData.medicationProfile);
  if (backendData.medicationProfile?.medications && Array.isArray(backendData.medicationProfile.medications) && backendData.medicationProfile.medications.length > 0) {
    formData.hasMedications = 'yes';
    formData.currentMedications = backendData.medicationProfile.medications.map(med => ({
      medicineId: med.medicineId,
      description: med.description || ''
    }));
  } else {
    formData.hasMedications = 'no';
  }

  // Immunizations
  console.log('[MapRevisionData] Immunization profile data:', backendData.immunizationProfile);
  if (backendData.immunizationProfile?.immunizations && Array.isArray(backendData.immunizationProfile.immunizations) && backendData.immunizationProfile.immunizations.length > 0) {
    formData.immunizations = backendData.immunizationProfile.immunizations.map(imm => imm.vaccineTypeId);
    formData.immunizationDetails = {};
    
    for (const imm of backendData.immunizationProfile.immunizations) {
      // Convert ISO date format to yyyy-MM-dd
      let dateStr = '';
      if (imm.immunizationDate) {
        if (imm.immunizationDate.includes('T')) {
          // ISO format: "2026-03-19T16:00:00.000Z" → "2026-03-19"
          dateStr = imm.immunizationDate.split('T')[0];
        } else {
          dateStr = imm.immunizationDate;
        }
      }
      
      formData.immunizationDetails[imm.vaccineTypeId] = {
        date: dateStr,
        doseNumber: imm.doseNumber || ''
      };
    }
    console.log('[MapRevisionData] Immunizations prefilled:', formData.immunizations);
  } else {
    console.log('[MapRevisionData] No immunizations to prefill - array is empty or missing');
    formData.immunizations = [];
    formData.immunizationDetails = {};
  }

  // Lifestyle
  if (backendData.lifestyle) {
    formData.smoker = backendData.lifestyle.smoker ? 'yes' : 'no';
    formData.smokerSticksPerDay = backendData.lifestyle.numberOfCigarettesPerDay || null;
    formData.smokerYears = backendData.lifestyle.yearsSmoked || null;

    formData.alcoholDrinker = backendData.lifestyle.alcoholConsumer ? 'yes' : 'no';
    formData.alcoholFrequency = backendData.lifestyle.frequencyOfAlcoholConsumption || null;

    formData.vaper = backendData.lifestyle.vapeUser ? 'yes' : 'no';
    formData.vapeType = backendData.lifestyle.vapeType || null;
    formData.vapeFrequency = backendData.lifestyle.vapeFrequency || null;
  }

  // Visual Acuity
  if (backendData.visualAcuityProfile?.acuity) {
    formData.visualAcuity = 'yes';
    formData.acuityId = backendData.visualAcuityProfile.acuity.acuityId || '';
    formData.leftEye = backendData.visualAcuityProfile.acuity.left_eye || '';
    formData.rightEye = backendData.visualAcuityProfile.acuity.right_eye || '';
  } else {
    formData.visualAcuity = 'no';
  }

  // OB-GYN (Female only)
  if (backendData.obgynHistory) {
    // Convert ISO date to yyyy-MM-dd format
    formData.lastMenstrualPeriod = backendData.obgynHistory.lastMenstrualPeriod ? backendData.obgynHistory.lastMenstrualPeriod.split('T')[0] : '';
    formData.dysmenorrhea = backendData.obgynHistory.hasDysmenorrhea ? 'yes' : 'no';
  }

  // ======== DENTAL HISTORY ========
  
  if (backendData.dentalHistory) {
    formData.seenByDentist = backendData.dentalHistory.seenByDentist === true;
    formData.lastDentalCleaning = backendData.dentalHistory.lastDentalCleaning || '0-6';
    formData.purpose = backendData.dentalHistory.purpose || '';
    // Convert ISO date to yyyy-MM-dd format
    formData.lastVisitDate = backendData.dentalHistory.lastVisitDate ? backendData.dentalHistory.lastVisitDate.split('T')[0] : '';
  }

  // Dental Procedures
  console.log('[MapRevisionData] Dental procedure profile data:', backendData.dentalProcedureProfile);
  if (backendData.dentalProcedureProfile?.procedures && Array.isArray(backendData.dentalProcedureProfile.procedures) && backendData.dentalProcedureProfile.procedures.length > 0) {
    formData.dentalProcedures = backendData.dentalProcedureProfile.procedures.map(proc => {
      // Convert ISO date format to yyyy-MM-dd for input[type="date"]
      const dateStr = proc.procedureDate ? new Date(proc.procedureDate).toISOString().split('T')[0] : '';
      return {
        procedureTypeId: proc.procedureTypeId,
        procedureDate: dateStr
      };
    });
    console.log('[MapRevisionData] Dental procedures prefilled:', formData.dentalProcedures);
  } else {
    console.log('[MapRevisionData] No dental procedures to prefill - array is empty or missing');
    formData.dentalProcedures = [];
  }

  // Oral Appliances
  console.log('[MapRevisionData] Oral appliance profile data:', backendData.oralApplianceProfile);
  if (backendData.oralApplianceProfile?.appliances && Array.isArray(backendData.oralApplianceProfile.appliances) && backendData.oralApplianceProfile.appliances.length > 0) {
    formData.oralAppliances = backendData.oralApplianceProfile.appliances.map(app => {
      // Convert ISO date format to yyyy-MM-dd for input[type="date"]
      const dateStr = app.dateIssued ? new Date(app.dateIssued).toISOString().split('T')[0] : '';
      return {
        tagId: app.tagId,
        status: app.status || '',
        dateIssued: dateStr,
        arch: app.arch || 'None'
      };
    });
    console.log('[MapRevisionData] Oral appliances prefilled:', formData.oralAppliances);
  } else {
    console.log('[MapRevisionData] No oral appliances to prefill - array is empty or missing');
    formData.oralAppliances = [];
  }

  // Dental Photos - Convert file IDs to preview URLs
  if (backendData.dentalPhotoRecord?.upperTeeth) {
    try {
      const previewUrl = await fetchDentalPhotoAsBlob(backendData.dentalPhotoRecord.upperTeeth);
      if (previewUrl) {
        formData.upperTeethPhoto = {
          id: backendData.dentalPhotoRecord.upperTeeth,
          preview: previewUrl,
          name: 'Upper Teeth (from revision)'
        };
        console.log('[MapRevisionData] Upper teeth photo mapped');
      }
    } catch (err) {
      console.warn('[MapRevisionData] Could not fetch upper teeth photo:', err.message);
    }
  }

  if (backendData.dentalPhotoRecord?.lowerTeeth) {
    try {
      const previewUrl = await fetchDentalPhotoAsBlob(backendData.dentalPhotoRecord.lowerTeeth);
      if (previewUrl) {
        formData.lowerTeethPhoto = {
          id: backendData.dentalPhotoRecord.lowerTeeth,
          preview: previewUrl,
          name: 'Lower Teeth (from revision)'
        };
        console.log('[MapRevisionData] Lower teeth photo mapped');
      }
    } catch (err) {
      console.warn('[MapRevisionData] Could not fetch lower teeth photo:', err.message);
    }
  }

  console.log('[MapRevisionData] ✅ Mapped form data:', formData);
  return formData;
}

/**
 * Fetch a dental photo file from backend using authenticated file ID
 * Converts file ID to blob URL for display
 * @param {string} fileId - File ID from getDentalPhotoRecord
 * @returns {Promise<string|null>} Blob URL for display, or null if fetch fails
 */
export async function fetchDentalPhotoAsBlob(fileId) {
  if (!fileId) return null;
  
  try {
    console.log('[FetchPhoto] 📸 Fetching dental photo:', fileId);
    
    const response = await axiosRequest({
      method: 'GET',
      url: `/media/record/dentalPhoto/${fileId}`,
      responseType: 'blob'
    });
    
    const blobUrl = URL.createObjectURL(response.data);
    console.log('[FetchPhoto] ✅ Photo fetched successfully, created blob URL');
    return blobUrl;
  } catch (error) {
    console.error('[FetchPhoto] ❌ Failed to fetch photo:', error.message);
    return null;
  }
}

/**
 * Ensures no active ticket exists by checking and cancelling if needed
 * @returns {Promise<boolean>} true if ticket was cancelled or no ticket existed, false if ticket couldn't be cancelled
 */
export async function ensureNoActiveTicket() {
  try {
    console.log('🔍 Checking for active update ticket...');
    const ticket = await getUpdateTicketStatus();
    
    if (!ticket) {
      console.log('✓ No active ticket found');
      return true;
    }
    
    console.log('ℹ️ Found active ticket:', ticket.id, 'Status:', ticket.status);
    
    // Check if ticket is in a cancellable state
    // Cancellable: InProgress, Pending, Revision (patient resubmitting after revision request)
    // Final/Not cancellable: Approved, Cancelled, Rejected, Expired
    const finalStatuses = ['Approved', 'Cancelled', 'Rejected', 'Expired'];
    const isFinalStatus = finalStatuses.includes(ticket.status);
    
    if (isFinalStatus) {
      console.log('ℹ️ Ticket is in final status:', ticket.status, '- no need to cancel');
      return true;
    }
    
    // Otherwise ticket is cancellable (InProgress, Pending, Revision, etc)
    console.log('🚫 Attempting to cancel active ticket...');
    const cancelResult = await cancelUpdateTicket();
    
    if (cancelResult) {
      console.log('✅ Successfully cancelled active ticket');
      return true;
    } else {
      console.error('❌ Failed to cancel active ticket');
      return false;
    }
  } catch (error) {
    console.error('❌ Error checking/cancelling active ticket:', error.message);
    return false;
  }
}

/**
 * Creates an update ticket with specified scope
 * @param {string} scope - 'Medical', 'Dental', or 'Both'
 * @returns {Promise<string>} Ticket ID
 */
export async function createUpdateTicket(scope = 'Both') {
  const mutation = `
    mutation CreateUpdateTicket($scope: UpdateScope!) {
      createUpdateTicket(scope: $scope)
    }
  `;

  try {
    console.log(`📝 Creating update ticket with scope: ${scope}`);
    const response = await sendGraphQLRequest(mutation, { scope });
    console.log('✅ Update ticket created:', response.createUpdateTicket);
    return response.createUpdateTicket;
  } catch (error) {
    console.error('❌ Failed to create update ticket:', error);
    throw error;
  }
}

/**
 * Submits the update ticket for review
 * @returns {Promise<string>} New status
 */
export async function submitUpdateTicket() {
  const mutation = `
    mutation SubmitUpdateTicket {
      submitUpdateTicket
    }
  `;

  try {
    console.log('📤 Submitting update ticket...');
    const response = await sendGraphQLRequest(mutation);
    console.log('✅ Update ticket submitted:', response.submitUpdateTicket);
    return response.submitUpdateTicket;
  } catch (error) {
    console.error('❌ Failed to submit update ticket:', error);
    throw error;
  }
}

/**
 * Cancels the current update ticket
 * @returns {Promise<string>} New status or null if ticket is not cancellable
 */
export async function cancelUpdateTicket() {
  const mutation = `
    mutation CancelUpdateTicket {
      cancelUpdateTicket
    }
  `;

  try {
    console.log('🚫 Attempting to cancel update ticket...');
    
    const response = await axiosRequest({
      method: 'POST',
      url: '/emr/patient',
      data: {
        query: mutation,
        variables: {}
      }
    });

    // Check for GraphQL errors specifically about ticket status
    if (response.data.errors) {
      const errorMessages = response.data.errors.map(e => e.message).join(', ');
      
      // If ticket is not in cancellable status (already Approved/Cancelled/Rejected), that's OK
      if (errorMessages.includes("not in 'InProgress' or 'Pending' status") || 
          errorMessages.includes("Cannot cancel update ticket")) {
        console.log('ℹ️ Ticket already in final status (Approved/Cancelled/Rejected), skipping cancel');
        console.log('ℹ️ Error message:', errorMessages);
        return null; // Return null to indicate no ticket was cancelled
      }
      
      // Other GraphQL errors should be thrown
      console.error('❌ GraphQL error cancelling ticket:', errorMessages);
      throw new Error(errorMessages);
    }

    // Success case
    const status = response.data.data?.cancelUpdateTicket;
    console.log('✅ Update ticket cancelled with status:', status);
    return status;
    
  } catch (error) {
    // Handle network errors or other non-GraphQL errors
    if (error.response?.data?.errors) {
      const errorMessages = error.response.data.errors.map(e => e.message).join(', ');
      
      // Check if it's the "already in final status" error
      if (errorMessages.includes("not in 'InProgress' or 'Pending' status") || 
          errorMessages.includes("Cannot cancel update ticket")) {
        console.log('ℹ️ Ticket already in final status, skipping cancel');
        return null;
      }
    }
    
    console.error('❌ Failed to cancel update ticket:', error.message);
    throw error;
  }
}

// ==================== MEDICAL MUTATIONS (Following Initial Record Pattern) ====================

/**
 * Creates medical history profile
 * Following emr-service.js pattern: empty arrays + notes field
 */
export async function createMedicalHistory(formData) {
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

  // Build conditions array from selected conditions
  const conditions = [];
  const medicalHistoryNotes = [];
  
  // Add self conditions to conditions array
  if (formData.selfConditions) {
    const selfConditions = Object.entries(formData.selfConditions)
      .filter(([_, checked]) => checked)
      .map(([conditionId, _]) => ({
        conditionId: parseInt(conditionId),
        relationship: null // Self conditions have no relationship
      }));
    
    conditions.push(...selfConditions);
    const selfIds = Object.entries(formData.selfConditions)
      .filter(([_, checked]) => checked)
      .map(([conditionId, _]) => conditionId);
    if (selfIds.length > 0) {
      medicalHistoryNotes.push(`Self: ${selfIds.join(', ')}`);
    }
  }
  
  // Add self other notes
  if (formData.selfOther) {
    medicalHistoryNotes.push(`Self Other: ${formData.selfOther}`);
  }
  
  // Add family conditions to conditions array with relationship
  if (formData.familyConditions) {
    const familyConditions = Object.entries(formData.familyConditions)
      .filter(([_, val]) => val && val.checked)
      .map(([conditionId, val]) => ({
        conditionId: parseInt(conditionId),
        relationship: val.relationship || null
      }));
    
    conditions.push(...familyConditions);
    
    const familyConditionsDisplay = Object.entries(formData.familyConditions)
      .filter(([_, val]) => val && val.checked)
      .map(([conditionId, val]) => {
        const relationship = val.relationship;
        return relationship ? `${conditionId} (${relationship})` : conditionId;
      });
    if (familyConditionsDisplay.length > 0) {
      medicalHistoryNotes.push(`Family history: ${familyConditionsDisplay.join(', ')}`);
    }
  }
  
  // Add family other notes with who has it
  if (formData.familyOther) {
    const whoHasIt = formData.familyOtherWhoHasIt;
    const otherNote = whoHasIt 
      ? `Family other: ${formData.familyOther} (${whoHasIt})`
      : `Family other: ${formData.familyOther}`;
    medicalHistoryNotes.push(otherNote);
  }

  const input = {
    conditions, // Now populated with condition objects
    notes: medicalHistoryNotes.length > 0 ? medicalHistoryNotes.join('; ') : null
  };

  console.log('💊 Creating medical history...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ Medical history created');
  return response.createMedicalHistory;
}

/**
 * Creates allergy profile
 * Following emr-service.js pattern: empty arrays + notes field
 */
export async function createAllergyProfile(formData) {
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

  // Build allergy notes and allergy entries from form data
  let allergyNotes = null;
  const allergies = [];

  if (formData.hasAllergies === 'yes') {
    const selectedIds = formData.selectedAllergies || [];

    for (const allergenId of selectedIds) {
      const detail = formData.allergyDetails?.[allergenId] || {};
      allergies.push({
        allergenCatalogId: allergenId,
        status: detail.status || 'Active',
        severity: detail.severity || 'Mild',
        notes: null,
        date_identified: null
      });
    }

    // Capture free-text notes (typed field when catalogs are unavailable)
    const noteParts = [];
    if (formData.allergiesDetail) noteParts.push(formData.allergiesDetail);
    if (formData.allergiesNotes) noteParts.push(formData.allergiesNotes);
    if (noteParts.length > 0) allergyNotes = noteParts.join('; ');
  }

  const input = {
    allergies,
    notes: allergyNotes
  };

  console.log('🚨 Creating allergy profile...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ Allergy profile created');
  return response.createAllergyProfile;
}

/**
 * Creates lifestyle profile
 * Following emr-service.js pattern
 */
export async function createLifestyle(formData) {
  const mutation = `
    mutation CreateLifestyle($input: LifestyleInput!) {
      createLifestyle(input: $input) {
        id
        smoker
        vapeUser
        alcoholConsumer
        notes
      }
    }
  `;

  const isSmoker = formData.smoker === 'yes';
  const isVaper = formData.vaper === 'yes';
  const isDrinker = formData.alcoholDrinker === 'yes';

  const input = {
    smoker: isSmoker,
    numberOfCigarettesPerDay: isSmoker ? (formData.smokerSticksPerDay ? parseInt(formData.smokerSticksPerDay) : null) : null,
    yearsSmoked: isSmoker ? (formData.smokerYears ? parseInt(formData.smokerYears) : null) : null,
    alcoholConsumer: isDrinker,
    frequencyOfAlcoholConsumption: isDrinker ? (formData.alcoholFrequency || null) : null,
    vapeUser: isVaper,
    vapeType: isVaper ? (formData.vapeType || null) : null,
    vapeFrequency: isVaper ? (formData.vapeFrequency || null) : null,
    notes: null
  };

  console.log('🏃 Creating lifestyle...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ Lifestyle created');
  return response.createLifestyle;
}

/**
 * Creates visual acuity profile
 * NOTE: Initial record skips this due to backend bugs with null acuity
 * Following same pattern - create empty note only
 */
export async function createVisualAcuityProfile(formData) {
  const mutation = `
    mutation CreateVisualAcuityProfile($input: VisualAcuityProfileInput!) {
      createVisualAcuityProfile(input: $input) {
        id
        notes
        acuity {
          id
          left_eye
          right_eye
        }
      }
    }
  `;

  const hasVisualAcuity = formData.visualAcuity === 'yes';
  const input = {
    notes: hasVisualAcuity ? 'Uses corrective lenses' : null,
    acuity: hasVisualAcuity && formData.acuityId
      ? {
          acuityId: formData.acuityId,
          left_eye: formData.leftEye || 'N/A',
          right_eye: formData.rightEye || 'N/A',
          notes: formData.visualAcuityNotes || null,
          recorded_at: new Date().toISOString().split('T')[0]
        }
      : null
  };

  console.log('👁️ Creating visual acuity profile...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ Visual acuity profile created');
  return response.createVisualAcuityProfile;
}

/**
 * Creates OB-GYN history (for female patients only)
 * Following emr-service.js pattern
 */
export async function createObgynHistory(formData) {
  const mutation = `
    mutation CreateObgynHistory($input: ObgynHistoryInput!) {
      createObgynHistory(input: $input) {
        id
        lastMenstrualPeriod
        hasDysmenorrhea
        notes
      }
    }
  `;

  // Use actual lastMenstrualPeriod from form, or default to today
  const lmpDate = formData.lastMenstrualPeriod 
    ? new Date(formData.lastMenstrualPeriod).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  
  // Build notes from menstruation duration
  const obgyneNotes = formData.menstruationDuration 
    ? `Duration: ${formData.menstruationDuration} days`
    : null;

  const input = {
    lastMenstrualPeriod: lmpDate,
    hasDysmenorrhea: formData.dysmenorrhea === 'yes',
    notes: obgyneNotes
  };

  console.log('💗 Creating OB-GYN history...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ OB-GYN history created');
  return response.createObgynHistory;
}

/**
 * Creates immunization profile
 * Following emr-service.js pattern: empty arrays + notes field
 */
export async function createImmunizationProfile(formData) {
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

  // Build immunizations array with required fields
  const immunizations = [];
  const immunizationList = [];
  
  // Get selected immunizations with their details (dates, dose numbers)
  if (Array.isArray(formData.immunizations) && formData.immunizations.length > 0) {
    for (const vaccineId of formData.immunizations) {
      const detail = formData.immunizationDetails?.[vaccineId] || {};
      
      // Create immunization object with required fields
      immunizations.push({
        vaccineTypeId: parseInt(vaccineId),
        immunizationDate: detail.date || new Date().toISOString().split('T')[0], // Use today's date if not provided
        doseNumber: detail.doseNumber ? parseInt(detail.doseNumber) : 1 // Default to dose 1 if not provided
      });
      
      immunizationList.push(vaccineId);
    }
  }

  // Add immunization details to notes
  if (formData.immunizationDetails) {
    const details = Object.entries(formData.immunizationDetails)
      .map(([vaccineId, detail]) => {
        const parts = [vaccineId];
        if (detail.date) parts.push(`date: ${detail.date}`);
        if (detail.doseNumber) parts.push(`dose: ${detail.doseNumber}`);
        return parts.join(' ');
      });
    if (details.length > 0) {
      immunizationList.push(`Details: ${details.join(', ')}`);
    }
  }

  // Add immunization notes
  let immunizationNotes = null;
  if (formData.immunizationNotes) {
    immunizationList.push(formData.immunizationNotes);
  }
  
  if (immunizationList.length > 0) {
    immunizationNotes = immunizationList.join('; ');
  }

  const input = {
    immunizations, // Now populated with vaccine objects including date and dose
    notes: immunizationNotes
  };

  console.log('💉 Creating immunization profile...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ Immunization profile created');
  return response.createImmunizationProfile;
}

/**
 * Creates hospitalization profile
 * Following emr-service.js pattern: empty arrays + notes field
 */
export async function createHospitalizationProfile(formData) {
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

  // Build hospitalizations array from form data
  const hospitalizations = [];
  const hospitalizationNotes = [];
  
  if (formData.hasHospitalizations === 'yes') {
    if (formData.hospitalizationCondition) {
      hospitalizations.push({
        conditionId: parseInt(formData.hospitalizationCondition),
        admissionDate: formData.admissionDate || null,
        dischargeDate: formData.dischargeDate || null
      });
      hospitalizationNotes.push(`Condition: ${formData.hospitalizationCondition}`);
    }
    
    if (formData.admissionDate) {
      hospitalizationNotes.push(`Admission: ${formData.admissionDate}`);
    }
    if (formData.dischargeDate) {
      hospitalizationNotes.push(`Discharge: ${formData.dischargeDate}`);
    }
    if (formData.hospitalizationNotes) {
      hospitalizationNotes.push(formData.hospitalizationNotes);
    }
  }

  const input = {
    hospitalizations, // Now populated with hospitalization objects
    notes: hospitalizationNotes.length > 0 ? hospitalizationNotes.join('; ') : null
  };

  console.log('🏥 Creating hospitalization profile...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ Hospitalization profile created');
  return response.createHospitalizationProfile;
}

/**
 * Creates operation profile
 * Following emr-service.js pattern: empty arrays + notes field
 */
export async function createOperationProfile(formData) {
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

  // Build operations array from form data
  const operations = [];
  const operationNotes = [];
  
  if (formData.hasSurgeries === 'yes') {
    if (formData.surgeryType) {
      operations.push({
        procedureId: parseInt(formData.surgeryType),
        operationDate: formData.operationDate || null
      });
      operationNotes.push(`Type: ${formData.surgeryType}`);
    }
    
    if (formData.operationDate) {
      operationNotes.push(`Date: ${formData.operationDate}`);
    }
    if (formData.surgeryNotes) {
      operationNotes.push(formData.surgeryNotes);
    }
  }

  const input = {
    operations, // Now populated with operation objects
    notes: operationNotes.length > 0 ? operationNotes.join('; ') : null
  };

  console.log('🔪 Creating operation profile...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ Operation profile created');
  return response.createOperationProfile;
}

/**
 * Creates medication profile
 * Following emr-service.js pattern: empty arrays + notes field
 */
export async function createMedicationProfile(formData) {
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

  // Build medications array from form data
  const medications = [];
  const medicationNotes = [];
  
  if (formData.hasMedications === 'yes' && (formData.currentMedications || []).length > 0) {
    const meds = formData.currentMedications || [];
    
    for (let i = 0; i < meds.length; i++) {
      const m = meds[i];
      if (m.medicineId) {
        medications.push({
          medicineId: parseInt(m.medicineId),
          description: m.description || null
        });
        medicationNotes.push(`#${i + 1}: ${m.medicineId}${m.description ? ' - ' + m.description : ''}`);
      }
    }
  }
  
  if (formData.medicationNotes) {
    medicationNotes.push(formData.medicationNotes);
  }

  const input = {
    medications, // Now populated with medication objects
    notes: medicationNotes.length > 0 ? medicationNotes.join('; ') : null
  };

  console.log('💊 Creating medication profile...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ Medication profile created');
  return response.createMedicationProfile;
}

// ==================== DENTAL MUTATIONS ====================

/**
 * Creates dental history
 * Following emr-service.js pattern
 */
export async function createDentalHistory(formData) {
  const mutation = `
    mutation CreateDentalHistory($input: DentalHistoryInput!) {
      createDentalHistory(input: $input) {
        id
        seenByDentist
        lastDentalCleaning
        purpose
        lastVisitDate
      }
    }
  `;

  const input = {
    seenByDentist: formData.seenByDentist === true,
    lastDentalCleaning: formData.lastDentalCleaning || '0-6',
    purpose: formData.purpose || null,
    lastVisitDate: formData.lastVisitDate || null
  };

  console.log('🦷 Creating dental history...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ Dental history created');
  return response.createDentalHistory;
}

/**
 * Creates oral appliance profile
 * Following emr-service.js pattern: empty arrays + notes field
 */
export async function createOralApplianceProfile(formData) {
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

  const appliances = (formData.oralAppliances || []).map(a => ({
    tagId: a.tagId,
    status: a.status,
    dateIssued: a.dateIssued,
    arch: a.arch || 'None'
  }));

  const input = {
    appliances,
    notes: formData.oralApplianceNotes || null
  };

  console.log('🔧 Creating oral appliance profile...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ Oral appliance profile created');
  return response.createOralApplianceProfile;
}

/**
 * Creates dental procedure profile  
 * Following emr-service.js pattern: empty arrays + notes field
 */
export async function createDentalProcedureProfile(formData) {
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

  const procedures = (formData.dentalProcedures || []).map(p => ({
    procedureTypeId: p.procedureTypeId,
    procedureDate: p.procedureDate
  }));

  const input = {
    procedures,
    notes: formData.dentalProcedureNotes || null
  };

  console.log('🔬 Creating dental procedure profile...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ Dental procedure profile created');
  return response.createDentalProcedureProfile;
}

// ==================== ORCHESTRATION (Following Initial Record Pattern) ====================

/**
 * Submits medical update record
 * Following emr-service.js pattern: ALWAYS create all required records
 */
export async function submitMedicalUpdate(formData) {
  console.log('🏥 ==================== MEDICAL UPDATE ====================');
  
  const results = {};

  try {
    // Medical History (REQUIRED by backend)
    console.log('[Medical Update] Creating medical history...');
    results.medicalHistory = await createMedicalHistory(formData);

    // Allergy Profile (REQUIRED by backend)
    console.log('[Medical Update] Creating allergy profile...');
    results.allergyProfile = await createAllergyProfile(formData);

    // Hospitalization Profile (REQUIRED by backend)
    console.log('[Medical Update] Creating hospitalization profile...');
    results.hospitalizationProfile = await createHospitalizationProfile(formData);

    // Operation Profile (REQUIRED by backend)
    console.log('[Medical Update] Creating operation profile...');
    results.operationProfile = await createOperationProfile(formData);

    // Medication Profile (REQUIRED by backend)
    console.log('[Medical Update] Creating medication profile...');
    results.medicationProfile = await createMedicationProfile(formData);

    // Immunization Profile (REQUIRED by backend)
    console.log('[Medical Update] Creating immunization profile...');
    results.immunizationProfile = await createImmunizationProfile(formData);

    // Lifestyle
    console.log( '[Medical Update] Creating lifestyle...');
    results.lifestyle = await createLifestyle(formData);

    // Visual Acuity Profile (REQUIRED by backend)
    console.log('[Medical Update] Creating visual acuity profile...');
    results.visualAcuityProfile = await createVisualAcuityProfile(formData);

    // OB-GYN (Female only)
    if (formData.sex === 'Female') {
      console.log('[Medical Update] Creating OB-GYNE history...');
      results.obgynHistory = await createObgynHistory(formData);
    } else {
      console.log('[Medical Update] Skipping OB-GYNE history (not female)');
    }

    console.log('✅ Medical update completed successfully');
    return results;
  } catch (error) {
    console.error('❌ Medical update failed:', error);
    throw error;
  }
}

/**
 * Submits dental update record
 * Following emr-service.js pattern: ALWAYS create all required records
 */
export async function submitDentalUpdate(formData) {
  console.log('🦷 ==================== DENTAL UPDATE ====================');
  
  const results = {};
  let upperTeethFileId = null;
  let lowerTeethFileId = null;

  try {
    // Handle dental photos
    // For new uploads: upload the file and get a fileId
    // For pre-filled revisions: use the existing ID from the previous submission
    console.log('[Dental Update] Processing dental photos...');
    
    // Handle upper teeth photo
    if (formData.upperTeethPhoto?.file) {
      // New upload
      const result = await uploadMediaFile(formData.upperTeethPhoto.file);
      upperTeethFileId = result;
      console.log('[Dental Update] Upper teeth photo uploaded, fileId:', upperTeethFileId);
    } else if (formData.upperTeethPhoto?.id) {
      // Pre-filled from revision - use existing photo UUID
      upperTeethFileId = formData.upperTeethPhoto.id;
      console.log('[Dental Update] Upper teeth photo kept from revision, id:', upperTeethFileId);
    }
    
    // Handle lower teeth photo
    if (formData.lowerTeethPhoto?.file) {
      // New upload
      const result = await uploadMediaFile(formData.lowerTeethPhoto.file);
      lowerTeethFileId = result;
      console.log('[Dental Update] Lower teeth photo uploaded, fileId:', lowerTeethFileId);
    } else if (formData.lowerTeethPhoto?.id) {
      // Pre-filled from revision - use existing photo UUID
      lowerTeethFileId = formData.lowerTeethPhoto.id;
      console.log('[Dental Update] Lower teeth photo kept from revision, id:', lowerTeethFileId);
    }
    
    console.log('[Dental Update] Photos processed:', { upperTeethFileId, lowerTeethFileId });

    // Dental History
    console.log('[Dental Update] Creating dental history...');
    results.dentalHistory = await createDentalHistory(formData);

    // Dental Procedure Profile (REQUIRED by backend)
    console.log('[Dental Update] Creating dental procedure profile...');
    results.dentalProcedureProfile = await createDentalProcedureProfile(formData);

    // Oral Appliance Profile (REQUIRED by backend)
    console.log('[Dental Update] Creating oral appliance profile...');
    results.oralApplianceProfile = await createOralApplianceProfile(formData);

    // Dental Photo Record (REQUIRED by backend)
    console.log('[Dental Update] Creating dental photo record...');
    results.dentalPhotoRecord = await createDentalPhotoRecord(upperTeethFileId, lowerTeethFileId);

    console.log('✅ Dental update completed successfully');
    return results;
  } catch (error) {
    console.error('❌ Dental update failed:', error);
    // Clean up staged photos on failure
    if (upperTeethFileId || lowerTeethFileId) {
      console.log('[Dental Update] Cleaning up staged media files...');
      await Promise.all([
        unstageMediaFile(upperTeethFileId),
        unstageMediaFile(lowerTeethFileId),
      ]);
    }
    throw error;
  }
}

/**
 * Creates dental photo record
 * @param {string|null} upperTeethFileId - Staged fileId for upper teeth
 * @param {string|null} lowerTeethFileId - Staged fileId for lower teeth
 */
async function createDentalPhotoRecord(upperTeethFileId, lowerTeethFileId) {
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

  const input = {
    upperTeeth: upperTeethFileId,
    lowerTeeth: lowerTeethFileId
  };

  console.log('📸 Creating dental photo record...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ Dental photo record created');
  return response.createDentalPhotoRecord;
}

/**
 * Main submission handler - orchestrates the entire update process
 */
export async function submitUpdateRecord(formData, recordType) {
  console.log('📋 ==================== STARTING UPDATE RECORD SUBMISSION ====================');
  console.log('Record Type:', recordType);
  console.log('Form Data:', formData);

  let ticketId = null;
  
  try {
    // Step 1: Check for existing update ticket
    console.log('🔍 Checking for existing update ticket...');
    const existingTicket = await getUpdateTicketStatus();
    
    if (existingTicket?.status === 'Revision') {
      // Special case: Patient is resubmitting after a revision request
      // Reuse the existing Revision ticket instead of creating a new one
      console.log('📋 Reusing existing Revision ticket:', existingTicket.id);
      ticketId = existingTicket.id;
    } else {
      // Normal case: No active ticket or ticket is in other state - cancel and create new
      const canProceed = await ensureNoActiveTicket();
      
      if (!canProceed) {
        throw new Error('An update ticket is already in progress. Please cancel it or wait for it to be processed.');
      }
      
      console.log('✅ Ready to create new ticket');

      // Step 2: Map recordType to backend scope
      const scopeMap = { medical: 'Medical', dental: 'Dental', both: 'Both' };
      const scope = scopeMap[recordType] || 'Both';
      ticketId = await createUpdateTicket(scope);
    }

    const results = { ticketId };

    // Step 3: Submit personal information (requires active ticket)
    console.log('📝 Submitting personal information...');
    await updatePersonalInfo(formData);
    console.log('✅ Personal information submitted');

    // Step 4: Submit medical data only when scope includes medical
    if (recordType === 'medical' || recordType === 'both') {
      results.medical = await submitMedicalUpdate(formData);
    }

    // Step 5: Submit dental data only when scope includes dental
    if (recordType === 'dental' || recordType === 'both') {
      results.dental = await submitDentalUpdate(formData);
    }

    // Step 6: Submit the ticket for review
    const finalStatus = await submitUpdateTicket();
    results.finalStatus = finalStatus;

    console.log('✅ ==================== UPDATE RECORD SUBMISSION COMPLETE ====================');
    return results;
  } catch (error) {
    console.error('❌ ==================== UPDATE RECORD SUBMISSION FAILED ====================');
    console.error('Error:', error);
    
    // Try to cancel the ticket if it was created
    if (ticketId) {
      try {
        await cancelUpdateTicket();
      } catch (cancelError) {
        console.error('Failed to cancel ticket:', cancelError);
      }
    }
    
    throw error;
  }
}
