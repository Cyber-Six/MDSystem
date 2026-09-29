jest.mock('../packages-core-adapter', () => ({
  axiosRequest: { post: jest.fn() },
}));

import { axiosRequest } from '../packages-core-adapter';
import { sendGraphQLRequest } from './graphql-client';

describe('sendGraphQLRequest', () => {
  beforeEach(() => jest.clearAllMocks());

  test('posts the query and returns GraphQL data', async () => {
    axiosRequest.post.mockResolvedValue({ data: { data: { patient: { id: 'p-1' } } } });

    await expect(sendGraphQLRequest('query Patient', { id: 'p-1' })).resolves.toEqual({ patient: { id: 'p-1' } });
    expect(axiosRequest.post).toHaveBeenCalledWith('/emr/patient', {
      query: 'query Patient', variables: { id: 'p-1' },
    });
  });

  test('uses a caller-provided endpoint and accepts partial data when requested', async () => {
    axiosRequest.post.mockResolvedValue({ data: { data: { saved: true }, errors: [null, { message: 'warning' }] } });

    await expect(sendGraphQLRequest('mutation Save', {}, {
      endpoint: '/custom', allowPartialData: true,
    })).resolves.toEqual({ saved: true });
    expect(axiosRequest.post).toHaveBeenCalledWith('/custom', expect.any(Object));
  });

  test('preserves formatted GraphQL errors and partial data', async () => {
    axiosRequest.post.mockResolvedValue({
      data: { data: { partial: true }, errors: [{ message: 'Not allowed' }] },
    });

    await expect(sendGraphQLRequest('query')).rejects.toMatchObject({
      message: 'Not allowed', graphQLErrors: [{ message: 'Not allowed' }], data: { partial: true },
    });
  });

  test('normalizes GraphQL-shaped transport failures and rethrows other failures', async () => {
    const graphQLError = { response: { status: 422, data: { data: { partial: true }, errors: [{ message: 'Invalid field' }] } } };
    axiosRequest.post.mockRejectedValueOnce(graphQLError);
    await expect(sendGraphQLRequest('query')).rejects.toMatchObject({
      message: 'Invalid field', status: 422, data: { partial: true },
    });

    const networkError = new Error('offline');
    axiosRequest.post.mockRejectedValueOnce(networkError);
    await expect(sendGraphQLRequest('query')).rejects.toBe(networkError);
  });
});
