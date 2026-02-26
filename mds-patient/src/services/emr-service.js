/**
 * EMR Service - Handles all GraphQL mutations and queries for EMR data
 */

import { axiosRequest } from '../packages-core-adapter';

/**
 * Send a GraphQL request to the patient EMR endpoint
 * @param {string} query - GraphQL query/mutation string
 * @param {object} variables - Variables for the GraphQL operation
 * @returns {Promise} Response from the server
 */
const sendGraphQLRequest = async (query, variables = {}) => {
  console.log('[EMR Service] Sending GraphQL request:', {
    query: query,
    variables: JSON.stringify(variables, null, 2)
  });

  try {
    const response = await axiosRequest.post('/emr/patient', {
      query,
      variables
    });

    console.log('[EMR Service] GraphQL response received:', response.data);
    
    if (response.data.errors) {
      console.error('[EMR Service] GraphQL errors:', JSON.stringify(response.data.errors, null, 2));
      response.data.errors.forEach((err, i) => {
        console.error(`[EMR Service] Error ${i + 1}:`, err.message);
        if (err.locations) console.error(`[EMR Service] Location:`, err.locations);
        if (err.path) console.error(`[EMR Service] Path:`, err.path);
        if (err.extensions) console.error(`[EMR Service] Extensions:`, err.extensions);
      });
      throw new Error(response.data.errors[0]?.message || 'GraphQL error occurred');
    }

    return response.data.data;
  } catch (error) {
    // If the error response contains GraphQL errors, log them
    if (error.response?.data?.errors) {
      console.error('[EMR Service] GraphQL Errors from response:');
      error.response.data.errors.forEach((err, i) => {
        console.error(`[EMR Service] Error ${i + 1}:`, err.message);
        if (err.locations) console.error(`[EMR Service] Location:`, err.locations);
        if (err.path) console.error(`[EMR Service] Path:`, err.path);
        if (err.extensions) console.error(`[EMR Service] Extensions:`, err.extensions);
      });
    }
    
    console.error('[EMR Service] Request failed:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw error;
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
  
  const data = await sendGraphQLRequest(mutation, { scope });
  console.log('[EMR Service] Update ticket created:', data.createUpdateTicket);
  return data.createUpdateTicket;
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
    const response = await axiosRequest.post('/media', body, {
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
    await axiosRequest.delete(`/media/${fileId}`);
    console.log('[EMR Service] Staged media file removed, fileId:', fileId);
  } catch (error) {
    // Non-fatal — staging TTL will eventually free the slot
    console.warn('[EMR Service] Failed to remove staged media file:', fileId, error.message);
  }
};

export const createInitialMedicalRecord = async (formData) => {
  console.log('[EMR Service] Starting initial medical record creation (batched)');
  console.log('[EMR Service] Form data received:', formData);

  let ticketCreated = false;
  // Track staged file IDs so they can be cleaned up if the submission fails
  let upperTeethFileId = null;
  let lowerTeethFileId = null;

  try {
    const results = {};

    // ======== REQUEST 1: Create update ticket ========
    console.log('[EMR Service] [1/4] Creating update ticket...');
    const ticketId = await createUpdateTicket('Both');
    ticketCreated = true;
    results.ticketId = ticketId;
    console.log('[EMR Service] Update ticket created with ID:', ticketId);

    // ======== Upload dental photos via REST API before building inputs ========
    // Both uploads are independent – run in parallel to halve the wait time
    console.log('[EMR Service] [2/4] Uploading dental photos (parallel)...');
    [upperTeethFileId, lowerTeethFileId] = await Promise.all([
      uploadMediaFile(formData.dentalHistory?.upperTeethPhoto?.file ?? null),
      uploadMediaFile(formData.dentalHistory?.lowerTeethPhoto?.file ?? null)
    ]);
    console.log('[EMR Service] Dental photos staged:', { upperTeethFileId, lowerTeethFileId });

    // ======== Prepare all input data ========
    const inputs = buildBatchInputs(formData, { upperTeethFileId, lowerTeethFileId });
    console.log('[EMR Service] Prepared batch inputs:', Object.keys(inputs));

    // ======== REQUEST 3: Batch all create mutations in one request ========
    console.log('[EMR Service] [3/4] Sending batched create mutations...');
    const batchResult = await sendBatchedCreateMutations(inputs, formData);
    Object.assign(results, batchResult);
    console.log('[EMR Service] Batch mutations completed:', Object.keys(batchResult));

    // ======== REQUEST 4: Submit the ticket ========
    console.log('[EMR Service] [4/4] Submitting update ticket...');
    try {
      const submitStatus = await submitUpdateTicket();
      results.submitStatus = submitStatus;
      console.log('[EMR Service] Update ticket submitted with status:', submitStatus);
    } catch (submitError) {
      console.error('[EMR Service] Failed to submit update ticket:', submitError);
      throw submitError;
    }

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

    if (ticketCreated) {
      console.log('[EMR Service] Attempting to cancel update ticket due to error...');
      await cancelUpdateTicket();
    }
    throw error;
  }
};

/**
 * Build all input objects from form data for the batched mutation
 * @param {object} formData - Form data from the initial record form
 * @param {object} photoIds - Staged fileIds from the media REST API
 * @param {string|null} photoIds.upperTeethFileId - Staged fileId for the upper teeth photo
 * @param {string|null} photoIds.lowerTeethFileId - Staged fileId for the lower teeth photo
 */
const buildBatchInputs = (formData, photoIds = {}) => {
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

  // Emergency Contacts
  if (formData.personalInfo.emergencyContacts?.length >= 2) {
    inputs.emergencyContact = {
      firstContact: {
        contactName: formData.personalInfo.emergencyContacts[0].name,
        relationship: formData.personalInfo.emergencyContacts[0].relationship,
        contactNumber: formData.personalInfo.emergencyContacts[0].contactNumber
      },
      secondContact: {
        contactName: formData.personalInfo.emergencyContacts[1].name,
        relationship: formData.personalInfo.emergencyContacts[1].relationship,
        contactNumber: formData.personalInfo.emergencyContacts[1].contactNumber
      }
    };
  }

  // Medical History notes
  const medicalHistoryNotes = [];
  if (formData.medicalHistory?.selfOther) {
    medicalHistoryNotes.push(`Self: ${formData.medicalHistory.selfOther}`);
  }
  if (formData.medicalHistory?.family) {
    const familyConditions = Object.entries(formData.medicalHistory.family)
      .filter(([_, checked]) => checked)
      .map(([conditionId, _]) => {
        const whoHasIt = formData.medicalHistory.familyWhoHasIt?.[conditionId];
        return whoHasIt ? `${conditionId} (${whoHasIt})` : conditionId;
      });
    if (familyConditions.length > 0) {
      medicalHistoryNotes.push(`Family history: ${familyConditions.join(', ')}`);
    }
  }
  if (formData.medicalHistory?.familyOther) {
    const whoHasIt = formData.medicalHistory.familyOtherWhoHasIt;
    medicalHistoryNotes.push(whoHasIt 
      ? `Family other: ${formData.medicalHistory.familyOther} (${whoHasIt})`
      : `Family other: ${formData.medicalHistory.familyOther}`);
  }
  inputs.medicalHistory = {
    conditions: [],
    notes: medicalHistoryNotes.length > 0 ? medicalHistoryNotes.join('; ') : null
  };

  // Allergy Profile
  let allergyNotes = null;
  if (formData.medicalBackground?.hasAllergies === 'Yes') {
    const allergyList = [];
    if (formData.medicalBackground.allergies) {
      allergyList.push(
        ...Object.entries(formData.medicalBackground.allergies)
          .filter(([_, checked]) => checked)
          .map(([id]) => id)
      );
    }
    if (formData.medicalBackground.allergyOther) {
      allergyList.push(formData.medicalBackground.allergyOther);
    }
    if (allergyList.length > 0) allergyNotes = `Allergies: ${allergyList.join(', ')}`;
  }
  inputs.allergyProfile = { allergies: [], notes: allergyNotes };

  // Hospitalization Profile
  const hospitalizationNotes = formData.medicalBackground?.hasHospitalization === 'Yes' ? [
    formData.medicalBackground.hospitalizationReason ? `Reason: ${formData.medicalBackground.hospitalizationReason}` : null,
    formData.medicalBackground.hospitalizationDate ? `Date: ${formData.medicalBackground.hospitalizationDate}` : null,
    formData.medicalBackground.hospitalizationNotes || null
  ].filter(Boolean).join('; ') || null : null;
  inputs.hospitalizationProfile = { hospitalizations: [], notes: hospitalizationNotes };

  // Operation Profile
  const operationNotes = formData.medicalBackground?.hasOperation === 'Yes' ? [
    formData.medicalBackground.operationProcedure ? `Procedure: ${formData.medicalBackground.operationProcedure}` : null,
    formData.medicalBackground.operationDate ? `Date: ${formData.medicalBackground.operationDate}` : null,
    formData.medicalBackground.operationNotes || null
  ].filter(Boolean).join('; ') || null : null;
  inputs.operationProfile = { operations: [], notes: operationNotes };

  // Medication Profile
  const medicationNotes = formData.medicalBackground?.hasMedications === 'Yes' ? [
    formData.medicalBackground.medicationCategory ? `Category: ${formData.medicalBackground.medicationCategory}` : null,
    formData.medicalBackground.medicationReason ? `Reason: ${formData.medicalBackground.medicationReason}` : null,
    formData.medicalBackground.medicationDetails ? `Medications: ${formData.medicalBackground.medicationDetails}` : null
  ].filter(Boolean).join('; ') || null : null;
  inputs.medicationProfile = { medications: [], notes: medicationNotes };

  // Immunization Profile
  let immunizationNotes = null;
  const immunizationList = [];
  if (formData.medicalBackground?.immunizations) {
    immunizationList.push(
      ...Object.entries(formData.medicalBackground.immunizations)
        .filter(([_, checked]) => checked)
        .map(([id]) => id)
    );
  }
  if (formData.medicalBackground?.covidVaccineType) {
    const covidTypes = Object.entries(formData.medicalBackground.covidVaccineType)
      .filter(([_, checked]) => checked)
      .map(([id]) => id);
    if (covidTypes.length > 0) immunizationList.push(`COVID vaccine types: ${covidTypes.join(', ')}`);
  }
  if (formData.medicalBackground?.immunizationOther) {
    immunizationList.push(formData.medicalBackground.immunizationOther);
  }
  if (immunizationList.length > 0) immunizationNotes = immunizationList.join('; ');
  inputs.immunizationProfile = { immunizations: [], notes: immunizationNotes };

  // Lifestyle
  inputs.lifestyle = {
    smoker: formData.medicalBackground.smoker === 'yes',
    numberOfCigarettesPerDay: formData.medicalBackground.smoker === 'yes'
      ? parseInt(formData.medicalBackground.smokerSticksPerDay) || null : null,
    yearsSmoked: formData.medicalBackground.smoker === 'yes'
      ? parseInt(formData.medicalBackground.smokerYears) || null : null,
    alcoholConsumer: formData.medicalBackground.alcoholDrinker === 'yes',
    frequencyOfAlcoholConsumption: formData.medicalBackground.alcoholDrinker === 'yes'
      ? formData.medicalBackground.alcoholFrequency || null : null,
    notes: null
  };

  // Visual Acuity Profile
  const hasVisualAcuity = formData.medicalBackground.eyeglasses || formData.medicalBackground.contactLenses;
  inputs.visualAcuityProfile = {
    notes: hasVisualAcuity
      ? `Eyeglasses: ${formData.medicalBackground.eyeglasses ? 'Yes' : 'No'}, Contact Lenses: ${formData.medicalBackground.contactLenses ? 'Yes' : 'No'}`
      : null,
    acuity: hasVisualAcuity
      ? {
          acuityId: "1",
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

  // Dental Procedure Profile (empty)
  inputs.dentalProcedureProfile = { procedures: [], notes: null };

  // Oral Appliance Profile (empty)
  inputs.oralApplianceProfile = { appliances: [], notes: null };

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
      inputs.obgynHistory = {
        lastMenstrualPeriod: lmpDate,
        hasDysmenorrhea: formData.obgyne.dysmenorrhea === 'Yes',
        notes: formData.obgyne.menstruationDuration
          ? `Duration: ${formData.obgyne.menstruationDuration} days` : null
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
  const mapping = {
    'Freshmen': 'Freshman',
    'Freshmen - New student': 'Freshman',
    'Transferee': 'Sophomore',
    'Graduate studies (New student)': 'Masteral',
    'Graduate studies (Old student)': 'Masteral',
    'Returnee': 'Sophomore',
    'Old Student': 'Junior'
  };
  
  return mapping[category] || 'Freshman';
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
export const checkInitialRecordStatus = async () => {
  console.log('[EMR Service] Checking initial record status...');
  
  const query = `
    query GetUpdateTicket {
      getUpdateTicket {
        id
        status
      }
    }
  `;
  
  try {
    const data = await sendGraphQLRequest(query, {});
    console.log('[EMR Service] Update ticket status:', data.getUpdateTicket);
    
    // If there's a ticket with status Pending, Approved, or RevisionSubmitted, they've completed the initial record
    const ticket = data.getUpdateTicket;
    
    if (!ticket) {
      // No ticket at all - needs to fill out initial record
      console.log('[EMR Service] No update ticket found - initial record required');
      return { needsInitialRecord: true, status: null };
    }
    
    // Check if the status indicates they've completed the initial record
    const completedStatuses = ['Pending', 'Approved', 'RevisionSubmitted'];
    const needsInitialRecord = !completedStatuses.includes(ticket.status);
    
    console.log('[EMR Service] Initial record status:', { 
      needsInitialRecord, 
      currentStatus: ticket.status 
    });
    
    return { 
      needsInitialRecord, 
      status: ticket.status,
      ticketId: ticket.id
    };
  } catch (error) {
    // If the query fails (e.g., no ticket exists), user needs to fill out the initial record
    console.log('[EMR Service] Error checking status (likely no ticket):', error.message);
    return { needsInitialRecord: true, status: null, error: error.message };
  }
};

export default {
  createInitialMedicalRecord,
  checkInitialRecordStatus
};
