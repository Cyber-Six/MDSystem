import { axiosRequest } from '../../packages-core-adapter';
import { fetchAllStaff, notifyPatients, notifyStaffs, fetchPatientNotificationGroups, sendPatientGroupNotification } from './notification-service';

jest.mock('../../packages-core-adapter', () => ({ axiosRequest: { get: jest.fn(), post: jest.fn() } }));

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

  it('loads authorized groups and submits a group with the reviewed count', async () => {
    const group = { profile: 'Student', branch: 'Manila', count: 3 };
    const options = { branches: ['Manila'], groups: [group] };
    axiosRequest.get.mockResolvedValueOnce({ data: options });
    await expect(fetchPatientNotificationGroups()).resolves.toEqual(options);
    expect(axiosRequest.get).toHaveBeenCalledWith('/staff/notify-patient-groups');
    axiosRequest.post.mockResolvedValueOnce({ data: { totalRecipients: 3 } });
    await expect(sendPatientGroupNotification('Reminder', group)).resolves.toEqual({ totalRecipients: 3 });
    expect(axiosRequest.post).toHaveBeenCalledWith('/staff/notify-patient-groups', {
      message: 'Reminder', profile: 'Student', branch: 'Manila', expectedCount: 3,
    });
  });

  it.each(['<html>Staff portal</html>', {}, { branches: ['Manila'] }, null])(
    'rejects an unexpected patient group response', async (data) => {
      axiosRequest.get.mockResolvedValueOnce({ data });
      await expect(fetchPatientNotificationGroups()).rejects.toThrow('unexpected response');
    },
  );
});
