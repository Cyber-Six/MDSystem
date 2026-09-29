jest.mock('../wrapper/wrapper.js', () => ({
  Query: {
    _listOpenAppointments: jest.fn(), _listCustomDates: jest.fn(), _listAppointmentSchedule: jest.fn(),
    _listMonthAvailability: jest.fn(), _listAllAppointmentRequirements: jest.fn(),
    _getUserAppointmentRecords: jest.fn(), _getUserAppointmentStatus: jest.fn()
  },
  Mutation: { _submitAppointment: jest.fn(), _cancelAppointment: jest.fn() }
}));
jest.mock('../../../../config/query.js', () => ({ getUserBranch: jest.fn() }));
jest.mock('../wrapper/helper.js', () => ({ getBranchFromShedulerId: jest.fn() }));
jest.mock('../../../../utils/validator.js', () => ({ getStudentBranchFromEmail: jest.fn(), ValidateBranchbyUserBranch: jest.fn() }));
jest.mock('../../../../config/sockets', () => ({ emitToRoom: jest.fn() }));
jest.mock('../../../../utils/logger.js', () => ({ error: jest.fn() }));
jest.mock('dotenv', () => ({ config: jest.fn() }));

const Wrapper = require('../wrapper/wrapper.js');
const db = require('../../../../config/query.js');
const validator = require('../../../../utils/validator.js');
const helper = require('../wrapper/helper.js');
const sockets = require('../../../../config/sockets');
const logger = require('../../../../utils/logger.js');
const { Query, Mutation } = require('./patient-resolver.js');
const context = () => ({ user: { id: 7 }, res: { status: jest.fn().mockReturnThis() } });

beforeEach(() => {
  jest.clearAllMocks();
  db.getUserBranch.mockResolvedValue('Manila');
  helper.getBranchFromShedulerId.mockResolvedValue('Manila');
  validator.ValidateBranchbyUserBranch.mockReturnValue(true);
});

test('query delegates open appointments and branch-scoped schedule details', async () => {
  const ctx = context();
  Wrapper.Query._listOpenAppointments.mockResolvedValueOnce([{ id: 1 }]);
  expect(await Query.listOpenAppointments(null, { offset: 2, limit: 3 }, ctx)).toEqual([{ id: 1 }]);
  const cases = [
    ['listCustomDates', '_listCustomDates', { schedulerId: 4, offset: 1, limit: 2 }],
    ['listAppointmentSchedule', '_listAppointmentSchedule', { schedulerId: 4, date: '2026-10-01' }],
    ['listMonthAvailability', '_listMonthAvailability', { schedulerId: 4, startDate: '2026-10-01', endDate: '2026-10-31' }],
    ['listAppointmentRequirements', '_listAllAppointmentRequirements', { schedulerId: 4, offset: 0, limit: 5 }]
  ];
  for (const [name, target, args] of cases) {
    Wrapper.Query[target].mockResolvedValueOnce([{ name }]);
    expect(await Query[name](null, args, ctx)).toEqual([{ name }]);
    expect(helper.getBranchFromShedulerId).toHaveBeenLastCalledWith(4);
    expect(db.getUserBranch).toHaveBeenLastCalledWith(7);
  }
  expect(Wrapper.Query._listAllAppointmentRequirements.mock.calls[0][1]).toEqual({ schedulerId: 4, offset: 0, limit: 5, isActive: true });
});

test('status returns first appointment record or null for absent records', async () => {
  Wrapper.Query._getUserAppointmentRecords.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]).mockResolvedValueOnce([]).mockResolvedValueOnce(null);
  const ctx = context();
  expect(await Query.getAppointmentStatus(null, {}, ctx)).toEqual({ id: 1 });
  expect(Wrapper.Query._getUserAppointmentRecords.mock.calls[0][1]).toEqual({ userId: 7, offset: 0, limit: 1 });
  expect(await Query.getAppointmentStatus(null, {}, ctx)).toBeNull();
  expect(await Query.getAppointmentStatus(null, {}, ctx)).toBeNull();
});

test('branch mismatch rejects schedule queries before the wrapper is called', async () => {
  validator.ValidateBranchbyUserBranch.mockReturnValue(false);
  const ctx = context();
  await expect(Query.listCustomDates(null, { schedulerId: 3 }, ctx)).rejects.toThrow('Unauthorized');
  expect(ctx.res.status).toHaveBeenCalledWith(401);
  expect(Wrapper.Query._listCustomDates).not.toHaveBeenCalled();
});

test('submission rejects active appointments and emits only for a known location', async () => {
  const ctx = context(); const args = { schedulerId: 2, date: '2026-10-02', session: 'Morning', requirements: [], purpose: 'Checkup' };
  Wrapper.Query._getUserAppointmentStatus.mockResolvedValueOnce('Pending');
  await expect(Mutation.submitAppointment(null, args, ctx)).rejects.toThrow('User already has an active appointment');
  expect(Wrapper.Mutation._submitAppointment).not.toHaveBeenCalled();
  Wrapper.Query._getUserAppointmentStatus.mockResolvedValueOnce(null);
  Wrapper.Mutation._submitAppointment.mockResolvedValueOnce({ id: 10, location: 'Manila' });
  expect(await Mutation.submitAppointment(null, args, ctx)).toEqual({ id: 10, location: 'Manila' });
  expect(sockets.emitToRoom).toHaveBeenCalledWith('branch:Manila:appointments', 'appointment:submitted', expect.objectContaining({ slotId: 10, patientId: 7, schedulerId: 2 }));
  Wrapper.Query._getUserAppointmentStatus.mockResolvedValueOnce('Completed');
  Wrapper.Mutation._submitAppointment.mockResolvedValueOnce({ id: 11 });
  expect(await Mutation.submitAppointment(null, args, ctx)).toEqual({ id: 11 });
  expect(sockets.emitToRoom).toHaveBeenCalledTimes(1);
  Wrapper.Query._getUserAppointmentStatus.mockResolvedValueOnce(null);
  Wrapper.Mutation._submitAppointment.mockResolvedValueOnce({ id: 12, location: 'Manila' });
  sockets.emitToRoom.mockImplementationOnce(() => { throw Error('socket unavailable'); });
  expect(await Mutation.submitAppointment(null, args, ctx)).toEqual({ id: 12, location: 'Manila' });
  expect(logger.error).toHaveBeenCalledWith('Failed to emit appointment submission notification:', expect.any(Error));
});

test('cancellation requires an active record and returns the wrapper success flag', async () => {
  const ctx = context();
  for (const records of [null, [], [{ id: 1, status: 'Completed' }]]) {
    Wrapper.Query._getUserAppointmentRecords.mockResolvedValueOnce(records);
    await expect(Mutation.cancelAppointment(null, {}, ctx)).rejects.toThrow('No active appointment found to cancel');
  }
  Wrapper.Query._getUserAppointmentRecords.mockResolvedValueOnce([{ id: 9, status: 'Scheduled' }]);
  Wrapper.Mutation._cancelAppointment.mockResolvedValueOnce({ success: true });
  expect(await Mutation.cancelAppointment(null, {}, ctx)).toBe(true);
  expect(Wrapper.Mutation._cancelAppointment.mock.calls[0][1]).toEqual({ patientId: 7, cancelledBy: 7, slotId: 9 });
});
