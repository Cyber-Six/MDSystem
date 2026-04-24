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
 * @param {boolean} [options.allowPartialData=false] - Return partial data even when GraphQL errors exist
 * @returns {Promise<object>} The `data` field from the GraphQL response
 * @throws {Error} If the response contains GraphQL errors or the request fails
 */
export const sendGraphQLRequest = async (query, variables = {}, options = {}) => {
  const endpoint = options.endpoint || '/emr/patient';
  const allowPartialData = options.allowPartialData === true;

  try {
    const response = await axiosRequest.post(endpoint, {
      query,
      variables
    });

    const responseErrors = Array.isArray(response.data?.errors)
      ? response.data.errors.filter(Boolean)
      : [];

    if (responseErrors.length > 0) {
      if (allowPartialData && response.data?.data) {
        return response.data.data;
      }

      const firstError = responseErrors[0];
      const error = new Error(firstError?.message || 'GraphQL error occurred');
      error.graphQLErrors = responseErrors;
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
    const responseBody = error.response?.data;
    const backendErrors = Array.isArray(responseBody?.errors)
      ? responseBody.errors.filter(Boolean)
      : [];

    if (backendErrors.length > 0) {
      if (allowPartialData && responseBody?.data) {
        return responseBody.data;
      }

      const firstError = backendErrors[0];
      const wrappedError = new Error(firstError?.message || 'GraphQL request failed');
      wrappedError.graphQLErrors = backendErrors;
      wrappedError.status = error.response.status;
      if (responseBody?.data) {
        wrappedError.data = responseBody.data;
      }
      throw wrappedError;
    }

    throw error;
  }
};
