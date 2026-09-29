import { axiosRequest } from '../../packages-core-adapter';
import { fetchAllStaff, notifyPatients, notifyStaffs } from './notification-service';

jest.mock('../../packages-core-adapter', () => ({ axiosRequest: { post: jest.fn() } }));

describe('staff notification service', () => {
  beforeEach(() => jest.resetAllMocks());

  it('fetches staff recipients and returns an empty list when absent', async () => {
    axiosRequest.post.mockResolvedValueOnce({ data: { data: { listStaffAccounts: { staff: [{ id: 's1' }] } } } });
    await expect(fetchAllStaff()).resolves.toEqual([{ id: 's1' }]);
    expect(axiosRequest.post).toHaveBeenCalledWith('/rolemanagement/admin', {
      query: expect.stringContaining('ListStaffAccounts'),
    });

    axiosRequest.post.mockResolvedValueOnce({ data: { data: { listStaffAccounts: {} } } });
    await expect(fetchAllStaff()).resolves.toEqual([]);
  });

  it('surfaces GraphQL recipient-list errors', async () => {
    axiosRequest.post.mockResolvedValue({ data: { errors: [{ message: 'Admin only' }] } });
    await expect(fetchAllStaff()).rejects.toThrow('Admin only');
  });

  it.each([
    ['staff', notifyStaffs, '/staff/notify-staffs'],
    ['patients', notifyPatients, '/staff/notify-patients'],
  ])('notifies %s with optional recipient targeting', async (_name, notify, endpoint) => {
    const response = { notificationId: 'n1', totalRecipients: 2 };
    axiosRequest.post.mockResolvedValue({ data: response });
    await expect(notify('Reminder', ['1', '2'])).resolves.toBe(response);
    expect(axiosRequest.post).toHaveBeenCalledWith(endpoint, { message: 'Reminder', recipientIds: ['1', '2'] });

    await notify('Broadcast');
    expect(axiosRequest.post).toHaveBeenLastCalledWith(endpoint, { message: 'Broadcast' });
  });
});
