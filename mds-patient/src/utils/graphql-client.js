/**
 * Shared GraphQL Client
 * 
 * Centralizes GraphQL request logic to eliminate duplication across service files.
 * All GraphQL requests to the patient EMR endpoint should use this utility.
 */

import { axiosRequest } from '../packages-core-adapter';

/**
 * Send a GraphQL request to the patient EMR endpoint
 * @param {string} query - GraphQL query/mutation string
 * @param {object} variables - Variables for the GraphQL operation
 * @param {object} [options] - Additional options
 * @param {string} [options.endpoint='/emr/patient'] - GraphQL endpoint path
 * @returns {Promise<object>} The `data` field from the GraphQL response
 * @throws {Error} If the response contains GraphQL errors or the request fails
 */
export const sendGraphQLRequest = async (query, variables = {}, options = {}) => {
  const endpoint = options.endpoint || '/emr/patient';

  try {
    const response = await axiosRequest.post(endpoint, {
      query,
      variables
    });

    if (response.data.errors) {
      const firstError = response.data.errors[0];
      const error = new Error(firstError?.message || 'GraphQL error occurred');
      error.graphQLErrors = response.data.errors;
      // If there's still partial data, attach it to the error
      if (response.data.data) {
        error.data = response.data.data;
      }
      throw error;
    }

    return response.data.data;
  } catch (error) {
    // Re-throw GraphQL errors as-is (already formatted above)
    if (error.graphQLErrors) {
      throw error;
    }

    // Wrap network/axios errors with context
    if (error.response?.data?.errors) {
      const firstError = error.response.data.errors[0];
      const wrappedError = new Error(firstError?.message || 'GraphQL request failed');
      wrappedError.graphQLErrors = error.response.data.errors;
      wrappedError.status = error.response.status;
      throw wrappedError;
    }

    throw error;
  }
};
