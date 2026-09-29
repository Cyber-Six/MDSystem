jest.mock('../../utils/graphql-client', () => ({ sendGraphQLRequest: jest.fn() }));

import { sendGraphQLRequest } from '../../utils/graphql-client';
import { fetchPatientDashboardData } from './dashboard-service';

describe('fetchPatientDashboardData', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns the dashboard payload using the dashboard endpoint', async () => {
    const dashboard = { appointment: { id: 'a-1' }, medicineReqs: [], updateTicket: null, chatData: { chats: [], total: 0 } };
    sendGraphQLRequest.mockResolvedValue({ getPatientDashboardData: dashboard });

    await expect(fetchPatientDashboardData()).resolves.toBe(dashboard);
    expect(sendGraphQLRequest).toHaveBeenCalledWith(
      expect.stringContaining('query GetPatientDashboardData'), {}, { endpoint: '/dashboard/patient' },
    );
  });

  test('returns a stable empty dashboard when the API has no payload', async () => {
    sendGraphQLRequest.mockResolvedValue(null);
    await expect(fetchPatientDashboardData()).resolves.toEqual({
      appointment: null, medicineReqs: [], updateTicket: null, chatData: { chats: [], total: 0 },
    });
  });
});
