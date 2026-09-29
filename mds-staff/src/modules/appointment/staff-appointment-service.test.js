import { axiosRequest } from '../../packages-core-adapter';
import * as service from './staff-appointment-service';

jest.mock('../../packages-core-adapter', () => ({ axiosRequest: { get: jest.fn(), post: jest.fn() } }));

describe('staff appointment service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    URL.createObjectURL = jest.fn(() => 'blob:file');
  });

  it('exports appointment constants used by staff UI filters', () => {
    expect(service.ALL_STATUSES).toContain(service.STATUS.PENDING);
    expect(service.ALL_LOCATIONS).toEqual(expect.arrayContaining([service.LOCATION.ARLEGUI, service.LOCATION.QC]));
    expect(service.SESSION).toEqual({ MORNING: 'Morning', AFTERNOON: 'Afternoon' });
  });

  it('fetches staged requirement files as browser object URLs', async () => {
    const blob = new Blob(['file']);
    axiosRequest.get.mockResolvedValue({ data: blob, headers: { 'content-type': 'application/pdf' } });
    await expect(service.fetchRequirementFile('uuid')).resolves.toEqual({ blobUrl: 'blob:file', contentType: 'application/pdf' });
    expect(axiosRequest.get).toHaveBeenCalledWith('/media/record/appointmentRequirement/uuid', { responseType: 'blob' });
  });

  it.each([
    ['searchByStatus', 'searchAppointmentStatuses', [service.STATUS.PENDING, 1, 2, { date: '2026-01-01', schedulerId: 's', location: 'Manila', searchTerm: 'Ana' }]],
    ['getPatientStatus', 'getUserAppointmentStatus', ['u1', '  P-1  ']],
    ['getPatientRecords', 'getUserAppointmentRecords', ['u1', 1, 2, ' P-1 ']],
    ['listAllSchedulers', 'listAllOpenAppointments', [1, 2]],
    ['listAllRequirements', 'listAllAppointmentRequirements', ['s', 1, 2]],
    ['getScheduleAvailability', 'listAppointmentSchedule', ['s', '2026-01-01']],
    ['getMonthAvailability', 'listMonthAvailability', ['s', '2026-01-01', '2026-01-31']],
    ['listCustomDates', 'listCustomDates', ['s', 1, 2]],
    ['respondToAppointment', 'respondAppointment', ['u1', service.STATUS.SCHEDULED, 'ok', 'slot-1', ' P-1 ']],
    ['recordAttendance', 'recordAppointmentAttendance', ['slot-1', '2026-01-01']],
    ['createScheduler', 'createScheduler', [{ label: 'Clinic' }]],
    ['updateScheduler', 'updateScheduler', ['s', { label: 'New' }]],
    ['deleteScheduler', 'deleteScheduler', ['s']],
    ['updateRequirement', 'updateSchedulerRequirement', ['s', { label: 'ID' }]],
    ['deleteRequirement', 'deleteSchedulerRequirement', ['s', 'ID']],
    ['setCustomDates', 'setCustomDates', ['s', [{ scheduledDate: '2026-01-01' }]]],
    ['unsetCustomDates', 'unsetCustomDates', ['s', ['2026-01-01']]],
    ['addWhitelist', 'addEntryWhitelist', ['s', ['p1']]],
    ['removeWhitelist', 'removeEntryWhitelist', ['s', ['p1']]],
    ['listWhitelist', 'listSchedulerWhitelist', ['s', 1, 2]],
    ['updateDateIdentity', 'updateDateIdentity', ['s', '2026-01-01', { morningAllowed: 3 }]],
    ['checkDateOccupancy', 'checkDateOccupancy', ['s', '2026-01-01']],
    ['cancelDateAppointments', 'cancelDateAppointments', ['s', '2026-01-01', 'Holiday']],
  ])('%s returns its GraphQL field', async (method, field, args) => {
    const value = { field };
    axiosRequest.post.mockResolvedValue({ data: { data: { [field]: value } } });
    await expect(service[method](...args)).resolves.toBe(value);
    expect(axiosRequest.post).toHaveBeenCalledWith('/appointment/medical', expect.objectContaining({
      query: expect.stringContaining(field), variables: expect.any(Object),
    }));
  });

  it('maps status counts and initial queue data', async () => {
    axiosRequest.post
      .mockResolvedValueOnce({ data: { data: { getAppointmentStatusCounts: [{ status: 'Pending', count: 3 }] } } })
      .mockResolvedValueOnce({ data: { data: { appointments: [{ id: 'a1' }], counts: [{ status: 'Scheduled', count: 2 }] } } });
    await expect(service.getStatusCounts({ location: 'Manila' })).resolves.toEqual({ Pending: 3 });
    await expect(service.loadInitialQueueData(service.STATUS.PENDING)).resolves.toEqual({
      appointments: [{ id: 'a1' }], counts: { Scheduled: 2 },
    });
  });

  it('returns normalized patient snapshot defaults and GraphQL errors', async () => {
    axiosRequest.post.mockResolvedValueOnce({ data: { data: { status: null, records: null } } });
    await expect(service.getPatientAppointmentSnapshot(null, '  ', 3, 4)).resolves.toEqual({ status: null, records: [] });
    expect(axiosRequest.post.mock.calls[0][1].variables).toEqual({ userId: null, patientIdentifier: null, offset: 3, limit: 4 });

    axiosRequest.post.mockResolvedValueOnce({ data: { errors: [{ message: 'Denied' }] } });
    await expect(service.listAllSchedulers()).rejects.toThrow('Denied');
  });
});
