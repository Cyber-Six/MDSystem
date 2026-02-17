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
 * @returns {Promise<string>} New status
 */
export async function cancelUpdateTicket() {
  const mutation = `
    mutation CancelUpdateTicket {
      cancelUpdateTicket
    }
  `;

  try {
    console.log('🚫 Cancelling update ticket...');
    const response = await sendGraphQLRequest(mutation);
    console.log('✅ Update ticket cancelled:', response.cancelUpdateTicket);
    return response.cancelUpdateTicket;
  } catch (error) {
    console.error('❌ Failed to cancel update ticket:', error);
    throw error;
  }
}

// ==================== MEDICAL MUTATIONS ====================

/**
 * Creates medical history profile
 */
export async function createMedicalHistory(formData) {
  const mutation = `
    mutation CreateMedicalHistory($input: MedicalHistoryInput!) {
      createMedicalHistory(input: $input) {
        id
        conditions {
          id
          conditionId
          description
        }
        notes
      }
    }
  `;

  // Map conditions from selfConditions and familyConditions
  const conditions = [];
  
  // Self conditions (relationship = null)
  if (formData.selfConditions) {
    Object.entries(formData.selfConditions).forEach(([conditionId, checked]) => {
      if (checked) {
        conditions.push({
          conditionId,
          description: null,
          diagnosedDate: null,
          relationship: null
        });
      }
    });
  }

  // Family conditions (relationship = "Mother", "Father", etc.)
  if (formData.familyConditions) {
    Object.entries(formData.familyConditions).forEach(([conditionId, data]) => {
      if (data.checked && data.relationship) {
        conditions.push({
          conditionId,
          description: null,
          diagnosedDate: null,
          relationship: data.relationship
        });
      }
    });
  }

  const input = {
    conditions,
    notes: formData.medicalConditionsNotes || null
  };

  console.log('💊 Creating medical history...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ Medical history created');
  return response.createMedicalHistory;
}

/**
 * Creates allergy profile
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
          notes
        }
        notes
      }
    }
  `;

  const allergies = [];
  if (formData.selectedAllergies && formData.allergyDetails) {
    formData.selectedAllergies.forEach(allergenId => {
      const details = formData.allergyDetails[allergenId];
      // Only include if both required fields (status and severity) are provided
      if (details && details.status && details.severity) {
        allergies.push({
          allergenCatalogId: allergenId,
          status: details.status,
          severity: details.severity,
          notes: details.notes || null,
          date_identified: null
        });
      }
    });
  }

  const input = {
    allergies,
    notes: formData.allergiesNotes || null
  };

  console.log('🚨 Creating allergy profile...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ Allergy profile created');
  return response.createAllergyProfile;
}

/**
 * Creates lifestyle profile
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

  // Map smoking data
  const isSmoker = formData.smoking === 'Current';
  const cigarettesPerDay = formData.cigarettesPerDay ? parseInt(formData.cigarettesPerDay) : null;
  const yearsSmoked = formData.yearsSmoked ? parseInt(formData.yearsSmoked) : null;

  // Map alcohol data
  const isAlcoholConsumer = formData.alcohol !== 'Never';
  const alcoholFrequency = formData.alcohol === 'Never' ? null : formData.alcohol;

  const input = {
    smoker: isSmoker,
    numberOfCigarettesPerDay: cigarettesPerDay,
    yearsSmoked: yearsSmoked,
    alcoholConsumer: isAlcoholConsumer,
    frequencyOfAlcoholConsumption: alcoholFrequency,
    notes: formData.lifestyleNotes || null
  };

  console.log('🏃 Creating lifestyle...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ Lifestyle created');
  return response.createLifestyle;
}

/**
 * Creates visual acuity profile
 */
export async function createVisualAcuityProfile(formData) {
  const mutation = `
    mutation CreateVisualAcuityProfile($input: VisualAcuityProfileInput!) {
      createVisualAcuityProfile(input: $input) {
        id
        notes
        acuity {
          id
          acuityId
          left_eye
          right_eye
          notes
        }
      }
    }
  `;

  const input = {
    notes: formData.visualAcuityNotes || null,
    acuity: formData.acuityId ? {
      acuityId: formData.acuityId,
      left_eye: formData.leftEye || '',
      right_eye: formData.rightEye || '',
      notes: formData.visualAcuityNotes || null,
      recorded_at: null
    } : null
  };

  console.log('👁️ Creating visual acuity profile...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ Visual acuity profile created');
  return response.createVisualAcuityProfile;
}

/**
 * Creates OB-GYN history (for female patients only)
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

  const input = {
    lastMenstrualPeriod: formData.lastMenstrualPeriod,
    hasDysmenorrhea: formData.dysmenorrhea === 'yes',
    notes: formData.obgynNotes || null
  };

  console.log('💗 Creating OB-GYN history...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ OB-GYN history created');
  return response.createObgynHistory;
}

/**
 * Creates immunization profile
 */
export async function createImmunizationProfile(formData) {
  const mutation = `
    mutation CreateImmunizationProfile($input: ImmunizationProfileInput!) {
      createImmunizationProfile(input: $input) {
        id
        immunizations {
          id
          vaccineTypeId
          immunizationDate
          doseNumber
        }
        notes
      }
    }
  `;

  const immunizations = [];
  if (formData.immunizations && formData.immunizationDetails) {
    formData.immunizations.forEach(vaccineId => {
      const details = formData.immunizationDetails[vaccineId];
      if (details && details.date) {
        immunizations.push({
          vaccineTypeId: vaccineId,
          immunizationDate: details.date,
          doseNumber: details.doseNumber || 1
        });
      }
    });
  }

  const input = {
    immunizations,
    notes: formData.immunizationNotes || null
  };

  console.log('💉 Creating immunization profile...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ Immunization profile created');
  return response.createImmunizationProfile;
}

/**
 * Creates hospitalization profile
 */
export async function createHospitalizationProfile(formData) {
  const mutation = `
    mutation CreateHospitalizationProfile($input: HospitalizationProfileInput!) {
      createHospitalizationProfile(input: $input) {
        id
        hospitalizations {
          id
          conditionId
          admissionDate
          dischargeDate
          notes
        }
        notes
      }
    }
  `;

  const hospitalizations = [];
  if (formData.hospitalizations) {
    formData.hospitalizations.forEach(hosp => {
      if (hosp.conditionId && hosp.admissionDate) {
        hospitalizations.push({
          conditionId: hosp.conditionId,
          admissionDate: hosp.admissionDate,
          dischargeDate: hosp.dischargeDate || null,
          notes: hosp.notes || null
        });
      }
    });
  }

  const input = {
    hospitalizations,
    notes: formData.hospitalizationNotes || null
  };

  console.log('🏥 Creating hospitalization profile...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ Hospitalization profile created');
  return response.createHospitalizationProfile;
}

/**
 * Creates operation profile
 */
export async function createOperationProfile(formData) {
  const mutation = `
    mutation CreateOperationProfile($input: OperationProfileInput!) {
      createOperationProfile(input: $input) {
        id
        operations {
          id
          procedureId
          operationDate
          notes
        }
        notes
      }
    }
  `;

  const operations = [];
  if (formData.surgeries) {
    formData.surgeries.forEach(surgery => {
      if (surgery.procedureId && surgery.operationDate) {
        operations.push({
          procedureId: surgery.procedureId,
          operationDate: surgery.operationDate,
          notes: surgery.notes || null
        });
      }
    });
  }

  const input = {
    operations,
    notes: formData.surgeryNotes || null
  };

  console.log('🔪 Creating operation profile...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ Operation profile created');
  return response.createOperationProfile;
}

/**
 * Creates medication profile
 */
export async function createMedicationProfile(formData) {
  const mutation = `
    mutation CreateMedicationProfile($input: MedicationProfileInput!) {
      createMedicationProfile(input: $input) {
        id
        medications {
          id
          medicineId
          description
        }
        notes
      }
    }
  `;

  const medications = [];
  if (formData.currentMedications) {
    formData.currentMedications.forEach(med => {
      if (med.medicineId) {
        medications.push({
          medicineId: med.medicineId,
          description: med.description || null
        });
      }
    });
  }

  const input = {
    medications,
    notes: formData.medicationNotes || null
  };

  console.log('💊 Creating medication profile...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ Medication profile created');
  return response.createMedicationProfile;
}

// ==================== DENTAL MUTATIONS ====================

/**
 * Creates dental history
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
    lastDentalCleaning: formData.lastDentalCleaning || "I don't remember",
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
 */
export async function createOralApplianceProfile(formData) {
  const mutation = `
    mutation CreateOralApplianceProfile($input: OralApplianceProfileInput!) {
      createOralApplianceProfile(input: $input) {
        id
        appliances {
          id
          tagId
          status
          dateIssued
          arch
        }
        notes
      }
    }
  `;

  const appliances = formData.oralAppliances || [];

  const input = {
    appliances: appliances.filter(a => a.tagId && a.status && a.dateIssued),
    notes: formData.oralApplianceNotes || null
  };

  console.log('🔧 Creating oral appliance profile...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ Oral appliance profile created');
  return response.createOralApplianceProfile;
}

/**
 * Creates dental procedure profile
 */
export async function createDentalProcedureProfile(formData) {
  const mutation = `
    mutation CreateDentalProcedureProfile($input: DentalProcedureProfileInput!) {
      createDentalProcedureProfile(input: $input) {
        id
        procedures {
          id
          procedureTypeId
          procedureDate
        }
        notes
      }
    }
  `;

  const procedures = formData.dentalProcedures || [];

  const input = {
    procedures: procedures.filter(p => p.procedureTypeId && p.procedureDate),
    notes: formData.dentalProcedureNotes || null
  };

  console.log('🔬 Creating dental procedure profile...', input);
  const response = await sendGraphQLRequest(mutation, { input });
  console.log('✅ Dental procedure profile created');
  return response.createDentalProcedureProfile;
}

// ==================== ORCHESTRATION ====================

/**
 * Submits medical update record
 */
export async function submitMedicalUpdate(formData) {
  console.log('🏥 ==================== MEDICAL UPDATE ====================');
  
  const results = {};

  try {
    // Medical History (self or family conditions)
    const hasSelfConditions = formData.selfConditions && Object.keys(formData.selfConditions).length > 0;
    const hasFamilyConditions = formData.familyConditions && Object.keys(formData.familyConditions).length > 0;
    
    if (hasSelfConditions || hasFamilyConditions) {
      results.medicalHistory = await createMedicalHistory(formData);
    }

    // Allergies
    if (formData.selectedAllergies && formData.selectedAllergies.length > 0) {
      results.allergies = await createAllergyProfile(formData);
    }

    // Lifestyle
    if (formData.smoking || formData.alcohol) {
      results.lifestyle = await createLifestyle(formData);
    }

    // Visual Acuity
    if (formData.acuityId || formData.leftEye || formData.rightEye) {
      results.visualAcuity = await createVisualAcuityProfile(formData);
    }

    // OB-GYN (Female only)
    if (formData.sex === 'Female' && formData.lastMenstrualPeriod) {
      results.obgyn = await createObgynHistory(formData);
    }

    // Immunizations
    if (formData.immunizations && formData.immunizations.length > 0) {
      results.immunizations = await createImmunizationProfile(formData);
    }

    // Hospitalizations
    if (formData.hospitalizations && formData.hospitalizations.length > 0) {
      results.hospitalizations = await createHospitalizationProfile(formData);
    }

    // Operations
    if (formData.surgeries && formData.surgeries.length > 0) {
      results.operations = await createOperationProfile(formData);
    }

    // Medications
    if (formData.currentMedications && formData.currentMedications.length > 0) {
      results.medications = await createMedicationProfile(formData);
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
 */
export async function submitDentalUpdate(formData) {
  console.log('🦷 ==================== DENTAL UPDATE ====================');
  
  const results = {};

  try {
    // Dental History
    if (formData.seenByDentist !== undefined && formData.lastDentalCleaning) {
      results.dentalHistory = await createDentalHistory(formData);
    }

    // Oral Appliances
    if (formData.oralAppliances && formData.oralAppliances.length > 0) {
      results.oralAppliances = await createOralApplianceProfile(formData);
    }

    // Dental Procedures
    if (formData.dentalProcedures && formData.dentalProcedures.length > 0) {
      results.dentalProcedures = await createDentalProcedureProfile(formData);
    }

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
