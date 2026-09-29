jest.mock('../../packages-core-adapter', () => ({
  axiosRequest: { get: jest.fn() },
}));

import { axiosRequest } from '../../packages-core-adapter';
import { fetchActiveAnnouncements, fetchAnnouncementById } from './announcement-service';

describe('patient announcement service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('returns active announcements or an empty list', async () => {
    axiosRequest.get.mockResolvedValueOnce({ data: { data: [{ id: 1 }] } });
    await expect(fetchActiveAnnouncements()).resolves.toEqual([{ id: 1 }]);
    expect(axiosRequest.get).toHaveBeenCalledWith('/announcement');

    axiosRequest.get.mockResolvedValueOnce({ data: {} });
    await expect(fetchActiveAnnouncements()).resolves.toEqual([]);
  });

  test('loads an announcement by ID and rethrows failures', async () => {
    axiosRequest.get.mockResolvedValueOnce({ data: { data: { id: 'a-1' } } });
    await expect(fetchAnnouncementById('a-1')).resolves.toEqual({ id: 'a-1' });
    expect(axiosRequest.get).toHaveBeenLastCalledWith('/announcement/a-1');

    const error = new Error('offline');
    axiosRequest.get.mockRejectedValueOnce(error);
    await expect(fetchActiveAnnouncements()).rejects.toBe(error);
    expect(console.error).toHaveBeenCalledWith('Failed to fetch announcements:', error);
  });
});
