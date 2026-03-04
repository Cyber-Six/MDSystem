/**
 * Patient Record Service
 * Fetches comprehensive patient record data for staff review.
 * Uses existing backend GraphQL queries via the /emr/medical endpoint.
 *
 * All queries go through the medical resolver which enforces
 * `permit.isMedicalPermitted()` access control.
 */

import { axiosRequest } from '../../packages-core-adapter';

// ── Internal helper ─────────────────────────────────────────────────────────

const sendGraphQL = async (query, variables = {}) => {
  const response = await axiosRequest.post('/emr/medical', { query, variables });
  if (response.data?.errors) {
    throw new Error(response.data.errors[0]?.message || 'GraphQL error occurred');
  }
  return response.data.data;
};

// ── Patient Basic Info ───────────────────────────────────────────────────────

export const getPatientBasicInfo = async (userId) => {
  const data = await sendGraphQL(
    `query GetPatientBasicInfo($userId: ID!) {
       getPatientBasicInfo(userId: $userId) {
         id
         identifier
         branch
         sex
         first_name
         last_name
         middle_name
         suffix
         profile_type
         program
         year
         department
         role
         latest_ticket_id
         latest_status
         latest_scope
         latest_updated_at
       }
     }`,
    { userId },
  );
  return data.getPatientBasicInfo ?? null;
};

// ── Profile (Student / Employee) ─────────────────────────────────────────────

export const getUserProfile = async (userId) => {
  const data = await sendGraphQL(
    `query GetUserProfile($userId: ID!) {
       getUserProfile(userId: $userId) {
         ... on StudentProfile {
           id
           program
           year
           status
           created_at
         }
         ... on EmployeeProfile {
           id
           department
           role
           position
           status
           created_at
         }
       }
     }`,
    { userId },
  );
  return data.getUserProfile ?? [];
};

// ── Emergency Contacts ───────────────────────────────────────────────────────

export const getUserEmergencyContact = async (userId) => {
  const data = await sendGraphQL(
    `query GetUserEmergencyContact($userId: ID!) {
       getUserEmergencyContact(userId: $userId) {
         id
         firstContact {
           id
           contactName
           relationship
           contactNumber
           isVerified
         }
         secondContact {
           id
           contactName
           relationship
           contactNumber
           isVerified
         }
         status
         created_at
       }
     }`,
    { userId },
  );
  return data.getUserEmergencyContact ?? [];
};

// ── Medical History ──────────────────────────────────────────────────────────

export const getUserMedicalHistory = async (userId) => {
  const data = await sendGraphQL(
    `query GetUserMedicalHistory($userId: ID!) {
       getUserMedicalHistory(userId: $userId) {
         id
         conditions {
           id
           conditionId
           description
           diagnosedDate
           relationship
         }
         notes
         status
         created_at
       }
     }`,
    { userId },
  );
  return data.getUserMedicalHistory ?? [];
};

// ── Lifestyle ────────────────────────────────────────────────────────────────

export const getUserLifestyle = async (userId) => {
  const data = await sendGraphQL(
    `query GetUserLifestyle($userId: ID!) {
       getUserLifestyle(userId: $userId) {
         id
         smoker
         numberOfCigarettesPerDay
         yearsSmoked
         alcoholConsumer
         frequencyOfAlcoholConsumption
         notes
         status
         created_at
       }
     }`,
    { userId },
  );
  return data.getUserLifestyle ?? [];
};

// ── Allergy Profile ──────────────────────────────────────────────────────────

export const getUserAllergyProfile = async (userId) => {
  const data = await sendGraphQL(
    `query GetUserAllergyProfile($userId: ID!) {
       getUserAllergyProfile(userId: $userId) {
         id
         allergies {
           id
           allergenCatalogId
           status
           severity
           notes
           dateIdentified
         }
         notes
         status
         created_at
       }
     }`,
    { userId },
  );
  return data.getUserAllergyProfile ?? [];
};

// ── Medication Profile ───────────────────────────────────────────────────────

export const getUserMedicationProfile = async (userId) => {
  const data = await sendGraphQL(
    `query GetUserMedicationProfile($userId: ID!) {
       getUserMedicationProfile(userId: $userId) {
         id
         medications {
           id
           medicineId
           description
         }
         notes
         status
         created_at
       }
     }`,
    { userId },
  );
  return data.getUserMedicationProfile ?? [];
};

// ── Immunization Profile ─────────────────────────────────────────────────────

export const getUserImmunizationProfile = async (userId) => {
  const data = await sendGraphQL(
    `query GetUserImmunizationProfile($userId: ID!) {
       getUserImmunizationProfile(userId: $userId) {
         id
         immunizations {
           id
           vaccineTypeId
           immunizationDate
           doseNumber
         }
         notes
         status
         created_at
       }
     }`,
    { userId },
  );
  return data.getUserImmunizationProfile ?? [];
};

// ── Hospitalization Profile ──────────────────────────────────────────────────

export const getUserHospitalizationProfile = async (userId) => {
  const data = await sendGraphQL(
    `query GetUserHospitalizationProfile($userId: ID!) {
       getUserHospitalizationProfile(userId: $userId) {
         id
         hospitalizations {
           id
           conditionId
           admissionDate
           dischargeDate
           notes
         }
         notes
         status
         created_at
       }
     }`,
    { userId },
  );
  return data.getUserHospitalizationProfile ?? [];
};

// ── Operation Profile ────────────────────────────────────────────────────────

export const getUserOperationProfile = async (userId) => {
  const data = await sendGraphQL(
    `query GetUserOperationProfile($userId: ID!) {
       getUserOperationProfile(userId: $userId) {
         id
         operations {
           id
           procedureId
           operationDate
           notes
         }
         notes
         status
         created_at
       }
     }`,
    { userId },
  );
  return data.getUserOperationProfile ?? [];
};

// ── Visual Acuity ────────────────────────────────────────────────────────────

export const getUserVisualAcuityProfile = async (userId) => {
  const data = await sendGraphQL(
    `query GetUserVisualAcuityProfile($userId: ID!) {
       getUserVisualAcuityProfile(userId: $userId) {
         id
         notes
         acuity {
           id
           acuityId
           left_eye
           right_eye
           notes
           recorded_at
         }
         status
         created_at
       }
     }`,
    { userId },
  );
  return data.getUserVisualAcuityProfile ?? [];
};

// ── Vital Signs ──────────────────────────────────────────────────────────────

export const getUserVitalSigns = async (userId) => {
  const data = await sendGraphQL(
    `query GetUserVitalSigns($userId: ID!) {
       getUserVitalSigns(userId: $userId) {
         id
         height_cm
         weight_kg
         blood_pressure
         heart_rate
         temperature
         notes
         status
         created_at
       }
     }`,
    { userId },
  );
  return data.getUserVitalSigns ?? [];
};

// ── OB-GYNE History ─────────────────────────────────────────────────────────

export const getUserObgynHistory = async (userId) => {
  const data = await sendGraphQL(
    `query GetUserObgynHistory($userId: ID!) {
       getUserObgynHistory(userId: $userId) {
         id
         lastMenstrualPeriod
         hasDysmenorrhea
         notes
         status
         created_at
       }
     }`,
    { userId },
  );
  return data.getUserObgynHistory ?? [];
};

// ── Dental History ───────────────────────────────────────────────────────────

export const getUserDentalHistory = async (userId) => {
  const data = await sendGraphQL(
    `query GetUserDentalHistory($userId: ID!) {
       getUserDentalHistory(userId: $userId) {
         id
         seenByDentist
         lastDentalCleaning
         purpose
         lastVisitDate
         status
         created_at
       }
     }`,
    { userId },
  );
  return data.getUserDentalHistory ?? [];
};

// ── Dental Procedure Profile ─────────────────────────────────────────────────

export const getUserDentalProcedureProfile = async (userId) => {
  const data = await sendGraphQL(
    `query GetUserDentalProcedureProfile($userId: ID!) {
       getUserDentalProcedureProfile(userId: $userId) {
         id
         procedures {
           id
           procedureTypeId
           procedureDate
         }
         notes
         created_at
       }
     }`,
    { userId },
  );
  return data.getUserDentalProcedureProfile ?? [];
};

// ── Oral Appliance Profile ───────────────────────────────────────────────────

export const getUserOralApplianceProfile = async (userId) => {
  const data = await sendGraphQL(
    `query GetUserOralApplianceProfile($userId: ID!) {
       getUserOralApplianceProfile(userId: $userId) {
         id
         appliances {
           id
           tagId
           status
           dateIssued
           arch
         }
         notes
         created_at
       }
     }`,
    { userId },
  );
  return data.getUserOralApplianceProfile ?? [];
};

// ── Aggregate Fetcher ────────────────────────────────────────────────────────

/**
 * Fetch all patient record data needed for the review modal.
 * Fetches sections in parallel based on the ticket scope.
 *
 * @param {string} userId  — Patient ID
 * @param {string} scope   — 'Medical' | 'Dental' | 'Both'
 * @param {string} sex     — 'Male' | 'Female' (for OB-GYNE section)
 * @returns {Promise<Object>} All fetched record sections
 */
export const fetchPatientRecordForReview = async (userId, scope = 'Both', sex = null) => {
  const includeMedical = scope === 'Medical' || scope === 'Both';
  const includeDental  = scope === 'Dental'  || scope === 'Both';

  // Build parallel fetch promises based on scope
  const fetches = {};

  // Always fetch basic info & profile & emergency contacts
  fetches.basicInfo        = getPatientBasicInfo(userId);
  fetches.profile          = getUserProfile(userId);
  fetches.emergencyContact = getUserEmergencyContact(userId);

  // Medical sections
  if (includeMedical) {
    fetches.medicalHistory       = getUserMedicalHistory(userId);
    fetches.lifestyle            = getUserLifestyle(userId);
    fetches.allergyProfile       = getUserAllergyProfile(userId);
    fetches.medicationProfile    = getUserMedicationProfile(userId);
    fetches.immunizationProfile  = getUserImmunizationProfile(userId);
    fetches.hospitalizationProfile = getUserHospitalizationProfile(userId);
    fetches.operationProfile     = getUserOperationProfile(userId);
    fetches.visualAcuityProfile  = getUserVisualAcuityProfile(userId);
    fetches.vitalSigns           = getUserVitalSigns(userId);

    // OB-GYNE only for female patients
    if (sex?.toLowerCase() === 'female') {
      fetches.obgynHistory = getUserObgynHistory(userId);
    }
  }

  // Dental sections
  if (includeDental) {
    fetches.dentalHistory          = getUserDentalHistory(userId);
    fetches.dentalProcedureProfile = getUserDentalProcedureProfile(userId);
    fetches.oralApplianceProfile   = getUserOralApplianceProfile(userId);
  }

  // Execute all fetches in parallel
  const keys = Object.keys(fetches);
  const values = await Promise.allSettled(Object.values(fetches));

  const result = {};
  keys.forEach((key, i) => {
    const settled = values[i];
    if (settled.status === 'fulfilled') {
      // For array returns, take the first (latest) record
      const val = settled.value;
      result[key] = Array.isArray(val) ? (val[0] ?? null) : val;
    } else {
      console.error(`Failed to fetch ${key}:`, settled.reason);
      result[key] = null;
    }
  });

  return result;
};
