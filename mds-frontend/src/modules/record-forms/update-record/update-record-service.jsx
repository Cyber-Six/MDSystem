/**
 * Update Record Service
 * 
 * Handles GraphQL mutations for creating/updating medical and dental records
 * Supports three update scopes: Medical, Dental, Both
 */

import { axiosRequest } from '../../../packages-core-adapter';
import { updatePersonalInfo } from './personal-info-service';

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
  
  // Add family conditions with who has it information
  if (formData.familyConditions) {
    const familyConditions = Object.entries(formData.familyConditions)
      .filter(([_, checked]) => checked)
      .map(([conditionId, _]) => {
        const whoHasIt = formData.familyWhoHasIt?.[conditionId];
        return whoHasIt ? `${conditionId} (${whoHasIt})` : conditionId;
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

  // Build allergy notes from form data
  let allergyNotes = null;
  if (formData.hasAllergies === 'Yes') {
    const allergyList = [];
    
    // Get selected allergies
    if (formData.allergies) {
      const selectedAllergies = Object.entries(formData.allergies)
        .filter(([_, checked]) => checked)
        .map(([allergyId, _]) => allergyId);
      
      if (selectedAllergies.length > 0) {
        allergyList.push(...selectedAllergies);
      }
    }
    
    // Add other allergies
    if (formData.allergyOther) {
      allergyList.push(formData.allergyOther);
    }
    
    if (allergyList.length > 0) {
      allergyNotes = `Allergies: ${allergyList.join(', ')}`;
    }
  }

  const input = {
    allergies: [], // Empty - catalog IDs not available in form (using notes instead)
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

  const input = {
    smoker: formData.smoker === 'yes',
    numberOfCigarettesPerDay: formData.smoker === 'yes' 
      ? parseInt(formData.smokerSticksPerDay) || null
      : null,
    yearsSmoked: formData.smoker === 'yes'
      ? parseInt(formData.smokerYears) || null
      : null,
    alcoholConsumer: formData.alcoholDrinker === 'yes',
    frequencyOfAlcoholConsumption: formData.alcoholDrinker === 'yes'
      ? formData.alcoholFrequency || null
      : null,
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
  console.log('👁️ Skipping visual acuity profile - backend bug with null acuity + requires catalog IDs');
  console.log('👁️ Visual acuity data from form:', {
    eyeglasses: formData.eyeglasses,
    contactLenses: formData.contactLenses,
    gradeOD: formData.gradeOD,
    gradeOS: formData.gradeOS,
    date: formData.visualAcuityDate
  });
  // Return null to skip this record creation
  return null;
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
  
  // Get selected immunizations
  if (formData.immunizations) {
    const selectedImmunizations = Object.entries(formData.immunizations)
      .filter(([_, checked]) => checked)
      .map(([immunizationId, _]) => immunizationId);
    
    if (selectedImmunizations.length > 0) {
      immunizationList.push(...selectedImmunizations);
    }
  }
  
  // Get COVID vaccine types if applicable
  if (formData.covidVaccineType) {
    const covidTypes = Object.entries(formData.covidVaccineType)
      .filter(([_, checked]) => checked)
      .map(([typeId, _]) => typeId);
    
    if (covidTypes.length > 0) {
      immunizationList.push(`COVID vaccine types: ${covidTypes.join(', ')}`);
    }
  }
  
  // Add other immunizations
  if (formData.immunizationOther) {
    immunizationList.push(formData.immunizationOther);
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
  const hospitalizationNotes = formData.hasHospitalization === 'Yes' ? [
    formData.hospitalizationReason 
      ? `Reason: ${formData.hospitalizationReason}` 
      : null,
    formData.hospitalizationDate 
      ? `Date: ${formData.hospitalizationDate}` 
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
  const operationNotes = formData.hasOperation === 'Yes' ? [
    formData.operationProcedure 
      ? `Procedure: ${formData.operationProcedure}` 
      : null,
    formData.operationDate 
      ? `Date: ${formData.operationDate}` 
      : null,
    formData.operationNotes || null
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
  const medicationNotes = formData.hasMedications === 'Yes' ? [
    formData.medicationCategory 
      ? `Category: ${formData.medicationCategory}` 
      : null,
    formData.medicationReason 
      ? `Reason: ${formData.medicationReason}` 
      : null,
    formData.medicationDetails 
      ? `Medications: ${formData.medicationDetails}` 
      : null
  ].filter(Boolean).join('; ') || null : null;

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

  // seenByDentist is INVERSE of firstTimeDentist
  // firstTimeDentist='yes' means never seen a dentist before, so seenByDentist=false
  // firstTimeDentist='no' means has been to dentist before, so seenByDentist=true
  const seenByDentist = formData.firstTimeDentist === 'no';
  
  const input = {
    seenByDentist: seenByDentist,
    lastDentalCleaning: formData.lastDentalCleaning || "I don't remember",
    purpose: null,
    lastVisitDate: formData.lastDentalConsultation 
      ? new Date(formData.lastDentalConsultation).toISOString().split('T')[0]
      : null
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

  const input = {
    appliances: [], // Empty - catalog IDs not available in form (using notes instead)
    notes: null
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

  const input = {
    procedures: [], // Empty - catalog IDs not available in form (using notes instead)
    notes: null
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

    // Skip Visual Acuity Profile (backend bug with null acuity)
    console.log('[Medical Update] Skipping visual acuity profile - backend bug with null acuity + requires catalog IDs');

    // OB-GYN (Female only)
    if (formData.gender === 'Female') {
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

  try {
    // Dental History
    console.log('[Dental Update] Creating dental history...');
    results.dentalHistory = await createDentalHistory(formData);

    // Dental Procedure Profile (REQUIRED by backend)
    console.log('[Dental Update] Creating dental procedure profile...');
    results.dentalProcedureProfile = await createDentalProcedureProfile(formData);

    // Oral Appliance Profile (REQUIRED by backend)
    console.log('[Dental Update] Creating oral appliance profile...');
    results.oralApplianceProfile = await createOralApplianceProfile(formData);

    console.log('✅ Dental update completed successfully');
    return results;
  } catch (error) {
    console.error('❌ Dental update failed:', error);
    throw error;
  }
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
    // Step 1: Try to cancel any existing ticket first (in case of previous failed attempts)
    try {
      console.log('🔍 Checking for existing update ticket...');
      await cancelUpdateTicket();
      console.log('✅ Cancelled existing ticket');
    } catch (cancelError) {
      // It's okay if there's no ticket to cancel
      console.log('ℹ️ No existing ticket to cancel (or already cancelled)');
    }

    // Step 2: Create update ticket (ALWAYS "Both" scope - backend requirement for first ticket)
    // Users can still choose to fill only medical or dental, but ticket must be "Both"
    ticketId = await createUpdateTicket('Both');

    const results = { ticketId };

    // Step 2: Submit personal information (requires active ticket)
    console.log('📝 Submitting personal information...');
    await updatePersonalInfo(formData);
    console.log('✅ Personal information submitted');

    // Step 3: Submit medical data (ALWAYS - create empty records if user didn't fill this section)
    // Backend requires all tables for "Both" scope ticket
    results.medical = await submitMedicalUpdate(formData);

    // Step 4: Submit dental data (ALWAYS - create empty records if user didn't fill this section)
    // Backend requires all tables for "Both" scope ticket
    results.dental = await submitDentalUpdate(formData);

    // Step 5: Submit the ticket for review
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
