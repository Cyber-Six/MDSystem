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
 * This orchestrates multiple mutations to create all parts of the medical record
 */
export const createInitialMedicalRecord = async (formData) => {
  console.log('[EMR Service] Starting initial medical record creation');
  console.log('[EMR Service] Form data received:', formData);

  let ticketCreated = false;

  try {
    const results = {};

    // Step 0: Create an update ticket first (required by backend)
    console.log('[EMR Service] Step 0: Creating update ticket...');
    const ticketId = await createUpdateTicket('Both');
    ticketCreated = true;
    results.ticketId = ticketId;
    console.log('[EMR Service] Update ticket created with ID:', ticketId);

    // 1. Create Student Profile (if student)
    if (formData.personalInfo.program) {
      console.log('[EMR Service] Creating student profile...');
      const studentProfile = await createStudentProfile({
        program: formData.personalInfo.program === 'Other' 
          ? formData.personalInfo.programOther 
          : formData.personalInfo.program,
        year: mapYearLevel(formData.personalInfo.studentCategory)
      });
      results.studentProfile = studentProfile;
      console.log('[EMR Service] Student profile created:', studentProfile);
    }

    // 2. Create Emergency Contacts
    if (formData.personalInfo.emergencyContacts?.length >= 2) {
      console.log('[EMR Service] Creating emergency contacts...');
      const emergencyContact = await createEmergencyContact({
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
      });
      results.emergencyContact = emergencyContact;
      console.log('[EMR Service] Emergency contacts created:', emergencyContact);
    }

    // 3. Create Medical History (REQUIRED by backend)
    console.log('[EMR Service] Creating medical history...');
    
    // Build notes including self conditions, family conditions with "who has it"
    const medicalHistoryNotes = [];
    
    // Add self other notes
    if (formData.medicalHistory?.selfOther) {
      medicalHistoryNotes.push(`Self: ${formData.medicalHistory.selfOther}`);
    }
    
    // Add family conditions with who has it information
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
    
    // Add family other notes with who has it
    if (formData.medicalHistory?.familyOther) {
      const whoHasIt = formData.medicalHistory.familyOtherWhoHasIt;
      const otherNote = whoHasIt 
        ? `Family other: ${formData.medicalHistory.familyOther} (${whoHasIt})`
        : `Family other: ${formData.medicalHistory.familyOther}`;
      medicalHistoryNotes.push(otherNote);
    }
    
    const medicalHistory = await createMedicalHistory({
      conditions: [], // Empty - catalog IDs not available in form
      notes: medicalHistoryNotes.length > 0 ? medicalHistoryNotes.join('; ') : null
    });
    results.medicalHistory = medicalHistory;
    console.log('[EMR Service] Medical history created:', medicalHistory);

    // 4. Create Allergy Profile (REQUIRED by backend)
    console.log('[EMR Service] Creating allergy profile...');
    // Build allergy notes from form data
    let allergyNotes = null;
    if (formData.medicalBackground?.hasAllergies === 'Yes') {
      const allergyList = [];
      
      // Get selected allergies
      if (formData.medicalBackground.allergies) {
        const selectedAllergies = Object.entries(formData.medicalBackground.allergies)
          .filter(([_, checked]) => checked)
          .map(([allergyId, _]) => allergyId);
        
        if (selectedAllergies.length > 0) {
          allergyList.push(...selectedAllergies);
        }
      }
      
      // Add other allergies
      if (formData.medicalBackground.allergyOther) {
        allergyList.push(formData.medicalBackground.allergyOther);
      }
      
      if (allergyList.length > 0) {
        allergyNotes = `Allergies: ${allergyList.join(', ')}`;
      }
    }
    
    const allergyProfile = await createAllergyProfile({
      allergies: [], // Empty - catalog IDs not available in form
      notes: allergyNotes
    });
    results.allergyProfile = allergyProfile;
    console.log('[EMR Service] Allergy profile created:', allergyProfile);

    // 5. Create Hospitalization Profile (REQUIRED by backend)
    console.log('[EMR Service] Creating hospitalization profile...');
    // Build hospitalization notes from new form structure
    const hospitalizationNotes = formData.medicalBackground?.hasHospitalization === 'Yes' ? [
      formData.medicalBackground.hospitalizationReason 
        ? `Reason: ${formData.medicalBackground.hospitalizationReason}` 
        : null,
      formData.medicalBackground.hospitalizationDate 
        ? `Date: ${formData.medicalBackground.hospitalizationDate}` 
        : null,
      formData.medicalBackground.hospitalizationNotes || null
    ].filter(Boolean).join('; ') || null : null;
    
    const hospitalizationProfile = await createHospitalizationProfile({
      hospitalizations: [], // Empty - catalog IDs not available in form
      notes: hospitalizationNotes
    });
    results.hospitalizationProfile = hospitalizationProfile;
    console.log('[EMR Service] Hospitalization profile created:', hospitalizationProfile);

    // 6. Create Operation Profile (REQUIRED by backend)
    console.log('[EMR Service] Creating operation profile...');
    // Build operation notes from new form structure
    const operationNotes = formData.medicalBackground?.hasOperation === 'Yes' ? [
      formData.medicalBackground.operationProcedure 
        ? `Procedure: ${formData.medicalBackground.operationProcedure}` 
        : null,
      formData.medicalBackground.operationDate 
        ? `Date: ${formData.medicalBackground.operationDate}` 
        : null,
      formData.medicalBackground.operationNotes || null
    ].filter(Boolean).join('; ') || null : null;
    
    const operationProfile = await createOperationProfile({
      operations: [], // Empty - catalog IDs not available in form
      notes: operationNotes
    });
    results.operationProfile = operationProfile;
    console.log('[EMR Service] Operation profile created:', operationProfile);

    // 7. Create Medication Profile (REQUIRED by backend)
    console.log('[EMR Service] Creating medication profile...');
    // Build medication notes from new form structure
    const medicationNotes = formData.medicalBackground?.hasMedications === 'Yes' ? [
      formData.medicalBackground.medicationCategory 
        ? `Category: ${formData.medicalBackground.medicationCategory}` 
        : null,
      formData.medicalBackground.medicationReason 
        ? `Reason: ${formData.medicalBackground.medicationReason}` 
        : null,
      formData.medicalBackground.medicationDetails 
        ? `Medications: ${formData.medicalBackground.medicationDetails}` 
        : null
    ].filter(Boolean).join('; ') || null : null;
    
    const medicationProfile = await createMedicationProfile({
      medications: [], // Empty - catalog IDs not available in form
      notes: medicationNotes
    });
    results.medicationProfile = medicationProfile;
    console.log('[EMR Service] Medication profile created:', medicationProfile);

    // 7a. Create Immunization Profile (REQUIRED by backend)
    console.log('[EMR Service] Creating immunization profile...');
    // Build immunization notes from form data
    let immunizationNotes = null;
    const immunizationList = [];
    
    // Get selected immunizations
    if (formData.medicalBackground?.immunizations) {
      const selectedImmunizations = Object.entries(formData.medicalBackground.immunizations)
        .filter(([_, checked]) => checked)
        .map(([immunizationId, _]) => immunizationId);
      
      if (selectedImmunizations.length > 0) {
        immunizationList.push(...selectedImmunizations);
      }
    }
    
    // Get COVID vaccine types if applicable
    if (formData.medicalBackground?.covidVaccineType) {
      const covidTypes = Object.entries(formData.medicalBackground.covidVaccineType)
        .filter(([_, checked]) => checked)
        .map(([typeId, _]) => typeId);
      
      if (covidTypes.length > 0) {
        immunizationList.push(`COVID vaccine types: ${covidTypes.join(', ')}`);
      }
    }
    
    // Add other immunizations
    if (formData.medicalBackground?.immunizationOther) {
      immunizationList.push(formData.medicalBackground.immunizationOther);
    }
    
    if (immunizationList.length > 0) {
      immunizationNotes = immunizationList.join('; ');
    }
    
    const immunizationProfile = await createImmunizationProfile({
      immunizations: [], // Empty - catalog IDs not available in form
      notes: immunizationNotes
    });
    results.immunizationProfile = immunizationProfile;
    console.log('[EMR Service] Immunization profile created:', immunizationProfile);

    // 8. Create Lifestyle
    console.log('[EMR Service] Creating lifestyle...');
    const lifestyle = await createLifestyle({
      smoker: formData.medicalBackground.smoker === 'yes',
      numberOfCigarettesPerDay: formData.medicalBackground.smoker === 'yes' 
        ? parseInt(formData.medicalBackground.smokerSticksPerDay) || null
        : null,
      yearsSmoked: formData.medicalBackground.smoker === 'yes'
        ? parseInt(formData.medicalBackground.smokerYears) || null
        : null,
      alcoholConsumer: formData.medicalBackground.alcoholDrinker === 'yes',
      frequencyOfAlcoholConsumption: formData.medicalBackground.alcoholDrinker === 'yes'
        ? formData.medicalBackground.alcoholFrequency || null
        : null,
      notes: null
    });
    results.lifestyle = lifestyle;
    console.log('[EMR Service] Lifestyle created:', lifestyle);

    // 9. Skip Visual Acuity Profile
    // Backend has a bug when acuity is null ("record is not defined")
    // Also requires catalog ID which we don't have
    console.log('[EMR Service] Skipping visual acuity profile - backend bug with null acuity + requires catalog IDs');

    // 10. Create Dental History
    console.log('[EMR Service] Creating dental history...');
    const mappedDentalCleaning = mapDentalCleaningRange(formData.dentalHistory.lastDentalCleaning);
    console.log('[EMR Service] Mapped dental cleaning range:', formData.dentalHistory.lastDentalCleaning, '=>', mappedDentalCleaning);
    
    // seenByDentist is INVERSE of firstTimeDentist
    // firstTimeDentist='yes' means never seen a dentist before, so seenByDentist=false
    // firstTimeDentist='no' means has been to dentist before, so seenByDentist=true
    const seenByDentist = formData.dentalHistory.firstTimeDentist === 'no';
    console.log('[EMR Service] firstTimeDentist:', formData.dentalHistory.firstTimeDentist, '=> seenByDentist:', seenByDentist);
    
    const dentalHistory = await createDentalHistory({
      seenByDentist: seenByDentist,
      lastDentalCleaning: mappedDentalCleaning,
      purpose: null,
      lastVisitDate: formData.dentalHistory.lastDentalConsultation 
        ? new Date(formData.dentalHistory.lastDentalConsultation).toISOString().split('T')[0]
        : null
    });
    results.dentalHistory = dentalHistory;
    console.log('[EMR Service] Dental history created:', dentalHistory);

    // 11. Create Dental Procedure Profile (REQUIRED by backend)
    console.log('[EMR Service] Creating empty dental procedure profile...');
    const dentalProcedureProfile = await createDentalProcedureProfile({
      procedures: [], // Empty - catalog IDs not available in form
      notes: null
    });
    results.dentalProcedureProfile = dentalProcedureProfile;
    console.log('[EMR Service] Dental procedure profile created:', dentalProcedureProfile);

    // 12. Create Oral Appliance Profile (REQUIRED by backend)
    console.log('[EMR Service] Creating empty oral appliance profile...');
    const oralApplianceProfile = await createOralApplianceProfile({
      appliances: [], // Empty - catalog IDs not available in form
      notes: null
    });
    results.oralApplianceProfile = oralApplianceProfile;
    console.log('[EMR Service] Oral appliance profile created:', oralApplianceProfile);

    // 13. Create OB-GYNE History (if female only)
    if (formData.personalInfo.gender === 'Female' && formData.obgyne) {
      console.log('[EMR Service] Creating OB-GYNE history...');
      
      // Use actual lastMenstrualPeriod from form, or default to today
      const lmpDate = formData.obgyne.lastMenstrualPeriod 
        ? new Date(formData.obgyne.lastMenstrualPeriod).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      
      // Build notes from menstruation duration only (removed menarcheYearAge and padsPerDay)
      const obgyneNotes = formData.obgyne.menstruationDuration 
        ? `Duration: ${formData.obgyne.menstruationDuration} days`
        : null;
      
      const obgyneHistory = await createObgynHistory({
        lastMenstrualPeriod: lmpDate,
        hasDysmenorrhea: formData.obgyne.dysmenorrhea === 'Yes',
        notes: obgyneNotes
      });
      results.obgyneHistory = obgyneHistory;
      console.log('[EMR Service] OB-GYNE history created:', obgyneHistory);
    } else if (formData.personalInfo.gender === 'Female') {
      console.log('[EMR Service] Creating default OB-GYNE history for female user...');
      const obgyneHistory = await createObgynHistory({
        lastMenstrualPeriod: new Date().toISOString().split('T')[0],
        hasDysmenorrhea: false,
        notes: null
      });
      results.obgyneHistory = obgyneHistory;
      console.log('[EMR Service] Default OB-GYNE history created:', obgyneHistory);
    } else {
      console.log('[EMR Service] Skipping OB-GYNE history (not female)');
    }

    // Final Step: Submit the update ticket to finalize all changes
    console.log('[EMR Service] Submitting update ticket to finalize changes...');
    
    try {
      const submitStatus = await submitUpdateTicket();
      results.submitStatus = submitStatus;
      console.log('[EMR Service] Update ticket submitted with status:', submitStatus);
    } catch (submitError) {
      console.error('[EMR Service] Failed to submit update ticket:', submitError);
      
      // Check if error is due to missing staff-only records
      if (submitError.message && submitError.message.includes('VitalSigns, MedicalHistory, Hospitalization')) {
        console.error('='.repeat(80));
        console.error('[EMR Service] BACKEND CONFIGURATION ERROR');
        console.error('='.repeat(80));
        console.error('The backend requires staff-only records (VitalSigns, DentalRecord, DentalPhotoRecord)');
        console.error('for initial patient record submission. These cannot be created by patients.');
        console.error('');
        console.error('Backend team needs to fix this by either:');
        console.error('1. Making these fields optional for initial records (scope="Both")');
        console.error('2. Using separate Medical/Dental scopes for patient initial records');
        console.error('3. Adding patient create mutations for these entities');
        console.error('4. Auto-creating empty staff records when patient submits initial record');
        console.error('='.repeat(80));
      }
      
      throw submitError;
    }

    console.log('[EMR Service] Initial medical record creation completed successfully');
    console.log('[EMR Service] All results:', results);

    return {
      success: true,
      data: results
    };

  } catch (error) {
    console.error('[EMR Service] Failed to create initial medical record:', error);
    
    // If ticket was created, try to cancel it
    if (ticketCreated) {
      console.log('[EMR Service] Attempting to cancel update ticket due to error...');
      await cancelUpdateTicket();
    }
    
    throw error;
  }
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
        acuity {
          id
          left_eye
          right_eye
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
