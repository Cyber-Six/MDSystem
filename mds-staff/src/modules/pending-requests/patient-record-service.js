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

// Helper for staff EMR endpoint (VitalSigns, DentalRecord)
const sendStaffEMRGraphQL = async (query, variables = {}) => {
  const response = await axiosRequest.post('/staff/emr', { query, variables });
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

/**
 * Fetch basic info for multiple patients in ONE request using field aliases.
 * Returns a Map of userId → patient object (null if not found / error).
 *
 * @param {string[]} userIds
 * @returns {Promise<Map<string, Object|null>>}
 */
export const getPatientBasicInfoBatch = async (userIds) => {
  const result = new Map(userIds.map((id) => [String(id), null]));
  if (userIds.length === 0) return result;

  const fields = `id identifier branch sex first_name last_name middle_name suffix profile_type program year department role latest_ticket_id latest_status latest_scope latest_updated_at`;
  const aliasParts = userIds.map(
    (id) => `u_${String(id).replace(/[^a-zA-Z0-9]/g, '_')}: getPatientBasicInfo(userId: "${id}") { ${fields} }`,
  );

  try {
    const response = await axiosRequest.post('/emr/medical', {
      query: `{ ${aliasParts.join('\n')} }`,
    });
    if (response.data?.errors) {
      console.warn('[PatientRecordService] Partial errors in batched getPatientBasicInfo:', response.data.errors.map((e) => e.message));
    }
    const data = response.data?.data ?? {};
    for (const id of userIds) {
      const alias = `u_${String(id).replace(/[^a-zA-Z0-9]/g, '_')}`;
      result.set(String(id), data[alias] ?? null);
    }
  } catch (err) {
    console.warn('[PatientRecordService] getPatientBasicInfoBatch error:', err.message);
  }
  return result;
};

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
         vapeUser
         vapeType
         vapeFrequency
         notes
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
         created_at
       }
     }`,
    { userId },
  );
  return data.getUserVisualAcuityProfile ?? [];
};

// ── Vital Signs ──────────────────────────────────────────────────────────────

export const getUserVitalSigns = async (userId) => {
  const data = await sendStaffEMRGraphQL(
    `query GetPatientVitalSigns($patientId: ID!) {
       getPatientVitalSigns(patientId: $patientId, limit: 10) {
         id
         height_cm
         weight_kg
         blood_pressure
         heart_rate
         temperature
         notes
         created_at
       }
     }`,
    { patientId: userId },
  );
  return data.getPatientVitalSigns ?? [];
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
         archived_at
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

// ── Dental Photo Record ──────────────────────────────────────────────────────

export const getUserDentalPhotoRecord = async (userId) => {
  const data = await sendGraphQL(
    `query GetUserDentalPhotoRecord($userId: ID!) {
       getUserDentalPhotoRecord(userId: $userId, limit: 1) {
         id
         upperTeeth
         lowerTeeth
         isValid
         created_at
       }
     }`,
    { userId },
  );
  return data.getUserDentalPhotoRecord ?? [];
};

// ── Catalog Fetcher ──────────────────────────────────────────────────────────

/**
 * Fetch all catalog tables needed to resolve IDs into human-readable names
 * for the review modal. Uses field aliases to batch all catalog queries into
 * one round-trip. Returns empty arrays per catalog on failure (graceful degradation).
 */
export const fetchCatalogsForReview = async () => {
  try {
    const data = await sendGraphQL(`
      query FetchReviewCatalogs {
        medicalConditionCatalog: getDomainCatalogs(domain: MedicalCondition, filterIsValid: true, limit: 200) {
          id
          name
        }
        hospitalizationCatalog: getDomainCatalogs(domain: Hospitalization, filterIsValid: true, limit: 200) {
          id
          name
        }
        operationCatalog: getDomainCatalogs(domain: Operation, filterIsValid: true, limit: 200) {
          id
          name
        }
        medicationCatalog: getDomainCatalogs(domain: Medication, filterIsValid: true, limit: 200) {
          id
          name
        }
        immunizationCatalog: getDomainCatalogs(domain: Immunization, filterIsValid: true, limit: 200) {
          id
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
        }
        dentalProcedureCatalog: getDomainCatalogs(domain: DentalProcedure, filterIsValid: true, limit: 200) {
          id
          name
        }
      }
    `);
    return {
      medicalConditionCatalog: data.medicalConditionCatalog || [],
      hospitalizationCatalog:  data.hospitalizationCatalog  || [],
      operationCatalog:        data.operationCatalog        || [],
      medicationCatalog:       data.medicationCatalog       || [],
      immunizationCatalog:     data.immunizationCatalog     || [],
      allergenCatalog:         data.allergenCatalog         || [],
      oralApplianceCatalog:    data.oralApplianceCatalog    || [],
      dentalProcedureCatalog:  data.dentalProcedureCatalog  || [],
    };
  } catch (err) {
    console.warn('[PatientRecordService] Could not fetch catalogs:', err.message);
    return {
      medicalConditionCatalog: [],
      hospitalizationCatalog:  [],
      operationCatalog:        [],
      medicationCatalog:       [],
      immunizationCatalog:     [],
      allergenCatalog:         [],
      oralApplianceCatalog:    [],
      dentalProcedureCatalog:  [],
    };
  }
};

// ── Aggregate Fetcher ────────────────────────────────────────────────────────

/**
 * Fetch all patient record data needed for the review modal in as few HTTP
 * requests as possible.
 *
 * Strategy:
 *  • ONE POST to /emr/medical  — all patient-data resolvers + all catalog
 *    resolvers batched into a single GraphQL document via field aliases.
 *  • ONE POST to /staff/emr   — vital signs (different endpoint, medical only).
 *
 * OB-GYNE is always included for medical-scope records (backend returns []
 * for male patients) so the lazy-load second request is eliminated.
 *
 * The returned object includes a `catalogs` key so callers no longer need a
 * separate fetchCatalogsForReview() call.
 *
 * @param {string} userId  — Patient ID
 * @param {string} scope   — 'Medical' | 'Dental' | 'Both'
 * @param {string} _sex    — kept for API compatibility; OB-GYNE is now batched
 * @returns {Promise<Object>} All fetched record sections + catalogs
 */
export const fetchPatientRecordForReview = async (userId, scope = 'Both', _sex = null) => {
  const includeMedical = scope === 'Medical' || scope === 'Both';
  const includeDental  = scope === 'Dental'  || scope === 'Both';

  // ── Build a single batched /emr/medical query ─────────────────────────────
  const medicalFields = includeMedical ? `
    medicalHistory: getUserMedicalHistory(userId: $userId) {
      id conditions { id conditionId description diagnosedDate relationship } notes created_at
    }
    lifestyle: getUserLifestyle(userId: $userId) {
      id smoker numberOfCigarettesPerDay yearsSmoked alcoholConsumer
      frequencyOfAlcoholConsumption vapeUser vapeType vapeFrequency notes created_at
    }
    allergyProfile: getUserAllergyProfile(userId: $userId) {
      id allergies { id allergenCatalogId status severity notes dateIdentified } notes created_at
    }
    medicationProfile: getUserMedicationProfile(userId: $userId) {
      id medications { id medicineId description } notes created_at
    }
    immunizationProfile: getUserImmunizationProfile(userId: $userId) {
      id immunizations { id vaccineTypeId immunizationDate doseNumber } notes created_at
    }
    hospitalizationProfile: getUserHospitalizationProfile(userId: $userId) {
      id hospitalizations { id conditionId admissionDate dischargeDate notes } notes created_at
    }
    operationProfile: getUserOperationProfile(userId: $userId) {
      id operations { id procedureId operationDate notes } notes created_at
    }
    visualAcuityProfile: getUserVisualAcuityProfile(userId: $userId) {
      id notes acuity { id acuityId left_eye right_eye notes recorded_at } created_at
    }
    obgynHistory: getUserObgynHistory(userId: $userId) {
      id lastMenstrualPeriod hasDysmenorrhea notes created_at
    }` : '';

  const dentalFields = includeDental ? `
    dentalHistory: getUserDentalHistory(userId: $userId) {
      id seenByDentist lastDentalCleaning purpose lastVisitDate archived_at
    }
    dentalProcedureProfile: getUserDentalProcedureProfile(userId: $userId) {
      id procedures { id procedureTypeId procedureDate } notes created_at
    }
    oralApplianceProfile: getUserOralApplianceProfile(userId: $userId) {
      id appliances { id tagId status dateIssued arch } notes created_at
    }
    dentalPhotoRecord: getUserDentalPhotoRecord(userId: $userId, limit: 1) {
      id upperTeeth lowerTeeth isValid created_at
    }` : '';

  const batchedQuery = `
    query FetchPatientRecordForReview($userId: ID!) {
      basicInfo: getPatientBasicInfo(userId: $userId) {
        id identifier branch sex first_name last_name middle_name suffix
        profile_type program year department role latest_ticket_id
        latest_status latest_scope latest_updated_at
      }
      profile: getUserProfile(userId: $userId) {
        ... on StudentProfile { id program year status created_at }
        ... on EmployeeProfile { id department role position status created_at }
      }
      emergencyContact: getUserEmergencyContact(userId: $userId) {
        id
        firstContact { id contactName relationship contactNumber isVerified }
        secondContact { id contactName relationship contactNumber isVerified }
        created_at
      }
      ${medicalFields}
      ${dentalFields}
      medicalConditionCatalog: getDomainCatalogs(domain: MedicalCondition, filterIsValid: true, limit: 200) { id name }
      hospitalizationCatalog: getDomainCatalogs(domain: Hospitalization, filterIsValid: true, limit: 200) { id name }
      operationCatalog: getDomainCatalogs(domain: Operation, filterIsValid: true, limit: 200) { id name }
      medicationCatalog: getDomainCatalogs(domain: Medication, filterIsValid: true, limit: 200) { id name }
      immunizationCatalog: getDomainCatalogs(domain: Immunization, filterIsValid: true, limit: 200) { id name }
      allergenCatalog: getAllergenCatalogs(filterIsValid: true, limit: 200) { id allergen type }
      oralApplianceCatalog: getOralApplianceCatalogs(filterIsValid: true, limit: 200) { id name }
      dentalProcedureCatalog: getDomainCatalogs(domain: DentalProcedure, filterIsValid: true, limit: 200) { id name }
    }`;

  // Fire the batched EMR query and the vital-signs query in parallel
  // (vital signs uses a different endpoint so it cannot be merged)
  const [emrSettled, vsSettled] = await Promise.allSettled([
    sendGraphQL(batchedQuery, { userId }),
    includeMedical ? getUserVitalSigns(userId) : Promise.resolve([]),
  ]);

  const emr = emrSettled.status === 'fulfilled' ? emrSettled.value : {};
  const vs  = vsSettled.status  === 'fulfilled' ? vsSettled.value  : [];

  if (emrSettled.status === 'rejected') {
    console.error('fetchPatientRecordForReview: batched EMR query failed:', emrSettled.reason);
  }

  // Helper: arrays → first element; objects → as-is; null/undefined → null
  const first = (val) => (Array.isArray(val) ? (val[0] ?? null) : (val ?? null));

  return {
    basicInfo:              emr.basicInfo    ?? null,
    profile:                first(emr.profile),
    emergencyContact:       first(emr.emergencyContact),
    // medical
    medicalHistory:         first(emr.medicalHistory)         ?? null,
    lifestyle:              first(emr.lifestyle)              ?? null,
    allergyProfile:         first(emr.allergyProfile)         ?? null,
    medicationProfile:      first(emr.medicationProfile)      ?? null,
    immunizationProfile:    first(emr.immunizationProfile)    ?? null,
    hospitalizationProfile: first(emr.hospitalizationProfile) ?? null,
    operationProfile:       first(emr.operationProfile)       ?? null,
    visualAcuityProfile:    first(emr.visualAcuityProfile)    ?? null,
    vitalSigns:             first(vs)                         ?? null,
    obgynHistory:           first(emr.obgynHistory)           ?? null,
    // dental
    dentalHistory:          first(emr.dentalHistory)          ?? null,
    dentalProcedureProfile: first(emr.dentalProcedureProfile) ?? null,
    oralApplianceProfile:   first(emr.oralApplianceProfile)   ?? null,
    dentalPhotoRecord:      first(emr.dentalPhotoRecord)      ?? null,
    // catalogs bundled in — callers no longer need fetchCatalogsForReview()
    catalogs: {
      medicalConditionCatalog: emr.medicalConditionCatalog ?? [],
      hospitalizationCatalog:  emr.hospitalizationCatalog  ?? [],
      operationCatalog:        emr.operationCatalog        ?? [],
      medicationCatalog:       emr.medicationCatalog       ?? [],
      immunizationCatalog:     emr.immunizationCatalog     ?? [],
      allergenCatalog:         emr.allergenCatalog         ?? [],
      oralApplianceCatalog:    emr.oralApplianceCatalog    ?? [],
      dentalProcedureCatalog:  emr.dentalProcedureCatalog  ?? [],
    },
  };
};

// ══════════════════════════════════════════════════════════════════════════════
// ── Staff Edit Mutations ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// Profile endpoint helper (for personal info updates)
const sendProfileGraphQL = async (query, variables = {}) => {
  const response = await axiosRequest.post('/profile/medical', { query, variables });
  if (response.data?.errors) {
    throw new Error(response.data.errors[0]?.message || 'GraphQL error occurred');
  }
  return response.data.data;
};

// ── Personal Info (via /profile/medical) ─────────────────────────────────────

export const staffUpdatePersonalRecord = async (userId, input) => {
  const data = await sendProfileGraphQL(
    `mutation UpdatePersonalRecordLog($userId: ID!, $input: userProfileUpdateInput!) {
       updatePersonalRecordLog(userId: $userId, input: $input) {
         id first_name last_name middle_name suffix sex
       }
     }`,
    { userId, input },
  );
  return data.updatePersonalRecordLog;
};

// ── Student Profile ──────────────────────────────────────────────────────────

export const staffUpdateStudentProfile = async (userId, input) => {
  const data = await sendGraphQL(
    `mutation UpdateStudentProfile($userId: ID!, $input: StudentProfileUpdateInput!) {
       updateStudentProfile(userId: $userId, input: $input) {
         id program year
       }
     }`,
    { userId, input },
  );
  return data.updateStudentProfile;
};

// ── Branch / Identifier (Employee) ──────────────────────────────────────────

export const staffSetBranchIdentifier = async (userId, identifier, branch) => {
  const data = await sendProfileGraphQL(
    `mutation StaffSetBranchIdentifier($userId: ID!, $identifier: String!, $branch: USER_BRANCH!) {
       staffSetBranchIdentifier(userId: $userId, identifier: $identifier, branch: $branch)
     }`,
    { userId, identifier, branch },
  );
  return data.staffSetBranchIdentifier;
};

// ── Employee Profile ─────────────────────────────────────────────────────────

export const staffUpdateEmployeeProfile = async (userId, input) => {
  const data = await sendGraphQL(
    `mutation UpdateEmployeeProfile($userId: ID!, $input: EmployeeProfileUpdateInput!) {
       updateEmployeeProfile(userId: $userId, input: $input) {
         id department role position
       }
     }`,
    { userId, input },
  );
  return data.updateEmployeeProfile;
};

// ── Emergency Contact ────────────────────────────────────────────────────────

export const staffUpdateEmergencyContact = async (userId, input) => {
  const data = await sendGraphQL(
    `mutation UpdateEmergencyContact($userId: ID!, $input: EmergencyContactInput!) {
       updateEmergencyContact(userId: $userId, input: $input) { id }
     }`,
    { userId, input },
  );
  return data.updateEmergencyContact;
};

// ── Medical History ──────────────────────────────────────────────────────────

export const staffUpdateMedicalHistory = async (userId, input) => {
  const data = await sendGraphQL(
    `mutation UpdateMedicalHistory($userId: ID!, $input: MedicalHistoryInput!) {
       updateMedicalHistory(userId: $userId, input: $input) { id notes }
     }`,
    { userId, input },
  );
  return data.updateMedicalHistory;
};

// ── Lifestyle ────────────────────────────────────────────────────────────────

export const staffUpdateLifestyle = async (userId, input) => {
  const data = await sendGraphQL(
    `mutation UpdateLifestyle($userId: ID!, $input: LifestyleInput!) {
       updateLifestyle(userId: $userId, input: $input) { id }
     }`,
    { userId, input },
  );
  return data.updateLifestyle;
};

// ── Visual Acuity Profile ────────────────────────────────────────────────────

export const staffUpdateVisualAcuityProfile = async (userId, input) => {
  const data = await sendGraphQL(
    `mutation UpdateVisualAcuityProfile($userId: ID!, $input: VisualAcuityProfileInput!) {
       updateVisualAcuityProfile(userId: $userId, input: $input) { id }
     }`,
    { userId, input },
  );
  return data.updateVisualAcuityProfile;
};

// ── Vital Signs (Physical Measurements) ──────────────────────────────────────

export const staffUpdateVitalSigns = async (userId, input) => {
  const data = await sendStaffEMRGraphQL(
    `mutation CreateVitalSigns($patientId: ID!, $input: VitalSignsInput!) {
       createVitalSigns(patientId: $patientId, input: $input) {
         id height_cm weight_kg blood_pressure heart_rate temperature
       }
     }`,
    { patientId: userId, input },
  );
  return data.createVitalSigns;
};

// ── OB-GYNE History ─────────────────────────────────────────────────────────

export const staffUpdateObgynHistory = async (userId, input) => {
  const data = await sendGraphQL(
    `mutation UpdateObgynHistory($userId: ID!, $input: ObgynHistoryUpdateInput!) {
       updateObgynHistory(userId: $userId, input: $input) { id }
     }`,
    { userId, input },
  );
  return data.updateObgynHistory;
};

// ── Dental History ───────────────────────────────────────────────────────────

export const staffUpdateDentalHistory = async (userId, input) => {
  const data = await sendGraphQL(
    `mutation UpdateDentalHistory($userId: ID!, $input: DentalHistoryUpdateInput!) {
       updateDentalHistory(userId: $userId, input: $input) { id }
     }`,
    { userId, input },
  );
  return data.updateDentalHistory;
};

// ── Allergy Profile ──────────────────────────────────────────────────────────

export const staffUpdateAllergyProfile = async (userId, input) => {
  const data = await sendGraphQL(
    `mutation UpdateAllergyProfile($userId: ID!, $input: AllergyProfileUpdateInput!) {
       updateAllergyProfile(userId: $userId, input: $input) { id }
     }`,
    { userId, input },
  );
  return data.updateAllergyProfile;
};

// ── Medication Profile ───────────────────────────────────────────────────────

export const staffUpdateMedicationProfile = async (userId, input) => {
  const data = await sendGraphQL(
    `mutation UpdateMedicationProfile($userId: ID!, $input: MedicationProfileInput!) {
       updateMedicationProfile(userId: $userId, input: $input) { id }
     }`,
    { userId, input },
  );
  return data.updateMedicationProfile;
};

// ── Immunization Profile ─────────────────────────────────────────────────────

export const staffUpdateImmunizationProfile = async (userId, input) => {
  const data = await sendGraphQL(
    `mutation UpdateImmunizationProfile($userId: ID!, $input: ImmunizationProfileInput!) {
       updateImmunizationProfile(userId: $userId, input: $input) { id }
     }`,
    { userId, input },
  );
  return data.updateImmunizationProfile;
};

// ── Hospitalization Profile ──────────────────────────────────────────────────

export const staffUpdateHospitalizationProfile = async (userId, input) => {
  const data = await sendGraphQL(
    `mutation UpdateHospitalizationProfile($userId: ID!, $input: HospitalizationProfileInput!) {
       updateHospitalizationProfile(userId: $userId, input: $input) { id }
     }`,
    { userId, input },
  );
  return data.updateHospitalizationProfile;
};

// ── Operation Profile ────────────────────────────────────────────────────────

export const staffUpdateOperationProfile = async (userId, input) => {
  const data = await sendGraphQL(
    `mutation UpdateOperationProfile($userId: ID!, $input: OperationProfileInput!) {
       updateOperationProfile(userId: $userId, input: $input) { id }
     }`,
    { userId, input },
  );
  return data.updateOperationProfile;
};

// ══════════════════════════════════════════════════════════════════════════════
// ── Submit All Staff Edits (orchestrator) ────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const YEAR_DISPLAY_TO_ENUM = {
  'Grade 11': 'Grade11', 'Grade 12': 'Grade12',
  Freshman: 'Freshman', Sophomore: 'Sophomore',
  Junior: 'Junior', Senior: 'Senior',
  Masteral: 'Masteral', Doctorate: 'Doctorate',
};

/**
 * Submit all staff-edited fields to the backend before approving a record.
 *
 * @param {string} userId       — Patient ID
 * @param {Object} editedFields — Keyed by section name from the review modal
 * @param {Object} recordData   — Original fetched record data (for merging required fields)
 * @returns {Promise<{success: boolean, errors: string[]}>}
 */
export const submitStaffEdits = async (userId, editedFields, recordData) => {
  const errors = [];
  const mutations = [];

  // ── Personal Info ──────────────────────────────────────────────────────────
  const pi = editedFields.personalInfo;
  if (pi && Object.keys(pi).length > 0) {
    // Personal record fields (name, sex) → /profile/medical
    const personalFields = {};
    if (pi.first_name !== undefined) personalFields.first_name = pi.first_name;
    if (pi.last_name !== undefined) personalFields.last_name = pi.last_name;
    if (pi.middle_name !== undefined) personalFields.middle_name = pi.middle_name;
    if (pi.suffix !== undefined) personalFields.suffix = pi.suffix;
    if (pi.sex !== undefined) personalFields.sex = pi.sex;

    if (Object.keys(personalFields).length > 0) {
      // sex is required in userProfileUpdateInput
      if (!personalFields.sex) personalFields.sex = recordData?.basicInfo?.sex || 'Male';
      mutations.push(
        staffUpdatePersonalRecord(userId, personalFields)
          .catch((e) => { errors.push(`Personal info: ${e.message}`); }),
      );
    }

    // Student profile → /emr/medical
    const studentFields = {};
    if (pi.program !== undefined) studentFields.program = pi.program;
    if (pi.year !== undefined) studentFields.year = YEAR_DISPLAY_TO_ENUM[pi.year] ?? pi.year;

    if (Object.keys(studentFields).length > 0 &&
        (recordData?.basicInfo?.profile_type === 'Student' || recordData?.profile?.program)) {
      mutations.push(
        staffUpdateStudentProfile(userId, studentFields)
          .catch((e) => { errors.push(`Student profile: ${e.message}`); }),
      );
    }

    // Employee profile → /emr/medical
    const employeeFields = {};
    if (pi.department !== undefined) employeeFields.department = pi.department;
    if (pi.role !== undefined) employeeFields.role = pi.role;
    if (pi.position !== undefined) employeeFields.position = pi.position;

    if (Object.keys(employeeFields).length > 0 &&
        (recordData?.basicInfo?.profile_type === 'Employee' || recordData?.profile?.department)) {
      mutations.push(
        staffUpdateEmployeeProfile(userId, employeeFields)
          .catch((e) => { errors.push(`Employee profile: ${e.message}`); }),
      );
    }

    // Branch / Identifier for Employee → /profile/medical
    const isEmployee = recordData?.basicInfo?.profile_type === 'Employee' || recordData?.profile?.department;
    if (isEmployee && (pi.identifier !== undefined || pi.branch !== undefined)) {
      const newIdentifier = pi.identifier ?? recordData?.basicInfo?.identifier ?? '';
      const newBranch = pi.branch ?? recordData?.basicInfo?.branch ?? 'Manila';
      mutations.push(
        staffSetBranchIdentifier(userId, String(newIdentifier), newBranch)
          .catch((e) => { errors.push(`Branch/Identifier: ${e.message}`); }),
      );
    }
  }

  // ── Emergency Contacts ─────────────────────────────────────────────────────
  const ec = editedFields.emergencyContact;
  if (ec && Object.keys(ec).length > 0) {
    const origFirst = recordData?.emergencyContact?.firstContact ?? {};
    const origSecond = recordData?.emergencyContact?.secondContact ?? {};

    const input = {
      firstContact: {
        contactName: ec['first.contactName'] ?? origFirst.contactName ?? '',
        relationship: ec['first.relationship'] ?? origFirst.relationship ?? '',
        contactNumber: ec['first.contactNumber'] ?? origFirst.contactNumber ?? '',
      },
      secondContact: {
        contactName: ec['second.contactName'] ?? origSecond.contactName ?? '',
        relationship: ec['second.relationship'] ?? origSecond.relationship ?? '',
        contactNumber: ec['second.contactNumber'] ?? origSecond.contactNumber ?? '',
      },
    };

    mutations.push(
      staffUpdateEmergencyContact(userId, input)
        .catch((e) => { errors.push(`Emergency contacts: ${e.message}`); }),
    );
  }

  // ── Medical History (notes only) ───────────────────────────────────────────
  const mh = editedFields.medicalHistory;
  if (mh && Object.keys(mh).length > 0) {
    const origConditions = recordData?.medicalHistory?.conditions ?? [];
    const input = {
      conditions: origConditions.map((c) => ({
        conditionId: c.conditionId,
        description: c.description || undefined,
        diagnosedDate: c.diagnosedDate || undefined,
        relationship: c.relationship || undefined,
      })),
      notes: mh.notes ?? recordData?.medicalHistory?.notes ?? null,
    };

    mutations.push(
      staffUpdateMedicalHistory(userId, input)
        .catch((e) => { errors.push(`Medical history: ${e.message}`); }),
    );
  }

  // ── Medical Background ─────────────────────────────────────────────────────
  const mb = editedFields.medicalBackground;
  if (mb && Object.keys(mb).length > 0) {
    // — Lifestyle —
    const lifestyleKeys = ['smoker', 'cigarettesPerDay', 'yearsSmoked', 'alcoholConsumer', 'alcoholFrequency', 'vaper', 'vapeType', 'vapeFrequency', 'lifestyleNotes'];
    if (lifestyleKeys.some((k) => mb[k] !== undefined)) {
      const origLifestyle = recordData?.lifestyle || {};
      const input = {};
      
      // Always include required Boolean fields, fallback to original data
      input.smoker = mb.smoker !== undefined ? (mb.smoker === 'Yes') : (origLifestyle.smoker ?? true);
      input.alcoholConsumer = mb.alcoholConsumer !== undefined ? (mb.alcoholConsumer === 'Yes') : (origLifestyle.alcoholConsumer ?? true);
      input.vapeUser = mb.vaper !== undefined ? (mb.vaper === 'Yes') : (origLifestyle.vapeUser ?? false);
      
      // Optional fields
      if (mb.cigarettesPerDay !== undefined) input.numberOfCigarettesPerDay = parseInt(mb.cigarettesPerDay, 10) || null;
      else if (origLifestyle.numberOfCigarettesPerDay !== undefined) input.numberOfCigarettesPerDay = origLifestyle.numberOfCigarettesPerDay;
      
      if (mb.yearsSmoked !== undefined) input.yearsSmoked = parseInt(mb.yearsSmoked, 10) || null;
      else if (origLifestyle.yearsSmoked !== undefined) input.yearsSmoked = origLifestyle.yearsSmoked;
      
      if (mb.alcoholFrequency !== undefined) input.frequencyOfAlcoholConsumption = mb.alcoholFrequency || null;
      else if (origLifestyle.frequencyOfAlcoholConsumption !== undefined) input.frequencyOfAlcoholConsumption = origLifestyle.frequencyOfAlcoholConsumption;
      
      if (mb.vapeType !== undefined) input.vapeType = mb.vapeType || null;
      else if (origLifestyle.vapeType !== undefined) input.vapeType = origLifestyle.vapeType;
      
      if (mb.vapeFrequency !== undefined) input.vapeFrequency = mb.vapeFrequency || null;
      else if (origLifestyle.vapeFrequency !== undefined) input.vapeFrequency = origLifestyle.vapeFrequency;
      
      if (mb.lifestyleNotes !== undefined) input.notes = mb.lifestyleNotes || null;
      else if (origLifestyle.notes !== undefined) input.notes = origLifestyle.notes;

      mutations.push(
        staffUpdateLifestyle(userId, input)
          .catch((e) => { errors.push(`Lifestyle: ${e.message}`); }),
      );
    }

    // — Visual Acuity —
    const acuityKeys = ['acuityLeft', 'acuityRight', 'acuityNotes'];
    if (acuityKeys.some((k) => mb[k] !== undefined)) {
      const origAcuity = recordData?.visualAcuityProfile?.acuity;
      const input = {
        acuity: {
          acuityId: origAcuity?.acuityId ?? origAcuity?.id ?? '0',
          left_eye: mb.acuityLeft ?? origAcuity?.left_eye ?? '',
          right_eye: mb.acuityRight ?? origAcuity?.right_eye ?? '',
          notes: mb.acuityNotes ?? origAcuity?.notes ?? null,
        },
      };

      mutations.push(
        staffUpdateVisualAcuityProfile(userId, input)
          .catch((e) => { errors.push(`Visual acuity: ${e.message}`); }),
      );
    }

    // Vital signs moved to separate section: handled below when present in editedFields.physicalMeasurements
  }

  // ── Physical Measurements (vital signs) ─────────────────────────────────
  const pm = editedFields.physicalMeasurements;
  if (pm && Object.keys(pm).length > 0) {
    const orig = recordData?.vitalSigns || {};
    const input = {
      height_cm:      parseFloat(pm.height_cm ?? orig.height_cm) || 0,
      weight_kg:      parseFloat(pm.weight_kg ?? orig.weight_kg) || 0,
      blood_pressure: pm.blood_pressure ?? orig.blood_pressure ?? '',
      heart_rate:     parseInt(pm.heart_rate ?? orig.heart_rate, 10) || 0,
      temperature:    parseFloat(pm.temperature ?? orig.temperature) || 0,
    };

    mutations.push(
      staffUpdateVitalSigns(userId, input)
        .catch((e) => { errors.push(`Vital signs: ${e.message}`); }),
    );
  }

  // ── OB-GYNE ───────────────────────────────────────────────────────────────
  const ob = editedFields.obgyne;
  if (ob && Object.keys(ob).length > 0) {
    const input = {};
    if (ob.lastMenstrualPeriod !== undefined) input.lastMenstrualPeriod = ob.lastMenstrualPeriod || null;
    if (ob.hasDysmenorrhea !== undefined) input.hasDysmenorrhea = ob.hasDysmenorrhea === 'Yes';
    if (ob.notes !== undefined) input.notes = ob.notes || null;

    mutations.push(
      staffUpdateObgynHistory(userId, input)
        .catch((e) => { errors.push(`OB-GYNE: ${e.message}`); }),
    );
  }

  // ── Dental History (excluding dental procedures — dental doctor only) ──────
  const dh = editedFields.dentalHistory;
  if (dh && Object.keys(dh).length > 0) {
    const input = {};
    if (dh.seenByDentist !== undefined) input.seenByDentist = dh.seenByDentist === 'Yes';
    if (dh.lastDentalCleaning !== undefined) input.lastDentalCleaning = dh.lastDentalCleaning || null;
    if (dh.purpose !== undefined) input.purpose = dh.purpose || null;
    if (dh.lastVisitDate !== undefined) input.lastVisitDate = dh.lastVisitDate || null;

    mutations.push(
      staffUpdateDentalHistory(userId, input)
        .catch((e) => { errors.push(`Dental history: ${e.message}`); }),
    );
  }

  // Execute all mutations in parallel
  await Promise.all(mutations);

  return { success: errors.length === 0, errors };
};
