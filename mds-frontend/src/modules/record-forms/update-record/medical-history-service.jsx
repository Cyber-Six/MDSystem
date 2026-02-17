/**
 * Medical History Service
 * 
 * EMERGENCY FIX 1: userId is hardcoded to "1" on lines 54, 95, 142
 * TODO: Replace with actual userId from JWT token once auth system is implemented
 * 
 * Fetches domain catalogs and allergies for medical history form dropdowns
 * This service loads all necessary catalogs before the form renders
 */

import { axiosRequest } from '../../../packages-core-adapter';

/**
 * Sends GraphQL request to backend
 * @param {string} query - GraphQL query string
 * @param {object} variables - Query variables
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
      // This allows fallback logic (|| []) to work naturally
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

/**
 * Fetches domain catalogs for medical conditions, hospitalization, operation, 
 * immunization, and visual acuity
 * 
 * @param {string} domainType - Type of domain (Hospitalization, Operation, Immunization, VisualAcuity, etc)
 * @returns {Promise<Array>} Array of domain catalogs
 */
export async function getDomainCatalogs(domainType) {
  const query = `
    query GetDomainCatalogs($domain: DomainType, $filterIsValid: Boolean) {
      getDomainCatalogs(domain: $domain, filterIsValid: $filterIsValid) {
        id
        domain
        name
        code
        description
        isValid
        created_at
      }
    }
  `;

  try {
    console.log(`✓ Fetching ${domainType} catalogs...`);
    const response = await sendGraphQLRequest(query, {
      domain: domainType,
      filterIsValid: true
    });

    const catalogs = response.getDomainCatalogs || [];
    console.log(`✓ Fetched ${catalogs.length} ${domainType} items`);
    return catalogs;
  } catch (error) {
    console.error(`✗ Failed to fetch ${domainType} catalogs:`, error);
    return [];
  }
}

/**
 * Fetches allergen catalogs for allergies
 * Fetches all allergen types (Food, Drug, Environmental, Insect, Chemical, Other)
 * 
 * @returns {Promise<Array>} Array of allergen catalogs
 */
export async function getAllergenCatalogs() {
  const query = `
    query GetAllergenCatalogs($filterIsValid: Boolean) {
      getAllergenCatalogs(filterIsValid: $filterIsValid) {
        id
        allergen
        type
        isValid
        created_at
      }
    }
  `;

  try {
    console.log('✓ Fetching allergen catalogs...');
    const response = await sendGraphQLRequest(query, {
      filterIsValid: true
    });

    const allergens = response.getAllergenCatalogs || [];
    console.log(`✓ Fetched ${allergens.length} allergen items`);
    
    // If no allergens from backend, use static fallback
    if (allergens.length === 0) {
      console.log('✓ Using static allergen fallback');
      return [
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
    }
    
    return allergens;
  } catch (error) {
    console.error('✗ Failed to fetch allergen catalogs:', error);
    // Return static array as fallback
    return [
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
  }
}

/**
 * Fetches all required catalogs in parallel for medical history form
 * Includes: Medical Conditions, Hospitalization, Operation, Immunization, Visual Acuity, Allergies
 * 
 * @returns {Promise<object>} Object containing all catalog arrays
 */
export async function fetchAllMedicalCatalogs() {
  try {
    console.log('✓ Starting to fetch all medical catalogs...');

    const [
      medicalConditions,
      hospitalizations,
      operations,
      immunizations,
      visualAcuity,
      medications,
      allergens
    ] = await Promise.all([
      getMedicalConditions(),
      getDomainCatalogs('Hospitalization'),
      getDomainCatalogs('Operation'),
      getDomainCatalogs('Immunization'),
      getDomainCatalogs('VisualAcuity'),
      getDomainCatalogs('Medication'),
      getAllergenCatalogs()
    ]);

    const catalogs = {
      medicalConditions,
      hospitalizations,
      operations,
      immunizations,
      visualAcuity,
      medications,
      allergens,
      isLoaded: true,
      error: null
    };

    console.log('✓ All catalogs loaded successfully');
    return catalogs;
  } catch (error) {
    console.error('✗ Failed to fetch medical catalogs:', error);
    return {
      medicalConditions: [],
      hospitalizations: [],
      operations: [],
      immunizations: [],
      visualAcuity: [],
      medications: [],
      allergens: [],
      isLoaded: true,
      error: error.message
    };
  }
}

/**
 * Fetches medical condition domain catalog
 * Attempts to fetch from backend, falls back to static list if not available
 * 
 * @returns {Promise<Array>} Array of medical condition catalogs
 */
export async function getMedicalConditions() {
  try {
    console.log('✓ Fetching medical conditions...');
    
    // Try to fetch medical conditions using searchDomainCatalogs
    const query = `
      query SearchDomainCatalogs($domain: String, $names: [String!]!) {
        searchDomainCatalogs(domain: $domain, filterIsValid: true, names: $names) {
          id
          domain
          name
          code
          description
          isValid
        }
      }
    `;

    try {
      const response = await sendGraphQLRequest(query, {
        domain: 'MedicalCondition',
        names: []
      });

      const conditions = response.searchDomainCatalogs || [];
      if (conditions.length > 0) {
        console.log(`✓ Fetched ${conditions.length} medical conditions from backend`);
        return conditions;
      }
    } catch (err) {
      console.warn('⚠️  searchDomainCatalogs query not available, using fallback');
    }

    // Fallback to static array
    console.log('✓ Using static medical conditions fallback');
    return [
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
  } catch (error) {
    console.error('✗ Medical conditions fetch error:', error);
    // Return static array as fallback
    return [
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
  }
}

/**
 * Convenience function to fetch all catalogs including medical conditions
 * 
 * @returns {Promise<object>} Object containing all catalog arrays
 */
export async function fetchAllCatalogsWithConditions() {
  try {
    const [
      medicalConditions,
      allCatalogs
    ] = await Promise.all([
      getMedicalConditions(),
      fetchAllMedicalCatalogs()
    ]);

    return {
      ...allCatalogs,
      medicalConditions
    };
  } catch (error) {
    console.error('✗ Failed to fetch all catalogs with conditions:', error);
    return {
      medicalConditions: [],
      hospitalizations: [],
      operations: [],
      immunizations: [],
      visualAcuity: [],
      medications: [],
      allergens: [],
      isLoaded: true,
      error: error.message
    };
  }
}
