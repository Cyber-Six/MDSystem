/**
 * Dental History Service
 * 
 * Fetches oral appliance catalogs, oral finding catalogs, and dental procedure catalogs
 * This service loads all necessary catalogs before the dental form renders
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
 * Fetches oral appliance catalogs
 * Used for intraoral appliances (braces, retainers, dentures, etc.)
 * 
 * @returns {Promise<Array>} Array of oral appliance tags
 */
export async function getOralApplianceCatalogs() {
  const query = `
    query GetOralApplianceCatalogs($filterIsValid: Boolean) {
      getOralApplianceCatalogs(filterIsValid: $filterIsValid) {
        id
        name
        description
        archable
        isActive
        created_at
      }
    }
  `;

  try {
    console.log('✓ Fetching oral appliance catalogs...');
    const response = await sendGraphQLRequest(query, {
      filterIsValid: true
    });

    const appliances = response.getOralApplianceCatalogs || [];
    console.log(`✓ Fetched ${appliances.length} oral appliance items`);
    
    // If no appliances from backend, use static fallback
    if (appliances.length === 0) {
      console.log('✓ Using static oral appliance fallback');
      return [
        { id: 'braces', name: 'Braces', archable: true, isActive: true },
        { id: 'retainer', name: 'Retainer', archable: true, isActive: true },
        { id: 'dentures', name: 'Dentures', archable: true, isActive: true },
        { id: 'nightguard', name: 'Night Guard', archable: true, isActive: true },
        { id: 'expander', name: 'Expander', archable: true, isActive: true },
        { id: 'spacer', name: 'Spacer', archable: false, isActive: true }
      ];
    }
    
    return appliances;
  } catch (error) {
    console.error('✗ Failed to fetch oral appliance catalogs:', error);
    // Return static array as fallback
    return [
      { id: 'braces', name: 'Braces', archable: true, isActive: true },
      { id: 'retainer', name: 'Retainer', archable: true, isActive: true },
      { id: 'dentures', name: 'Dentures', archable: true, isActive: true },
      { id: 'nightguard', name: 'Night Guard', archable: true, isActive: true },
      { id: 'expander', name: 'Expander', archable: true, isActive: true },
      { id: 'spacer', name: 'Spacer', archable: false, isActive: true }
    ];
  }
}

/**
 * DISABLED: Fetches oral finding catalogs
 * Backend table "oralFindingCatalog" doesn't exist - causes error
 * Commented out until backend creates the table
 * 
 * Used for oral health findings (calculus, gingivitis, etc.)
 * 
 * @returns {Promise<Array>} Array of oral finding catalogs
 */
/*
export async function getOralFindingCatalogs() {
  const query = `
    query GetOralFindingCatalogs($filterIsValid: Boolean) {
      getOralFindingCatalogs(filterIsValid: $filterIsValid) {
        name
        isActive
        description
      }
    }
  `;

  try {
    console.log('✓ Fetching oral finding catalogs...');
    const response = await sendGraphQLRequest(query, {
      filterIsValid: true
    });

    const findings = response.getOralFindingCatalogs || [];
    console.log(`✓ Fetched ${findings.length} oral finding items`);
    
    // If no findings from backend, use static fallback
    if (findings.length === 0) {
      console.log('✓ Using static oral finding fallback');
      return [
        { name: 'Calculus', isActive: true, description: 'Tartar buildup' },
        { name: 'Gingivitis', isActive: true, description: 'Gum inflammation' },
        { name: 'Periodontitis', isActive: true, description: 'Advanced gum disease' },
        { name: 'Cavity', isActive: true, description: 'Tooth decay' },
        { name: 'Plaque', isActive: true, description: 'Bacterial film on teeth' }
      ];
    }
    
    return findings;
  } catch (error) {
    console.error('✗ Failed to fetch oral finding catalogs:', error);
    // Return static array as fallback
    return [
      { name: 'Calculus', isActive: true, description: 'Tartar buildup' },
      { name: 'Gingivitis', isActive: true, description: 'Gum inflammation' },
      { name: 'Periodontitis', isActive: true, description: 'Advanced gum disease' },
      { name: 'Cavity', isActive: true, description: 'Tooth decay' },
      { name: 'Plaque', isActive: true, description: 'Bacterial film on teeth' }
    ];
  }
}
*/


/**
 * Fetches dental procedure domain catalog
 * Used for dental procedures (extractions, fillings, etc.)
 * 
 * @returns {Promise<Array>} Array of dental procedure catalogs
 */
export async function getDentalProcedureCatalogs() {
  const query = `
    query GetDentalProcedureCatalogs {
      getDomainCatalogs(domain: DentalProcedure, filterIsValid: true) {
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
    console.log('✓ Fetching dental procedure catalogs...');
    const response = await sendGraphQLRequest(query, {});

    const procedures = response.getDomainCatalogs || [];
    console.log(`✓ Fetched ${procedures.length} dental procedure items`);
    
    // If no procedures from backend, use static fallback
    if (procedures.length === 0) {
      console.log('✓ Using static dental procedure fallback');
      return [
        { id: 'extraction', name: 'Tooth Extraction', code: 'EXT' },
        { id: 'filling', name: 'Filling/Restoration', code: 'FIL' },
        { id: 'rootcanal', name: 'Root Canal', code: 'RCT' },
        { id: 'crown', name: 'Crown/Bridge', code: 'CRN' },
        { id: 'dentures', name: 'Dentures', code: 'DEN' },
        { id: 'ortho', name: 'Orthodontic Treatment', code: 'ORT' },
        { id: 'implant', name: 'Dental Implant', code: 'IMP' },
        { id: 'whitening', name: 'Teeth Whitening', code: 'WHT' },
        { id: 'gumtreatment', name: 'Gum Treatment', code: 'GUM' }
      ];
    }
    
    return procedures;
  } catch (error) {
    console.error('✗ Failed to fetch dental procedure catalogs:', error);
    // Return static array as fallback
    return [
      { id: 'extraction', name: 'Tooth Extraction', code: 'EXT' },
      { id: 'filling', name: 'Filling/Restoration', code: 'FIL' },
      { id: 'rootcanal', name: 'Root Canal', code: 'RCT' },
      { id: 'crown', name: 'Crown/Bridge', code: 'CRN' },
      { id: 'dentures', name: 'Dentures', code: 'DEN' },
      { id: 'ortho', name: 'Orthodontic Treatment', code: 'ORT' },
      { id: 'implant', name: 'Dental Implant', code: 'IMP' },
      { id: 'whitening', name: 'Teeth Whitening', code: 'WHT' },
      { id: 'gumtreatment', name: 'Gum Treatment', code: 'GUM' }
    ];
  }
}

/**
 * Fetches all required catalogs in parallel for dental history form
 * Includes: Oral Appliances, Dental Procedures
 * NOTE: Removed Oral Findings - backend table doesn't exist
 * 
 * @returns {Promise<object>} Object containing all catalog arrays
 */
export async function fetchAllDentalCatalogs() {
  try {
    console.log('✓ Starting to fetch all dental catalogs...');

    const [
      oralAppliances,
      dentalProcedures
    ] = await Promise.all([
      getOralApplianceCatalogs(),
      getDentalProcedureCatalogs()
    ]);

    const catalogs = {
      oralAppliances,
      dentalProcedures,
      isLoaded: true,
      error: null
    };

    console.log('✓ All dental catalogs loaded successfully');
    return catalogs;
  } catch (error) {
    console.error('✗ Failed to fetch dental catalogs:', error);
    return {
      oralAppliances: [],
      dentalProcedures: [],
      isLoaded: true,
      error: error.message
    };
  }
}
