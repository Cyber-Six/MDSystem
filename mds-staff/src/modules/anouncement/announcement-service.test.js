import { axiosRequest } from '../../packages-core-adapter';
import {
  clearActiveAnnouncementsCache,
  createAnnouncement,
  deleteAnnouncement,
  fetchActiveAnnouncements,
  fetchAllAnnouncementsAdmin,
  fetchAnnouncementById,
  updateAnnouncement,
  uploadPubmat,
} from './announcement-service';

jest.mock('../../packages-core-adapter', () => ({
  axiosRequest: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

describe('staff announcement service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    clearActiveAnnouncementsCache();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => console.error.mockRestore());

  it('caches active announcements until explicitly forced', async () => {
    axiosRequest.get.mockResolvedValue({ data: { data: [{ id: 1 }] } });
    await expect(fetchActiveAnnouncements()).resolves.toEqual([{ id: 1 }]);
    await expect(fetchActiveAnnouncements()).resolves.toEqual([{ id: 1 }]);
    expect(axiosRequest.get).toHaveBeenCalledTimes(1);

    await fetchActiveAnnouncements({ force: true });
    expect(axiosRequest.get).toHaveBeenCalledTimes(2);
  });

  it('shares an in-flight active-announcement request', async () => {
    let resolve;
    axiosRequest.get.mockReturnValue(new Promise((done) => { resolve = done; }));
    const first = fetchActiveAnnouncements();
    const second = fetchActiveAnnouncements();
    expect(axiosRequest.get).toHaveBeenCalledTimes(1);
    resolve({ data: { data: [] } });
    await expect(Promise.all([first, second])).resolves.toEqual([[], []]);
  });

  it('returns and propagates single-announcement reads', async () => {
    const announcement = { id: 5 };
    axiosRequest.get.mockResolvedValue({ data: { data: announcement } });
    await expect(fetchAnnouncementById(5)).resolves.toBe(announcement);
    expect(axiosRequest.get).toHaveBeenCalledWith('/announcement/5');

    const error = new Error('offline');
    axiosRequest.get.mockRejectedValue(error);
    await expect(fetchAnnouncementById(6)).rejects.toBe(error);
  });

  it.each([
    ['creates', createAnnouncement, [ { label: 'Notice' } ], 'post', '/announcement'],
    ['updates', updateAnnouncement, [5, { label: 'Edited' }], 'put', '/announcement/5'],
  ])('%s an announcement and clears active cache', async (_label, action, args, method, url) => {
    axiosRequest[method].mockResolvedValue({ data: { data: { id: 5 } } });
    axiosRequest.get.mockResolvedValue({ data: { data: [] } });
    await fetchActiveAnnouncements({ force: true });
    await expect(action(...args)).resolves.toEqual({ id: 5 });
    await fetchActiveAnnouncements();
    expect(axiosRequest.get).toHaveBeenCalledTimes(2);
    expect(axiosRequest[method]).toHaveBeenCalledWith(url, args.at(-1));
  });

  it('deletes an announcement and clears active cache', async () => {
    axiosRequest.delete.mockResolvedValue({ data: { deleted: true } });
    await expect(deleteAnnouncement(5)).resolves.toEqual({ deleted: true });
    expect(axiosRequest.delete).toHaveBeenCalledWith('/announcement/5');
  });

  it('reads admin announcements with optional location filters', async () => {
    axiosRequest.get.mockResolvedValue({ data: { data: [{ id: 1 }], branch: 'Manila' } });
    await expect(fetchAllAnnouncementsAdmin('Manila')).resolves.toEqual({ data: [{ id: 1 }], branch: 'Manila' });
    expect(axiosRequest.get).toHaveBeenCalledWith('/announcement/admin/all', { params: { location: 'Manila' } });
  });

  it('uses empty admin data and the default branch when omitted by the API', async () => {
    axiosRequest.get.mockResolvedValue({ data: {} });
    await expect(fetchAllAnnouncementsAdmin()).resolves.toEqual({ data: [], branch: 'Both' });
    expect(axiosRequest.get).toHaveBeenCalledWith('/announcement/admin/all', { params: {} });
  });

  it('uploads public material as multipart form data', async () => {
    const file = new File(['image'], 'notice.png', { type: 'image/png' });
    axiosRequest.post.mockResolvedValue({ data: { fileId: 'file-5' } });
    await expect(uploadPubmat(file)).resolves.toBe('file-5');
    expect(axiosRequest.post).toHaveBeenCalledWith('/media/stage/', expect.any(FormData), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  });
});
