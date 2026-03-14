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
    if (response.data.errors) {
      console.warn('⚠️ GraphQL Errors:', response.data.errors.map(e => e.message).join(', '));
      
      // If data is null (backend table missing, etc.), return empty object
      // This allows fallback logic to work naturally
      if (response.data.data === null) {
        return {};
      }
      
      // If we have partial data with errors, throw to handle more seriously
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
 * NOTE: This is currently a placeholder - pre-fill from previous ticket could be added later
 * @returns {Promise<object>} Previous form data to pre-fill the revision form
 */
export async function fetchUpdateRevisionPrefill() {
  // For now, we'll just note that pre-fill is optional
  // The revision banner will show regardless, allowing patient to restart entry
  console.log('[UpdateRevision] 📥 Pre-fill available - patient can edit form sections');
  return {};
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

  // Build notes including self conditions, family conditions with "who has it"
  const medicalHistoryNotes = [];
  
  // Add self conditions
  if (formData.selfConditions) {
    const selfConditions = Object.entries(formData.selfConditions)
      .filter(([_, checked]) => checked)
      .map(([conditionId, _]) => conditionId);
    
    if (selfConditions.length > 0) {
      medicalHistoryNotes.push(`Self: ${selfConditions.join(', ')}`);
    }
  }
  
  // Add self other notes
  if (formData.selfOther) {
    medicalHistoryNotes.push(`Self Other: ${formData.selfOther}`);
  }
  
  // Add family conditions with relationship information
  if (formData.familyConditions) {
    const familyConditions = Object.entries(formData.familyConditions)
      .filter(([_, val]) => val && val.checked)
      .map(([conditionId, val]) => {
        const relationship = val.relationship;
        return relationship ? `${conditionId} (${relationship})` : conditionId;
      });
    
    if (familyConditions.length > 0) {
      medicalHistoryNotes.push(`Family history: ${familyConditions.join(', ')}`);
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
    conditions: [], // Empty - catalog IDs not available in form (using notes instead)
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
        alcoholConsumer
        notes
      }
    }
  `;

  const isSmoker = formData.smoking === 'Current' || formData.smoking === 'Former';
  const isDrinker = formData.alcohol === 'Occasionally' || formData.alcohol === 'Regularly';

  // Build lifestyle notes from form selections
  const lifestyleNotes = [
    `Smoking: ${formData.smoking || 'Never'}`,
    `Alcohol: ${formData.alcohol || 'Never'}`,
    formData.lifestyleNotes || null
  ].filter(Boolean).join('; ');

  const input = {
    smoker: isSmoker,
    numberOfCigarettesPerDay: null,
    yearsSmoked: null,
    alcoholConsumer: isDrinker,
    frequencyOfAlcoholConsumption: isDrinker
      ? formData.alcohol
      : null,
    notes: lifestyleNotes
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

  // Build immunization notes from form data
  let immunizationNotes = null;
  const immunizationList = [];
  
  // Get selected immunizations (formData.immunizations is an array of IDs)
  if (Array.isArray(formData.immunizations) && formData.immunizations.length > 0) {
    immunizationList.push(...formData.immunizations);
  }

  // Add immunization details (dates, dose numbers)
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
  if (formData.immunizationNotes) {
    immunizationList.push(formData.immunizationNotes);
  }
  
  if (immunizationList.length > 0) {
    immunizationNotes = immunizationList.join('; ');
  }

  const input = {
    immunizations: [], // Empty - catalog IDs not available in form (using notes instead)
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

  // Build hospitalization notes from form structure
  const hospitalizationNotes = formData.hasHospitalizations === 'yes' ? [
    formData.hospitalizationCondition 
      ? `Condition: ${formData.hospitalizationCondition}` 
      : null,
    formData.admissionDate 
      ? `Admission: ${formData.admissionDate}` 
      : null,
    formData.dischargeDate 
      ? `Discharge: ${formData.dischargeDate}` 
      : null,
    formData.hospitalizationNotes || null
  ].filter(Boolean).join('; ') || null : null;

  const input = {
    hospitalizations: [], // Empty - catalog IDs not available in form (using notes instead)
    notes: hospitalizationNotes
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

  // Build operation notes from form structure
  const operationNotes = formData.hasSurgeries === 'yes' ? [
    formData.surgeryType 
      ? `Type: ${formData.surgeryType}` 
      : null,
    formData.operationDate 
      ? `Date: ${formData.operationDate}` 
      : null,
    formData.surgeryNotes || null
  ].filter(Boolean).join('; ') || null : null;

  const input = {
    operations: [], // Empty - catalog IDs not available in form (using notes instead)
    notes: operationNotes
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

  // Build medication notes from form structure
  const medicationNotes = formData.hasMedications === 'yes' ? (() => {
    const meds = formData.currentMedications || [];
    const medEntries = meds.map((m, i) => {
      const parts = [`#${i + 1}: ${m.medicineId || 'Unknown'}`];
      if (m.description) parts.push(m.description);
      return parts.join(' - ');
    });
    const parts = [];
    if (medEntries.length > 0) parts.push(medEntries.join('; '));
    if (formData.medicationNotes) parts.push(formData.medicationNotes);
    return parts.length > 0 ? parts.join('; ') : null;
  })() : null;

  const input = {
    medications: [], // Empty - catalog IDs not available in form (using notes instead)
    notes: medicationNotes
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
    // Upload dental photos in parallel (if provided)
    console.log('[Dental Update] Uploading dental photos...');
    const [upperResult, lowerResult] = await Promise.allSettled([
      uploadMediaFile(formData.upperTeethPhoto?.file ?? null),
      uploadMediaFile(formData.lowerTeethPhoto?.file ?? null),
    ]);
    upperTeethFileId = upperResult.status === 'fulfilled' ? upperResult.value : null;
    lowerTeethFileId = lowerResult.status === 'fulfilled' ? lowerResult.value : null;
    console.log('[Dental Update] Photos staged:', { upperTeethFileId, lowerTeethFileId });

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
