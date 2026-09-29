import { axiosRequest } from '../../packages-core-adapter';
import { fetchDashboardStats } from './dashboard-service';

jest.mock('../../packages-core-adapter', () => ({ axiosRequest: { post: jest.fn() } }));

describe('staff dashboard service', () => {
  beforeEach(() => jest.resetAllMocks());
  afterEach(() => jest.restoreAllMocks());

  it('posts the consolidated dashboard query and caches the response', async () => {
    const stats = { pendingRequests: 2 };
    axiosRequest.post.mockResolvedValue({ data: { data: { getDashboardStats: stats } } });
    await expect(fetchDashboardStats({ force: true })).resolves.toBe(stats);
    await expect(fetchDashboardStats()).resolves.toBe(stats);
    expect(axiosRequest.post).toHaveBeenCalledTimes(1);
    expect(axiosRequest.post).toHaveBeenCalledWith('/dashboard', {
      query: expect.stringContaining('GetDashboardStats'),
    });
  });

  it('coalesces simultaneous non-forced requests', async () => {
    const future = Date.now() + 6_000;
    jest.spyOn(Date, 'now').mockReturnValue(future);
    let resolve;
    axiosRequest.post.mockReturnValue(new Promise((done) => { resolve = done; }));
    const one = fetchDashboardStats({ force: true });
    const two = fetchDashboardStats();
    expect(axiosRequest.post).toHaveBeenCalledTimes(1);
    resolve({ data: { data: { getDashboardStats: { todayAppointments: 1 } } } });
    await expect(Promise.all([one, two])).resolves.toEqual([{ todayAppointments: 1 }, { todayAppointments: 1 }]);
  });

  it('adds context to GraphQL and request failures', async () => {
    axiosRequest.post.mockResolvedValue({ data: { errors: [{ message: 'Denied' }] } });
    await expect(fetchDashboardStats({ force: true })).rejects.toThrow('Failed to fetch dashboard stats: Denied');

    axiosRequest.post.mockRejectedValue(new Error('Offline'));
    await expect(fetchDashboardStats({ force: true })).rejects.toThrow('Failed to fetch dashboard stats: Offline');
  });
});
