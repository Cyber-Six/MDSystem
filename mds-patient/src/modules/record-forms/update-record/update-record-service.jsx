/**
 * Update Record Service
 * 
 * Handles GraphQL mutations for creating/updating medical and dental records
 * Supports three update scopes: Medical, Dental, Both
 */

import { axiosRequest } from '../../../packages-core-adapter';
import { updatePersonalInfo } from './personal-info-service';

const formatDateToMonthInput = (rawDate) => {
  if (!rawDate) return '';
  const dateText = String(rawDate).trim();

  if (/^\d{4}-\d{2}$/.test(dateText)) return dateText;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return dateText.slice(0, 7);
  if (dateText.includes('T')) return dateText.split('T')[0].slice(0, 7);

  return dateText.slice(0, 7);
};

const normalizeMonthOrDateToISODate = (rawDate) => {
  if (!rawDate) return null;
  const dateText = String(rawDate).trim();

  if (/^\d{4}-\d{2}$/.test(dateText)) return `${dateText}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return dateText;

  return null;
};

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

  } catch (error) {

  }
}

/**
 * Sends GraphQL request to backend
 * @param {string} query - GraphQL query or mutation string
 * @param {object} variables - Query/mutation variables
 * @returns {Promise<object>} GraphQL response data
 */
async function sendGraphQLRequest(query, variables = {}, { strict = false } = {}) {
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
      if (strict) {
        const error = new Error('Stored records could not be loaded.');
        // Preserve the GraphQL messages for the form's safe, user-facing error mapper.
        // Do not attach response data, variables, or extensions that may contain PHI or internals.
        error.graphQLErrors = response.data.errors
          .map(({ message }) => ({ message }))
          .filter(({ message }) => typeof message === 'string' && message.length > 0);
        throw error;
      }

      // If we have partial data (field-level errors in scope-aware queries), accept it
      // This happens when querying only Dental fields but backend returns "No active profile" 
      // for medical fields that weren't included in the query
      if (response.data.data && Object.keys(response.data.data).length > 0) {

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

    throw error;
  }
}

// ==================== UPDATE TICKET MANAGEMENT ====================

/**
 * Gets the current active update ticket status
 * @returns {Promise<object>} Ticket details {id, status} or null if no active ticket
 */
export async function getUpdateTicketStatus({ strict = false } = {}) {
  const query = `
    query GetUpdateTicketStatus {
      getUpdateTicket {
        id
        status
        scope
        notes
      }
    }
  `;

  try {

    const response = await sendGraphQLRequest(query, {}, { strict });

    if (response.getUpdateTicket) {

      return response.getUpdateTicket;
    }

    return null;
  } catch (error) {
    if (strict) throw error;
    return null;
  }
}

/**
 * Get the current update ticket with full details including status and revision notes
 * Used to detect if patient has a pending revision request from staff
 * @returns {Promise<{id, status, notes} | null>} Ticket details or null if no ticket
 */
export async function getUpdateRevisionStatus() {
  return getUpdateTicketStatus();
}

/**
 * Fetch the patient's previous medical/dental records for pre-filling the form during revision
 * Builds a scope-specific query based on the revision scope (Medical/Dental/Both)
 * @returns {Promise<object>} Previous form data to pre-fill the revision form
 */
export async function fetchUpdateRevisionPrefill(ticket = null) {
  try {
    const revisionTicket = ticket || await getUpdateTicketStatus();
    // Revision prefill must restore photo bytes, not reuse permanent media IDs as
    // upload IDs. Dental photo mutations promote staged uploads only.
    return await fetchUpdatePrefill(revisionTicket?.scope || 'Both', { stageExistingPhotos: true });
  } catch {
    return {};
  }
}

export async function fetchUpdateRecordPrefill(recordType) {
  const scope = { medical: 'Medical', dental: 'Dental', both: 'Both' }[recordType];
  if (!scope) throw new Error('Select a valid record type.');
  return fetchUpdatePrefill(scope, { approved: true });
}

async function fetchUpdatePrefill(scope, { approved = false, stageExistingPhotos = approved } = {}) {
  try {
    // Build query based on scope - only request fields relevant to the revision scope
    let query = `query ${approved ? 'GetApprovedUpdatePrefill' : 'GetRevisionEMRData'} {`;

    // Always fetch profile and emergency contact (needed for all scopes)
    query += `
      emrProfile: getProfile {
        __typename
        ... on StudentProfile { programId program year }
        ... on EmployeeProfile { department role position employmentCategoryOther }
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
      }
      lifestyle: getLifestyle {
        smoker numberOfCigarettesPerDay yearsSmoked
        alcoholConsumer frequencyOfAlcoholConsumption
        vapeUser vapeType vapeFrequency yearsVaping
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
        otherDescription otherArch
      }`;
    }

    query += `
    }`;

    if (approved) {
      query = query.replace(/(\bget[A-Z]\w*)(\s*\{)/g, '$1(approved: true)$2');
    }
    const response = await sendGraphQLRequest(query, {}, { strict: approved });
    return await mapRevisionDataToFormData(response, { stageExistingPhotos });
  } catch (error) {
    if (approved) throw error;
    return {};
  }
}

/**
 * Transform backend GraphQL data to form field names and structures
 * Maps database field names to component form field names
 * @param {object} backendData - Data from GraphQL query (see fetchUpdateRevisionPrefill)
 * @returns {Promise<object>} Form data with all fields properly renamed and structured
 */
export async function mapRevisionDataToFormData(backendData, { stageExistingPhotos = false } = {}) {
  const formData = {};

  // ======== PERSONAL INFO ========

  // Emergency Contact
  if (backendData.emergencyContact?.firstContact) {
    const firstContact = backendData.emergencyContact.firstContact;
    formData.emergencyContact1Name = firstContact.contactName || '';
    formData.emergencyContact1Relationship = firstContact.relationship || '';
    formData.emergencyContact1Number = firstContact.contactNumber || '';
    formData.emergencyContact1Address = firstContact.address || '';
  }

  if (backendData.emergencyContact?.secondContact) {
    const secondContact = backendData.emergencyContact.secondContact;
    formData.emergencyContact2Name = secondContact.contactName || '';
    formData.emergencyContact2Relationship = secondContact.relationship || '';
    formData.emergencyContact2Number = secondContact.contactNumber || '';
    formData.emergencyContact2Address = secondContact.address || '';
  }

  if (backendData.emrProfile) {
    formData.profileType = backendData.emrProfile.__typename === 'EmployeeProfile' || backendData.emrProfile.department ? 'Employee' : 'Student';
  }

  // School/Employee Profile
  if (backendData.emrProfile?.program) {
    const rawProgramLabel = backendData.emrProfile.program || '';
    formData.program = rawProgramLabel;
    formData.schoolYear = backendData.emrProfile.year || '';

    if (backendData.emrProfile.programId) {
      formData.programId = backendData.emrProfile.programId;
    } else if (rawProgramLabel) {
      try {
        const searchResult = await sendGraphQLRequest(
          `
            query SearchStudentProgram($label: String, $offset: Int, $limit: Int) {
              searchStudentProgram(label: $label, offset: $offset, limit: $limit) {
                id
                label
              }
            }
          `,
          { label: rawProgramLabel, offset: 0, limit: 20 }
        );

        const programs = Array.isArray(searchResult?.searchStudentProgram)
          ? searchResult.searchStudentProgram
          : [];

        const normalizedProgramLabel = String(rawProgramLabel).trim().toLowerCase();
        const matchedProgram =
          programs.find((item) => String(item?.label || '').trim().toLowerCase() === normalizedProgramLabel) ||
          (programs.length === 1 ? programs[0] : null);

        if (matchedProgram?.id) {
          formData.programId = matchedProgram.id;
          formData.program = matchedProgram.label || rawProgramLabel;
        }
      } catch (error) {

      }
    }
  }
  if (backendData.emrProfile?.department) {
    formData.employeeDepartment = backendData.emrProfile.department || '';
    const storedRole = backendData.emrProfile.role;
    formData.employeeRole = ({ NonStaff: 'Teaching', NonStaffOfficer: 'Teaching (Officer)', Staff: 'Non-Teaching', StaffOfficer: 'Non-Teaching (Officer)' })[storedRole]
      || (['Teaching', 'Teaching (Officer)', 'Non-Teaching', 'Non-Teaching (Officer)', 'Other'].includes(storedRole) ? storedRole : 'Other');
    formData.employeeCategoryOther = backendData.emrProfile.employmentCategoryOther || (formData.employeeRole === 'Other' && storedRole !== 'Other' ? storedRole : '') || '';
    formData.employeePosition = backendData.emrProfile.position || '';
  }

  // ======== MEDICAL HISTORY ========

  // Medical Conditions

  if (backendData.medicalHistory?.conditions && Array.isArray(backendData.medicalHistory.conditions) && backendData.medicalHistory.conditions.length > 0) {
    formData.selfConditions = {};
    formData.familyConditions = {};

    for (const condition of backendData.medicalHistory.conditions) {

      // Self conditions have relationship === null or undefined
      if (!condition.relationship || condition.relationship === 'Self' || condition.relationship === null) {
        formData.selfConditions[condition.conditionId] = true;

      } else if (condition.relationship) {
        // Family conditions have a relationship name
        formData.familyConditions[condition.conditionId] = {
          checked: true,
          relationship: condition.relationship
        };

      }
    }

  } else {

    formData.selfConditions = {};
    formData.familyConditions = {};
  }

  // Allergies

  if (Array.isArray(backendData.allergyProfile?.allergies) && backendData.allergyProfile.allergies.length > 0) {
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
    formData.hasAllergies = backendData.allergyProfile ? 'no' : '';
  }

  formData.allergiesNotes = (backendData.allergyProfile?.notes || backendData.allergyProfile?.allergies?.[0]?.notes || '').replace(/^Other: /, '');
  formData.hospitalizationNotes = backendData.hospitalizationProfile?.notes || backendData.hospitalizationProfile?.hospitalizations?.[0]?.notes || '';
  formData.surgeryNotes = backendData.operationProfile?.notes || backendData.operationProfile?.operations?.[0]?.notes || '';
  formData.medicationNotes = backendData.medicationProfile?.notes || '';
  formData.medicationReason = backendData.medicationProfile?.medications?.[0]?.description || '';

  // Hospitalization

  if (backendData.hospitalizationProfile?.hospitalizations && Array.isArray(backendData.hospitalizationProfile.hospitalizations) && backendData.hospitalizationProfile.hospitalizations.length > 0) {
    formData.hasHospitalizations = 'yes';
    formData.hospitalizationConditions = {};
    formData.hospitalizationDates = {};
    for (const hosp of backendData.hospitalizationProfile.hospitalizations) {
      if (hosp.conditionId) {
        formData.hospitalizationConditions[hosp.conditionId] = true;
        formData.hospitalizationDates[hosp.conditionId] = {
          admissionDate: hosp.admissionDate ? hosp.admissionDate.split('T')[0] : '',
          dischargeDate: hosp.dischargeDate ? hosp.dischargeDate.split('T')[0] : ''
        };
      }
    }
  } else {
    formData.hasHospitalizations = backendData.hospitalizationProfile ? 'no' : '';
  }

  // Surgery/Operations

  if (backendData.operationProfile?.operations && Array.isArray(backendData.operationProfile.operations) && backendData.operationProfile.operations.length > 0) {
    formData.hasSurgeries = 'yes';
    formData.operationConditions = {};
    formData.operationDates = {};
    for (const op of backendData.operationProfile.operations) {
      if (op.procedureId) {
        formData.operationConditions[op.procedureId] = true;
        formData.operationDates[op.procedureId] = op.operationDate ? op.operationDate.split('T')[0] : '';
      }
    }
  } else {
    formData.hasSurgeries = backendData.operationProfile ? 'no' : '';
  }

  // Medications

  if (backendData.medicationProfile?.medications && Array.isArray(backendData.medicationProfile.medications) && backendData.medicationProfile.medications.length > 0) {
    formData.hasMedications = 'yes';
    formData.selectedMedications = {};
    formData.medicationDescriptions = {};
    for (const med of backendData.medicationProfile.medications) {
      if (med.medicineId) {
        formData.selectedMedications[med.medicineId] = true;
        formData.medicationDescriptions[med.medicineId] = med.description || '';
      }
    }
  } else {
    formData.hasMedications = backendData.medicationProfile ? 'no' : '';
  }

  // Immunizations

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
        doseNumber: imm.doseNumber ?? ''
      };
    }

  } else {

    formData.immunizations = [];
    formData.immunizationDetails = {};
  }

  // Lifestyle
  if (backendData.lifestyle) {
    formData.smoker = backendData.lifestyle.smoker ? 'yes' : 'no';
    formData.smokerSticksPerDay = backendData.lifestyle.numberOfCigarettesPerDay ?? null;
    formData.smokerYears = backendData.lifestyle.yearsSmoked ?? null;

    formData.alcoholDrinker = backendData.lifestyle.alcoholConsumer ? 'yes' : 'no';
    formData.alcoholFrequency = backendData.lifestyle.frequencyOfAlcoholConsumption || null;

    formData.vaper = backendData.lifestyle.vapeUser ? 'yes' : 'no';
    formData.vapeType = backendData.lifestyle.vapeType || null;
    formData.vapeFrequency = backendData.lifestyle.vapeFrequency || null;
    formData.yearsVaping = backendData.lifestyle.yearsVaping ?? null;
  }

  // Visual Acuity
  if (backendData.visualAcuityProfile?.acuity) {
    formData.visualAcuity = 'yes';
    formData.acuityId = backendData.visualAcuityProfile.acuity.acuityId || '';
    formData.leftEye = backendData.visualAcuityProfile.acuity.left_eye || '';
    formData.rightEye = backendData.visualAcuityProfile.acuity.right_eye || '';
  } else {
    formData.visualAcuity = backendData.visualAcuityProfile ? 'no' : '';
  }

  // OB-GYN (Female only)
  if (backendData.obgynHistory) {
    // Convert ISO date to yyyy-MM-dd format
    formData.lastMenstrualPeriod = backendData.obgynHistory.lastMenstrualPeriod ? backendData.obgynHistory.lastMenstrualPeriod.split('T')[0] : '';
    formData.dysmenorrhea = backendData.obgynHistory.hasDysmenorrhea ? 'yes' : 'no';
    formData.menstruationDuration = backendData.obgynHistory.notes?.match(/Duration:\s*(\d+)\s*days/i)?.[1] || '';
  }

  // ======== DENTAL HISTORY ========

  if (backendData.dentalHistory) {
    formData.seenByDentist = backendData.dentalHistory.seenByDentist === true;
    formData.lastDentalCleaning = backendData.dentalHistory.lastDentalCleaning || '0-6';
    formData.purpose = backendData.dentalHistory.purpose || '';
    // Use yyyy-MM so it works with input[type="month"] in update dental step.
    formData.lastVisitDate = formatDateToMonthInput(backendData.dentalHistory.lastVisitDate);
  }

  // Dental Procedures

  if (backendData.dentalProcedureProfile?.procedures && Array.isArray(backendData.dentalProcedureProfile.procedures) && backendData.dentalProcedureProfile.procedures.length > 0) {
    formData.dentalProcedures = backendData.dentalProcedureProfile.procedures.map(proc => {
      // Convert ISO date format to yyyy-MM-dd for input[type="date"]
      const dateStr = proc.procedureDate ? new Date(proc.procedureDate).toISOString().split('T')[0] : '';
      return {
        procedureTypeId: proc.procedureTypeId,
        procedureDate: dateStr
      };
    });

  } else {

    formData.dentalProcedures = [];
  }
  if (backendData.dentalProcedureProfile) {
    formData.hasDentalProcedures = formData.dentalProcedures.length > 0;
  }

  // Oral Appliances

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

  } else {

    formData.oralAppliances = [];
  }
  if (backendData.oralApplianceProfile) {
    formData.hasOralAppliances = formData.oralAppliances.length > 0;
  }

  formData.oralApplianceNotes = backendData.oralApplianceProfile?.notes || '';
  formData.oralApplianceOtherDescription = backendData.oralApplianceProfile?.otherDescription || '';
  formData.oralApplianceOtherArch = backendData.oralApplianceProfile?.otherArch || 'None';
  formData.dentalProcedureNotes = backendData.dentalProcedureProfile?.notes || '';
  formData.visualAcuityNotes = backendData.visualAcuityProfile?.acuity?.notes || backendData.visualAcuityProfile?.notes || '';

  // Dental Photos - Convert file IDs to preview URLs
  if (backendData.dentalPhotoRecord?.upperTeeth) {
    try {
      const photo = await fetchDentalPhotoAsBlob(backendData.dentalPhotoRecord.upperTeeth, { includeFile: stageExistingPhotos });
      const previewUrl = stageExistingPhotos ? photo?.preview : photo;
      if (previewUrl) {
        formData.upperTeethPhoto = {
          ...(stageExistingPhotos ? { file: photo.file } : { id: backendData.dentalPhotoRecord.upperTeeth }),
          preview: previewUrl,
          name: 'Upper teeth'
        };

      }
    } catch (err) {

    }
  }

  if (backendData.dentalPhotoRecord?.lowerTeeth) {
    try {
      const photo = await fetchDentalPhotoAsBlob(backendData.dentalPhotoRecord.lowerTeeth, { includeFile: stageExistingPhotos });
      const previewUrl = stageExistingPhotos ? photo?.preview : photo;
      if (previewUrl) {
        formData.lowerTeethPhoto = {
          ...(stageExistingPhotos ? { file: photo.file } : { id: backendData.dentalPhotoRecord.lowerTeeth }),
          preview: previewUrl,
          name: 'Lower teeth'
        };

      }
    } catch (err) {

    }
  }

  return formData;
}

/**
 * Fetch a dental photo file from backend using authenticated file ID
 * Converts file ID to blob URL for display
 * @param {string} fileId - File ID from getDentalPhotoRecord
 * @returns {Promise<string|null>} Blob URL for display, or null if fetch fails
 */
export async function fetchDentalPhotoAsBlob(fileId, { includeFile = false } = {}) {
  if (!fileId) return null;

  try {

    const response = await axiosRequest({
      method: 'GET',
      url: `/media/record/dentalPhoto/${fileId}`,
      responseType: 'blob'
    });

    const blobUrl = URL.createObjectURL(response.data);

    return includeFile ? { preview: blobUrl, file: new File([response.data], 'dental-photo', { type: response.data.type }) } : blobUrl;
  } catch (error) {

    return null;
  }
}

/**
 * Ensures no active ticket exists by checking and cancelling if needed
 * @returns {Promise<boolean>} true if ticket was cancelled or no ticket existed, false if ticket couldn't be cancelled
 */
export async function ensureNoActiveTicket() {
  try {

    const ticket = await getUpdateTicketStatus();

    if (!ticket) {

      return true;
    }

    // Check if ticket is in a cancellable state
    // Cancellable: InProgress, Pending, Revision (patient resubmitting after revision request)
    // Final/Not cancellable: Approved, Cancelled, Rejected, Expired
    const finalStatuses = ['Approved', 'Cancelled', 'Rejected', 'Expired'];
    const isFinalStatus = finalStatuses.includes(ticket.status);

    if (isFinalStatus) {

      return true;
    }

    // Otherwise ticket is cancellable (InProgress, Pending, Revision, etc)

    const cancelResult = await cancelUpdateTicket();

    if (cancelResult) {

      return true;
    } else {

      return false;
    }
  } catch (error) {

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

    const response = await sendGraphQLRequest(mutation, { scope });

    return response.createUpdateTicket;
  } catch (error) {

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

    const response = await sendGraphQLRequest(mutation);

    return response.submitUpdateTicket;
  } catch (error) {

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

        return null; // Return null to indicate no ticket was cancelled
      }

      // Other GraphQL errors should be thrown

      throw new Error(errorMessages);
    }

    // Success case
    const status = response.data.data?.cancelUpdateTicket;

    return status;

  } catch (error) {
    // Handle network errors or other non-GraphQL errors
    if (error.response?.data?.errors) {
      const errorMessages = error.response.data.errors.map(e => e.message).join(', ');

      // Check if it's the "already in final status" error
      if (errorMessages.includes("not in 'InProgress' or 'Pending' status") || 
          errorMessages.includes("Cannot cancel update ticket")) {

        return null;
      }
    }

    throw error;
  }
}

// ==================== MEDICAL MUTATIONS (Following Initial Record Pattern) ====================

/**
 * Creates medical history profile
 * Following emr-service.js pattern: empty arrays + notes field
 */
export async function createMedicalHistory(formData, request = sendGraphQLRequest) {
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

  const conditions = [
    ...Object.entries(formData.selfConditions || {})
      .filter(([, checked]) => checked)
      .map(([conditionId]) => ({ conditionId: parseInt(conditionId), relationship: null })),
    ...Object.entries(formData.familyConditions || {})
      .filter(([, value]) => value?.checked)
      .map(([conditionId, value]) => ({ conditionId: parseInt(conditionId), relationship: value.relationship || 'Family' })),
  ];
  const input = { conditions };

  const response = await request(mutation, { input });

  return response.createMedicalHistory;
}

/**
 * Creates allergy profile
 * Following emr-service.js pattern: empty arrays + notes field
 */
export async function createAllergyProfile(formData, request = sendGraphQLRequest) {
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

  const response = await request(mutation, { input });

  return response.createAllergyProfile;
}

/**
 * Creates lifestyle profile
 * Following emr-service.js pattern
 */
export async function createLifestyle(formData, request = sendGraphQLRequest) {
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
    yearsVaping: isVaper ? (formData.yearsVaping ?? null) : null,
    notes: null
  };

  const response = await request(mutation, { input });

  return response.createLifestyle;
}

/**
 * Creates visual acuity profile
 * NOTE: Initial record skips this due to backend bugs with null acuity
 * Following same pattern - create empty note only
 */
export async function createVisualAcuityProfile(formData, request = sendGraphQLRequest) {
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
    notes: formData.visualAcuityNotes || (hasVisualAcuity ? 'Uses corrective lenses' : null),
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

  const response = await request(mutation, { input });

  return response.createVisualAcuityProfile;
}

/**
 * Creates OB-GYN history (for female patients only)
 * Following emr-service.js pattern
 */
export async function createObgynHistory(formData, request = sendGraphQLRequest) {
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

  const response = await request(mutation, { input });

  return response.createObgynHistory;
}

/**
 * Creates immunization profile
 * Stores vaccine choices, dates, and doses.
 */
export async function createImmunizationProfile(formData, request = sendGraphQLRequest) {
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
    }
  }

  const input = {
    immunizations, // Vaccine objects include date and dose
  };

  const response = await request(mutation, { input });

  return response.createImmunizationProfile;
}

/**
 * Creates hospitalization profile
 * Following emr-service.js pattern: empty arrays + notes field
 */
export async function createHospitalizationProfile(formData, request = sendGraphQLRequest) {
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
    const conditions = formData.hospitalizationConditions || {};
    const dates = formData.hospitalizationDates || {};
    for (const [conditionId, checked] of Object.entries(conditions)) {
      if (checked) {
        hospitalizations.push({
          conditionId: parseInt(conditionId),
          admissionDate: dates[conditionId]?.admissionDate || null,
          dischargeDate: dates[conditionId]?.dischargeDate || null
        });
      }
    }
    if (formData.hospitalizationNotes) {
      hospitalizationNotes.push(formData.hospitalizationNotes);
    }
  }

  const input = {
    hospitalizations, // Now populated with hospitalization objects
    notes: hospitalizationNotes.length > 0 ? hospitalizationNotes.join('; ') : null
  };

  const response = await request(mutation, { input });

  return response.createHospitalizationProfile;
}

/**
 * Creates operation profile
 * Following emr-service.js pattern: empty arrays + notes field
 */
export async function createOperationProfile(formData, request = sendGraphQLRequest) {
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
    const conditions = formData.operationConditions || {};
    const dates = formData.operationDates || {};
    for (const [procedureId, checked] of Object.entries(conditions)) {
      if (checked) {
        operations.push({
          procedureId: parseInt(procedureId),
          operationDate: dates[procedureId] || null
        });
      }
    }
    if (formData.surgeryNotes) {
      operationNotes.push(formData.surgeryNotes);
    }
  }

  const input = {
    operations, // Now populated with operation objects
    notes: operationNotes.length > 0 ? operationNotes.join('; ') : null
  };

  const response = await request(mutation, { input });

  return response.createOperationProfile;
}

/**
 * Creates medication profile
 * Following emr-service.js pattern: empty arrays + notes field
 */
export async function createMedicationProfile(formData, request = sendGraphQLRequest) {
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

  if (formData.hasMedications === 'yes' && formData.selectedMedications) {
    for (const [medicineId, checked] of Object.entries(formData.selectedMedications)) {
      if (checked) {
        medications.push({
          medicineId: parseInt(medicineId),
          description: formData.medicationDescriptions?.[medicineId] || formData.medicationReason || null
        });
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

  const response = await request(mutation, { input });

  return response.createMedicationProfile;
}

// ==================== DENTAL MUTATIONS ====================

/**
 * Creates dental history
 * Following emr-service.js pattern
 */
export async function createDentalHistory(formData, request = sendGraphQLRequest) {
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

  const normalizedLastVisitDate = normalizeMonthOrDateToISODate(formData.lastVisitDate);

  const input = {
    seenByDentist: formData.seenByDentist === true,
    lastDentalCleaning: formData.lastDentalCleaning || '0-6',
    purpose: formData.purpose || null,
    lastVisitDate: normalizedLastVisitDate
  };

  const response = await request(mutation, { input });

  return response.createDentalHistory;
}

/**
 * Creates oral appliance profile
 * Following emr-service.js pattern: empty arrays + notes field
 */
export async function createOralApplianceProfile(formData, request = sendGraphQLRequest) {
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
    notes: formData.oralApplianceNotes || null,
    otherDescription: formData.oralApplianceOtherDescription || null,
    otherArch: formData.oralApplianceOtherArch || 'None'
  };

  const response = await request(mutation, { input });

  return response.createOralApplianceProfile;
}

/**
 * Creates dental procedure profile  
 * Following emr-service.js pattern: empty arrays + notes field
 */
export async function createDentalProcedureProfile(formData, request = sendGraphQLRequest) {
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

  const response = await request(mutation, { input });

  return response.createDentalProcedureProfile;
}

// ==================== ORCHESTRATION (Following Initial Record Pattern) ====================

function createMutationCollector() {
  const fields = [];
  const definitions = [];
  const variables = {};
  const request = async (document, values) => {
    const type = document.match(/\$input\s*:\s*([A-Za-z][A-Za-z0-9_]*!)/)?.[1];
    const body = document.slice(document.indexOf('{') + 1, document.lastIndexOf('}')).trim();
    const field = body.match(/^([A-Za-z][A-Za-z0-9_]*)\s*\(/)?.[1];
    if (!type || !field || !Object.hasOwn(values, 'input')) throw new Error('Invalid update mutation.');
    const variableName = `input${fields.length}`;
    definitions.push(`$${variableName}: ${type}`);
    fields.push(body.replace(/\$input\b/g, `$${variableName}`));
    variables[variableName] = values.input;
    return { [field]: null };
  };
  const submit = () => sendGraphQLRequest(
    `mutation SaveRecordUpdate(${definitions.join(', ')}) { ${fields.join('\n')} }`,
    variables,
    { strict: true }
  );
  return { request, submit };
}

/**
 * Submits medical update record
 * Following emr-service.js pattern: ALWAYS create all required records
 */
export async function submitMedicalUpdate(formData, request = sendGraphQLRequest) {

  const results = {};

  try {
    // Medical History (REQUIRED by backend)

    results.medicalHistory = await createMedicalHistory(formData, request);

    // Allergy Profile (REQUIRED by backend)

    results.allergyProfile = await createAllergyProfile(formData, request);

    // Hospitalization Profile (REQUIRED by backend)

    results.hospitalizationProfile = await createHospitalizationProfile(formData, request);

    // Operation Profile (REQUIRED by backend)

    results.operationProfile = await createOperationProfile(formData, request);

    // Medication Profile (REQUIRED by backend)

    results.medicationProfile = await createMedicationProfile(formData, request);

    // Immunization Profile (REQUIRED by backend)

    results.immunizationProfile = await createImmunizationProfile(formData, request);

    // Lifestyle

    results.lifestyle = await createLifestyle(formData, request);

    // Visual Acuity Profile (REQUIRED by backend)

    results.visualAcuityProfile = await createVisualAcuityProfile(formData, request);

    // OB-GYN (Female only)
    if (formData.sex === 'Female') {

      results.obgynHistory = await createObgynHistory(formData, request);
    } else {

    }

    return results;
  } catch (error) {

    throw error;
  }
}

/**
 * Submits dental update record
 * Following emr-service.js pattern: ALWAYS create all required records
 */
export async function submitDentalUpdate(formData, request = sendGraphQLRequest, onStagedPhoto = () => {}) {

  const results = {};
  let upperTeethFileId = null;
  let lowerTeethFileId = null;

  try {
    // A saved record's ID points at permanent media, never at staging. Resolve
    // legacy/restored IDs through the authenticated media route before uploading.
    // Always stage fresh bytes so retries cannot reuse an already promoted ID.
    const stagePhoto = async (photo) => {
      if (!photo) return null;
      let file = photo.file;
      if (!file && photo.id) {
        try {
          const response = await axiosRequest({
            method: 'GET',
            url: `/media/record/dentalPhoto/${encodeURIComponent(photo.id)}`,
            responseType: 'blob',
          });
          file = response.data;
        } catch {
          throw new Error('The saved dental photo could not be loaded. Please upload both teeth photos again before submitting.');
        }
      }
      if (!(file instanceof Blob) || !file.size) {
        throw new Error('Please upload both upper and lower teeth photos again before submitting.');
      }
      const fileId = await uploadMediaFile(file);
      if (!fileId) throw new Error('The dental photo upload did not complete. Please try again.');
      onStagedPhoto(fileId);
      return fileId;
    };

    // Handle upper teeth photo
    upperTeethFileId = await stagePhoto(formData.upperTeethPhoto);

    // Handle lower teeth photo
    lowerTeethFileId = await stagePhoto(formData.lowerTeethPhoto);

    // Dental History

    results.dentalHistory = await createDentalHistory(formData, request);

    // Dental Procedure Profile (REQUIRED by backend)

    results.dentalProcedureProfile = await createDentalProcedureProfile(formData, request);

    // Oral Appliance Profile (REQUIRED by backend)

    results.oralApplianceProfile = await createOralApplianceProfile(formData, request);

    // Dental Photo Record (REQUIRED by backend)

    results.dentalPhotoRecord = await createDentalPhotoRecord(upperTeethFileId, lowerTeethFileId, request);

    return results;
  } catch (error) {

    // Clean up staged photos on failure
    if (upperTeethFileId || lowerTeethFileId) {

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
async function createDentalPhotoRecord(upperTeethFileId, lowerTeethFileId, request = sendGraphQLRequest) {
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

  const response = await request(mutation, { input });

  return response.createDentalPhotoRecord;
}

/**
 * Main submission handler - orchestrates the entire update process
 */
export async function submitUpdateRecord(formData, recordType, options = {}) {

  const skipPersonalUpdate = Boolean(options?.skipPersonalUpdate);

  let ticketId = null;
  let createdTicket = false;
  const stagedPhotoIds = [];

  try {
    // Step 1: Check for existing update ticket

    const existingTicket = await getUpdateTicketStatus({ strict: true });

    if (existingTicket?.status === 'Revision' && options.revisionTicketId && String(existingTicket.id) === String(options.revisionTicketId)) {
      // Special case: Patient is resubmitting after a revision request
      // Reuse the existing Revision ticket instead of creating a new one

      ticketId = existingTicket.id;
      const scopeMap = { medical: 'Medical', dental: 'Dental', both: 'Both' };
      if (scopeMap[recordType] !== existingTicket.scope) throw new Error('The revision scope has changed. Reload the form before submitting.');
    } else {
      if (existingTicket && !['Approved', 'Cancelled', 'Rejected', 'Expired'].includes(existingTicket.status)) {
        throw new Error('An update ticket is already in progress. Please wait for it to be resolved.');
      }

      // Step 2: Map recordType to backend scope
      const scopeMap = { medical: 'Medical', dental: 'Dental', both: 'Both' };
      const scope = scopeMap[recordType] || 'Both';
      ticketId = await createUpdateTicket(scope);
      createdTicket = true;
    }

    const results = { ticketId };

    // Step 3: Submit personal information unless explicitly skipped by caller.
    if (!skipPersonalUpdate) {

      await updatePersonalInfo(formData);

    } else {

    }

    const batch = createMutationCollector();

    // Step 4: Prepare medical data only when scope includes medical
    if (recordType === 'medical' || recordType === 'both') {
      results.medical = await submitMedicalUpdate(formData, batch.request);
    }

    // Step 5: Submit dental data only when scope includes dental
    if (recordType === 'dental' || recordType === 'both') {
      results.dental = await submitDentalUpdate(formData, batch.request, fileId => stagedPhotoIds.push(fileId));
    }

    // Step 6: Submit the ticket for review
    await batch.submit();
    const finalStatus = await submitUpdateTicket();
    results.finalStatus = finalStatus;

    return results;
  } catch (error) {

    await Promise.all(stagedPhotoIds.map(unstageMediaFile));

    // Try to cancel the ticket if it was created
    if (createdTicket) {
      try {
        await cancelUpdateTicket();
      } catch (cancelError) {

      }
    }

    throw error;
  }
}
