/**
 * Shared GraphQL Client for React Native
 * Mirrors mds-patient/src/utils/graphql-client.js
 */

import { axiosRequest } from '../core';

export const sendGraphQLRequest = async (
  query: string,
  variables: Record<string, any> = {},
  options: { endpoint?: string } = {}
) => {
  const endpoint = options.endpoint || '/emr/patient';

  try {
    const response = await axiosRequest.post(endpoint, { query, variables });

    const responseErrors = Array.isArray(response.data?.errors)
      ? response.data.errors.filter(Boolean)
      : [];

    if (responseErrors.length > 0) {
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

    const backendErrors = Array.isArray(error.response?.data?.errors)
      ? error.response.data.errors.filter(Boolean)
      : [];

    if (backendErrors.length > 0) {
      const firstError = backendErrors[0];
      const wrappedError: any = new Error(firstError?.message || 'GraphQL request failed');
      wrappedError.graphQLErrors = backendErrors;
      wrappedError.status = error.response.status;
      throw wrappedError;
    }

    throw error;
  }
};
