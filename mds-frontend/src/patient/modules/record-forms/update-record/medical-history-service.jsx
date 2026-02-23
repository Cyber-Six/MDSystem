/**
 * Medical History Service
 * 
 * Fetches ALL medical catalog data in a SINGLE GraphQL request using aliases.
 * This eliminates redundant API calls (previously 8 separate POST requests)
 * when loading the medical history form.
 * 
 * Catalog types fetched:
 *   - Medical Conditions (via searchDomainCatalogs)
 *   - Hospitalizations, Operations, Immunizations, VisualAcuity, Medications (via getDomainCatalogs)
 *   - Allergens (via getAllergenCatalogs)
 */

import { axiosRequest } from '../../../../packages-core-adapter';

// ==================== STATIC FALLBACK DATA ====================

const STATIC_MEDICAL_CONDITIONS = [
  { id: 'heartCondition', name: 'Heart Condition' },
  { id: 'highBloodPressure', name: 'High Blood Pressure' },
  { id: 'epilepsySeizure', name: 'Epilepsy/Seizure' },
  { id: 'psychiatricIllness', name: 'Psychiatric Illness' },
  { id: 'bronchialAsthma', name: 'Bronchial Asthma' },
  { id: 'diabetesTypeI', name: 'Diabetes Type I' },
  { id: 'diabetesTypeII', name: 'Diabetes Type II' },
  { id: 'hepatitisA', name: 'Hepatitis A' },
  { id: 'hepatitisB', name: 'Hepatitis B' },
  { id: 'hepatitisC', name: 'Hepatitis C' },
  { id: 'hepatitisD', name: 'Hepatitis D' },
  { id: 'hepatitisE', name: 'Hepatitis E' },
  { id: 'amoebiasis', name: 'Amoebiasis' },
  { id: 'tuberculosis', name: 'Tuberculosis' },
  { id: 'typhoidFever', name: 'Typhoid Fever' }
];

const STATIC_ALLERGENS = [
  { id: 'penicillin', allergen: 'Penicillin', type: 'Drug' },
  { id: 'aspirin', allergen: 'Aspirin', type: 'Drug' },
  { id: 'ibuprofen', allergen: 'Ibuprofen', type: 'Drug' },
  { id: 'peanuts', allergen: 'Peanuts', type: 'Food' },
  { id: 'shellfish', allergen: 'Shellfish', type: 'Food' },
  { id: 'eggs', allergen: 'Eggs', type: 'Food' },
  { id: 'milk', allergen: 'Milk', type: 'Food' },
  { id: 'pollen', allergen: 'Pollen', type: 'Environmental' },
  { id: 'dust', allergen: 'Dust', type: 'Environmental' },
  { id: 'mold', allergen: 'Mold', type: 'Environmental' },
  { id: 'beesting', allergen: 'Bee Sting', type: 'Insect' },
  { id: 'latex', allergen: 'Latex', type: 'Chemical' }
];

const STATIC_IMMUNIZATIONS = [
  { id: 'covid19', domain: 'Immunization', name: 'COVID-19', code: 'covid19', isValid: true },
  { id: 'influenza', domain: 'Immunization', name: 'Influenza (Flu)', code: 'influenza', isValid: true },
  { id: 'hepatitisB', domain: 'Immunization', name: 'Hepatitis B', code: 'hepatitisB', isValid: true },
  { id: 'mmr', domain: 'Immunization', name: 'MMR (Measles, Mumps, Rubella)', code: 'mmr', isValid: true },
  { id: 'tetanus', domain: 'Immunization', name: 'Tetanus/Diphtheria', code: 'tetanus', isValid: true },
  { id: 'varicella', domain: 'Immunization', name: 'Varicella (Chickenpox)', code: 'varicella', isValid: true },
  { id: 'hpv', domain: 'Immunization', name: 'HPV', code: 'hpv', isValid: true },
  { id: 'meningococcal', domain: 'Immunization', name: 'Meningococcal', code: 'meningococcal', isValid: true },
  { id: 'pneumococcal', domain: 'Immunization', name: 'Pneumococcal', code: 'pneumococcal', isValid: true }
];

// ==================== COMBINED CATALOG QUERY ====================

/**
 * Single GraphQL query using aliases to fetch ALL catalogs at once.
 * Replaces 8 separate POST requests with 1.
 */
const ALL_CATALOGS_QUERY = `
  query FetchAllMedicalCatalogs {
    medicalConditions: searchDomainCatalogs(domain: "MedicalCondition", filterIsValid: true, names: []) {
      id
      domain
      name
      code
      description
      isValid
    }
    hospitalizations: getDomainCatalogs(domain: Hospitalization, filterIsValid: true) {
      id
      domain
      name
      code
      description
      isValid
    }
    operations: getDomainCatalogs(domain: Operation, filterIsValid: true) {
      id
      domain
      name
      code
      description
      isValid
    }
    immunizations: getDomainCatalogs(domain: Immunization, filterIsValid: true) {
      id
      domain
      name
      code
      description
      isValid
    }
    visualAcuity: getDomainCatalogs(domain: VisualAcuity, filterIsValid: true) {
      id
      domain
      name
      code
      description
      isValid
    }
    medications: getDomainCatalogs(domain: Medication, filterIsValid: true) {
      id
      domain
      name
      code
      description
      isValid
    }
    allergens: getAllergenCatalogs(filterIsValid: true) {
      id
      allergen
      type
      isValid
    }
  }
`;

// ==================== MAIN FETCH FUNCTION ====================

/**
 * Fetches ALL medical catalogs in a single GraphQL request.
 * Uses GraphQL aliases to combine 7 different catalog queries into 1 POST.
 * Falls back to static data if the backend is unavailable or returns empty results.
 * 
 * @returns {Promise<object>} Object containing all catalog arrays:
 *   - medicalConditions: Array of {id, name, domain, code, description, isValid}
 *   - hospitalizations: Array of DomainCatalog
 *   - operations: Array of DomainCatalog
 *   - immunizations: Array of DomainCatalog
 *   - visualAcuity: Array of DomainCatalog
 *   - medications: Array of DomainCatalog
 *   - allergens: Array of {id, allergen, type, isValid}
 *   - isLoaded: boolean
 *   - error: string | null
 */
export async function fetchAllMedicalCatalogs() {
  try {
    console.log('📥 Fetching all medical catalogs (single request)...');

    const response = await axiosRequest({
      method: 'POST',
      url: '/emr/patient',
      data: {
        query: ALL_CATALOGS_QUERY,
        variables: {}
      }
    });

    // Handle GraphQL errors gracefully
    if (response.data.errors) {
      console.warn('⚠️ GraphQL Errors:', response.data.errors.map(e => e.message).join(', '));

      // If complete failure (data is null), fall back to static data
      if (response.data.data === null) {
        console.log('ℹ️ Backend returned null, using static fallback data');
        return getStaticFallbackCatalogs();
      }
    }

    const data = response.data.data || {};

    // Build catalogs object, using static fallbacks for empty results
    const catalogs = {
      medicalConditions: (data.medicalConditions && data.medicalConditions.length > 0)
        ? data.medicalConditions
        : STATIC_MEDICAL_CONDITIONS,
      hospitalizations: data.hospitalizations || [],
      operations: data.operations || [],
      immunizations: (data.immunizations && data.immunizations.length > 0)
        ? data.immunizations
        : STATIC_IMMUNIZATIONS,
      visualAcuity: data.visualAcuity || [],
      medications: data.medications || [],
      allergens: (data.allergens && data.allergens.length > 0)
        ? data.allergens
        : STATIC_ALLERGENS,
      isLoaded: true,
      error: null
    };

    console.log('✅ All medical catalogs loaded (1 request):', {
      medicalConditions: catalogs.medicalConditions.length,
      hospitalizations: catalogs.hospitalizations.length,
      operations: catalogs.operations.length,
      immunizations: catalogs.immunizations.length,
      visualAcuity: catalogs.visualAcuity.length,
      medications: catalogs.medications.length,
      allergens: catalogs.allergens.length
    });

    return catalogs;
  } catch (error) {
    console.error('❌ Failed to fetch medical catalogs:', error.message);
    return getStaticFallbackCatalogs(error.message);
  }
}

/**
 * Returns static fallback catalog data when backend is unavailable.
 * 
 * @param {string|null} errorMessage - Error message if calling due to failure
 * @returns {object} Catalog object with static fallback arrays
 */
function getStaticFallbackCatalogs(errorMessage = null) {
  console.log('ℹ️ Using static fallback catalogs');
  return {
    medicalConditions: STATIC_MEDICAL_CONDITIONS,
    hospitalizations: [],
    operations: [],
    immunizations: STATIC_IMMUNIZATIONS,
    visualAcuity: [],
    medications: [],
    allergens: STATIC_ALLERGENS,
    isLoaded: true,
    error: errorMessage
  };
}
