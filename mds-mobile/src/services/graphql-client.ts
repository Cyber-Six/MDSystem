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

    if (response.data.errors) {
      const firstError = response.data.errors[0];
      const error: any = new Error(firstError?.message || 'GraphQL error occurred');
      error.graphQLErrors = response.data.errors;
      if (response.data.data) {
        error.data = response.data.data;
      }
      throw error;
    }

    return response.data.data;
  } catch (error: any) {
    if (error.graphQLErrors) throw error;

    if (error.response?.data?.errors) {
      const firstError = error.response.data.errors[0];
      const wrappedError: any = new Error(firstError?.message || 'GraphQL request failed');
      wrappedError.graphQLErrors = error.response.data.errors;
      wrappedError.status = error.response.status;
      throw wrappedError;
    }

    throw error;
  }
};
