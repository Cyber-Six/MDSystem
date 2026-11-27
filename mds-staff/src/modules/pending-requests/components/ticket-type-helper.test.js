import { axiosRequest } from '../../../packages-core-adapter';
import { enrichWithInitialFlag } from './ticket-type-helper';
jest.mock('../../../packages-core-adapter', () => ({ axiosRequest: { post: jest.fn() } }));
test('approved clinical update remains an update when personal-log count is one', async () => {
  axiosRequest.post.mockImplementation(async (endpoint, body) => {
    if (body.query.includes('getUserCredentialStatus')) return { data: { data: { u_7001: 'Active' } } };
    if (body.query.includes('getUserPersonalRecordLog')) return { data: { data: { u_7001: [{ id: '1', status: 'Approved' }] } } };
    return { data: { data: { getUserTicketIds: [{ id: '9001' }, { id: '8001' }] } } };
  });
  const result = await enrichWithInitialFlag([{ id: '9001', patientId: '7001', scope: 'Both', status: 'Approved' }, { id: '8001', patientId: '7001', scope: 'Both', status: 'Approved' }]);
  expect(result.map(row => row.is_initial)).toEqual([false, true]);
});
