import { axiosRequest } from '../../packages-core-adapter';
import { sendGraphQLRequest } from '../../utils/graphql-client';
import {
  ACTIVE_STATUSES,
  SESSION,
  STATUS,
  cancelAppointment,
  getAppointmentStatus,
  getMonthAvailability,
  getScheduleAvailability,
  listCustomDates,
  listOpenAppointments,
  listRequirements,
  stageFile,
  submitAppointment,
  unstageFile,
} from './patient-appointment-service';

jest.mock('../../utils/graphql-client', () => ({ sendGraphQLRequest: jest.fn() }));
jest.mock('../../packages-core-adapter', () => ({
  axiosRequest: { post: jest.fn(), delete: jest.fn() },
}));

describe('patient appointment service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('exports the scheduling constants used by appointment UI', () => {
    expect(STATUS.PENDING).toBe('Pending');
    expect(SESSION).toEqual({ MORNING: 'Morning', AFTERNOON: 'Afternoon' });
    expect(ACTIVE_STATUSES).toEqual([STATUS.PENDING, STATUS.SCHEDULED, STATUS.IN_PROGRESS]);
  });

  it.each([
    ['getAppointmentStatus', getAppointmentStatus, [], 'getAppointmentStatus'],
    ['listOpenAppointments', listOpenAppointments, [5, 10], 'listOpenAppointments'],
    ['listRequirements', listRequirements, ['scheduler-1', 2, 25], 'listAppointmentRequirements'],
    ['listCustomDates', listCustomDates, ['scheduler-1', 2, 25], 'listCustomDates'],
    ['getScheduleAvailability', getScheduleAvailability, ['scheduler-1', '2026-09-26'], 'listAppointmentSchedule'],
    ['getMonthAvailability', getMonthAvailability, ['scheduler-1', '2026-09-01', '2026-09-30'], 'listMonthAvailability'],
  ])('%s returns its GraphQL payload through the patient endpoint', async (_name, request, args, field) => {
    sendGraphQLRequest.mockResolvedValue({ [field]: { value: field } });

    await expect(request(...args)).resolves.toEqual({ value: field });
    expect(sendGraphQLRequest).toHaveBeenCalledWith(
      expect.stringContaining(field),
      expect.any(Object),
      { endpoint: '/appointment/patient' },
    );
  });

  it('uses default pagination values for open appointment queries', async () => {
    sendGraphQLRequest.mockResolvedValue({ listOpenAppointments: [] });

    await expect(listOpenAppointments()).resolves.toEqual([]);
    expect(sendGraphQLRequest.mock.calls[0][1]).toEqual({ offset: 0, limit: 20 });
  });

  it.each([undefined, '', '   '])('rejects an empty appointment purpose (%p)', async (purpose) => {
    await expect(submitAppointment('slot-1', '2026-09-26', SESSION.MORNING, [], purpose))
      .rejects.toThrow('Purpose / reason for visit is required.');
    expect(sendGraphQLRequest).not.toHaveBeenCalled();
  });

  it('submits a normalized purpose and supplied requirements', async () => {
    const appointment = { id: 'appointment-1' };
    const requirements = [{ scheduleRequirementId: 'req-1', filename: 'note.pdf' }];
    sendGraphQLRequest.mockResolvedValue({ submitAppointment: appointment });

    await expect(submitAppointment('slot-1', '2026-09-26', SESSION.AFTERNOON, requirements, '  Consultation  '))
      .resolves.toBe(appointment);
    expect(sendGraphQLRequest.mock.calls[0][1]).toEqual({
      schedulerId: 'slot-1', date: '2026-09-26', session: SESSION.AFTERNOON,
      requirements, purpose: 'Consultation',
    });
  });

  it('cancels the active appointment', async () => {
    sendGraphQLRequest.mockResolvedValue({ cancelAppointment: true });
    await expect(cancelAppointment()).resolves.toBe(true);
    expect(sendGraphQLRequest).toHaveBeenCalledWith(
      expect.stringContaining('cancelAppointment'), {}, { endpoint: '/appointment/patient' },
    );
  });

  it('stages a browser file and returns its staging id', async () => {
    const file = new File(['content'], 'proof.pdf', { type: 'application/pdf' });
    axiosRequest.post.mockResolvedValue({ data: { fileId: 'file-1' } });

    await expect(stageFile(file)).resolves.toBe('file-1');
    expect(axiosRequest.post).toHaveBeenCalledWith('/media/stage/', expect.any(FormData), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  });

  it('only unstages a supplied file id', async () => {
    await expect(unstageFile()).resolves.toBeUndefined();
    expect(axiosRequest.delete).not.toHaveBeenCalled();

    await unstageFile('file-1');
    expect(axiosRequest.delete).toHaveBeenCalledWith('/media/unstage/file-1');
  });
});
