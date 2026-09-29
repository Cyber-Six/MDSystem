import { axiosRequest } from '../../packages-core-adapter';
import {
  ALL_BRANCHES,
  BRANCH,
  TICKET_STATUS,
  approveInitialRecord,
  getStatusUpdateTickets,
  getUserUpdateTicket,
  setPersonalRecordLog,
  staffUpdateTicket,
} from './initial-record-service';

jest.mock('../../packages-core-adapter', () => ({ axiosRequest: { post: jest.fn() } }));

describe('initial record service', () => {
  beforeEach(() => jest.resetAllMocks());

  it('exports branch and ticket-status constants', () => {
    expect(ALL_BRANCHES).toEqual(Object.values(BRANCH));
    expect(TICKET_STATUS.APPROVED).toBe('Approved');
  });

  it('caches ticket lists independent of status ordering and supports force refresh', async () => {
    axiosRequest.post.mockResolvedValue({ data: { data: { getStatusUpdateTickets: [{ id: 't1' }] } } });
    await expect(getStatusUpdateTickets(['Pending', 'Revision'], BRANCH.MANILA)).resolves.toEqual([{ id: 't1' }]);
    await expect(getStatusUpdateTickets(['Revision', 'Pending'], BRANCH.MANILA)).resolves.toEqual([{ id: 't1' }]);
    expect(axiosRequest.post).toHaveBeenCalledTimes(1);
    await getStatusUpdateTickets(['Pending', 'Revision'], BRANCH.MANILA, 0, 20, { force: true });
    expect(axiosRequest.post).toHaveBeenCalledTimes(2);
  });

  it('returns individual tickets and uses null default', async () => {
    axiosRequest.post.mockResolvedValueOnce({ data: { data: { getUserUpdateTicket: { id: 't1' } } } });
    await expect(getUserUpdateTicket('p1')).resolves.toEqual({ id: 't1' });
    axiosRequest.post.mockResolvedValueOnce({ data: { data: {} } });
    await expect(getUserUpdateTicket('p1')).resolves.toBeNull();
  });

  it('updates tickets and personal logs at their corresponding endpoints', async () => {
    axiosRequest.post
      .mockResolvedValueOnce({ data: { data: { staffUpdateTicket: 'Revision' } } })
      .mockResolvedValueOnce({ data: { data: { setPersonalRecordLog: 'Approved' } } });
    await expect(staffUpdateTicket('p1', 'Revision')).resolves.toBe('Revision');
    await expect(setPersonalRecordLog('p1', 'Approved')).resolves.toBe('Approved');
    expect(axiosRequest.post.mock.calls[0][0]).toBe('/emr/medical');
    expect(axiosRequest.post.mock.calls[0][1].variables).toEqual({ userId: 'p1', status: 'Revision', notes: null });
    expect(axiosRequest.post.mock.calls[1][0]).toBe('/profile/medical');
  });

  it('approves the personal log before the ticket and stops on the first failure', async () => {
    axiosRequest.post
      .mockResolvedValueOnce({ data: { data: { setPersonalRecordLog: 'Approved' } } })
      .mockResolvedValueOnce({ data: { data: { staffUpdateTicket: 'Approved' } } });
    await expect(approveInitialRecord('p1')).resolves.toBe('Approved');
    expect(axiosRequest.post.mock.calls.map(([url]) => url)).toEqual(['/profile/medical', '/emr/medical']);

    axiosRequest.post.mockReset().mockResolvedValue({ data: { errors: [{ message: 'Profile failed' }] } });
    await expect(approveInitialRecord('p2')).rejects.toThrow('Profile failed');
    expect(axiosRequest.post).toHaveBeenCalledTimes(1);
  });
});
