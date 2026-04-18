/**
 * Shared GraphQL Client for React Native
 * Mirrors mds-patient/src/utils/graphql-client.js
 */

import { axiosRequest } from '../core';

export const sendGraphQLRequest = async (
  query: string,
  variables: Record<string, any> = {},
  options: { endpoint?: string; allowPartialData?: boolean } = {}
) => {
  const endpoint = options.endpoint || '/emr/patient';
  const allowPartialData = options.allowPartialData === true;

  try {
    const response = await axiosRequest.post(endpoint, { query, variables });

    const responseErrors = Array.isArray(response.data?.errors)
      ? response.data.errors.filter(Boolean)
      : [];

    if (responseErrors.length > 0) {
      if (allowPartialData && response.data?.data) {
        return response.data.data;
      }

      const firstError = responseErrors[0];
      const error: any = new Error(firstError?.message || 'GraphQL error occurred');
      error.graphQLErrors = responseErrors;
      if (response.data.data) {
        error.data = response.data.data;
      }
      throw error;
    }

    return response.data.data;
  } catch (error: any) {
    if (error.graphQLErrors) throw error;

    const responseBody = error.response?.data;
    const backendErrors = Array.isArray(responseBody?.errors)
      ? responseBody.errors.filter(Boolean)
      : [];

    if (backendErrors.length > 0) {
      if (allowPartialData && responseBody?.data) {
        return responseBody.data;
      }

      const firstError = backendErrors[0];
      const wrappedError: any = new Error(firstError?.message || 'GraphQL request failed');
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
