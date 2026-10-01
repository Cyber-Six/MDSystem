const mockQueryDelegates = {};
const mockMutationDelegates = {};
const proxy = delegates => new Proxy({}, { get(_target, name) { return delegates[name] ||= jest.fn(); } });
jest.mock('../wrapper/wrapper.js', () => ({ Query: proxy(mockQueryDelegates), Mutation: proxy(mockMutationDelegates) }));
jest.mock('../../../../services/authorization/permit.js', () => ({ permissions: { appointment_allow_view_records: 'VIEW_RECORDS', appointment_allow_view_configuration: 'VIEW_CONFIG', appointment_allow_approval: 'APPROVE', appointment_allow_edit_configuration: 'EDIT_CONFIG' }, isMedicalPermitted: jest.fn(), isMedicalPermittedPatientBased: jest.fn(), isMedicalPermittedBranchBased: jest.fn(), getStaffBranch: jest.fn() }));
jest.mock('../../../../config/sockets/socket-emitter', () => ({ notifyUser: jest.fn() }));
jest.mock('../wrapper/helper.js', () => ({ getBranchFromShedulerId: jest.fn(), getPatientIdFromSlotId: jest.fn(), getUserIDViaIdentifier: jest.fn() }));
jest.mock('../../../../config/query.js', () => ({ findEmailByUserId: jest.fn() }));
jest.mock('dotenv', () => ({ config: jest.fn() }));

const Wrapper = require('../wrapper/wrapper.js'); const permit = require('../../../../services/authorization/permit.js'); const helper = require('../wrapper/helper.js');
const db = require('../../../../config/query.js'); const sockets = require('../../../../config/sockets/socket-emitter');
const { Query, Mutation } = require('./medical-resolver.js');
const ctx = () => ({ user: { id: 5 }, res: { status: jest.fn().mockReturnThis() } });
const args = { userId: '9', patientIdentifier: ' A ', location: 'Arlegui', offset: 1, limit: 2, schedulerId: 3, date: '2026-10-01', startDate: '2026-10-01', endDate: '2026-10-31', status: 'Pending', searchTerm: 'A', slotId: 4, notes: 'note', arrived_at: 'today', input: { location: 'Arlegui' }, label: 'L', dates: [], patientIds: [9], reason: 'closed' };
beforeEach(() => { jest.clearAllMocks(); permit.isMedicalPermitted.mockResolvedValue({ permitted: true }); permit.isMedicalPermittedPatientBased.mockResolvedValue(true); permit.isMedicalPermittedBranchBased.mockResolvedValue(true); permit.getStaffBranch.mockResolvedValue('Manila'); helper.getBranchFromShedulerId.mockResolvedValue('Arlegui'); helper.getPatientIdFromSlotId.mockResolvedValue(9); helper.getUserIDViaIdentifier.mockResolvedValue([{ userId: 9 }]); db.findEmailByUserId.mockResolvedValue('p@example.com'); });

test('patient lookup accepts explicit ID or a single in-branch identifier, and rejects ambiguous input', async () => {
  Wrapper.Query._getUserAppointmentStatus.mockResolvedValue('Pending'); const context = ctx();
  expect(await Query.getUserAppointmentStatus(null, { userId: 9 }, context)).toBe('Pending');
  expect(Wrapper.Query._getUserAppointmentStatus.mock.calls[0][1]).toEqual({ userId: '9' });
  expect(await Query.getUserAppointmentStatus(null, { patientIdentifier: ' A ' }, context)).toBe('Pending');
  expect(helper.getUserIDViaIdentifier).toHaveBeenCalledWith('A', 'Manila');
  await expect(Query.getUserAppointmentStatus(null, {}, context)).rejects.toThrow('Either userId or patientIdentifier is required');
  helper.getUserIDViaIdentifier.mockResolvedValueOnce(null);
  await expect(Query.getUserAppointmentStatus(null, { patientIdentifier: 'B' }, context)).rejects.toThrow('No user found');
  helper.getUserIDViaIdentifier.mockResolvedValueOnce([]);
  await expect(Query.getUserAppointmentStatus(null, { patientIdentifier: 'B' }, context)).rejects.toThrow('No user found');
  helper.getUserIDViaIdentifier.mockResolvedValueOnce([{ userId: 1 }, { userId: 2 }]);
  await expect(Query.getUserAppointmentStatus(null, { patientIdentifier: 'B' }, context)).rejects.toThrow('Multiple users matched');
  permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(false);
  await expect(Query.getUserAppointmentStatus(null, { userId: 9 }, context)).rejects.toThrow('Unauthorized');
  permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(false);
  await expect(Query.getUserAppointmentRecords(null, { userId: 9 }, context)).rejects.toThrow('Unauthorized');
  Wrapper.Query._getUserAppointmentRecords.mockResolvedValueOnce([{ id: 4 }]);
  expect(await Query.getUserAppointmentRecords(null, { userId: 9, offset: 1, limit: 2 }, context)).toEqual([{ id: 4 }]);
  expect(Wrapper.Query._getUserAppointmentRecords.mock.calls.at(-1)[1]).toEqual({ userId: '9', offset: 1, limit: 2 });
  Wrapper.Query._getUserAppointmentRecords.mockResolvedValueOnce([]);
  expect(await Query.getUserAppointmentRecords(null, { patientIdentifier: ' A ' }, context)).toEqual([]);
});

test('branch scoped query delegates enforce global permission, scheduler branch and explicit locations', async () => {
  const context = ctx(); const globalNames = ['listAllOpenAppointments', 'searchAppointmentStatuses', 'getAppointmentStatusCounts'];
  for (const name of globalNames) {
    permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: false });
    await expect(Query[name](null, args, context)).rejects.toThrow('Unauthorized');
    await expect(Query[name](null, { ...args, location: 'QuezonCity' }, context)).rejects.toThrow('Unauthorized');
    const result = { name }; const target = Wrapper.Query[`_${name}`]; target.mockResolvedValueOnce(result);
    expect(await Query[name](null, args, context)).toBe(result);
    expect(target).toHaveBeenCalled();
  }
  const branchNames = ['listCustomDates', 'listAllAppointmentRequirements', 'listAppointmentSchedule', 'listMonthAvailability', 'listSchedulerWhitelist', 'checkDateOccupancy'];
  for (const name of branchNames) {
    permit.isMedicalPermittedBranchBased.mockResolvedValueOnce(false);
    await expect(Query[name](null, args, context)).rejects.toThrow('Unauthorized');
    const result = { name }; Wrapper.Query[`_${name}`].mockResolvedValueOnce(result);
    expect(await Query[name](null, args, context)).toBe(result);
    expect(permit.isMedicalPermittedBranchBased).toHaveBeenCalledWith(5, 'VIEW_CONFIG', 'Arlegui');
  }
  expect(Wrapper.Query._listAllAppointmentRequirements.mock.calls[0][1]).toEqual({ schedulerId: 3, offset: 1, limit: 2, isActive: null });
  expect(Wrapper.Query._listAppointmentSchedule.mock.calls[0][1]).toEqual({ schedulerId: 3, date: '2026-10-01', skipTimeframe: true });
});

test('location checks support Both, Manila, QuezonCity and reject unknown branch scope', async () => {
  const context = ctx(); Wrapper.Query._listAllOpenAppointments.mockResolvedValue([]);
  for (const [branch, location, allowed] of [['Both', 'QuezonCity', true], ['Manila', 'Casal', true], ['QuezonCity', 'QuezonCity', true], ['QuezonCity', 'Arlegui', false], ['Unknown', 'Arlegui', false]]) {
    permit.getStaffBranch.mockResolvedValueOnce(branch);
    if (allowed) expect(await Query.listAllOpenAppointments(null, { location }, context)).toEqual([]);
    else await expect(Query.listAllOpenAppointments(null, { location }, context)).rejects.toThrow('Unauthorized');
  }
  expect(await Query.listAllOpenAppointments(null, {}, context)).toEqual([]);
});

test('appointment response validates slot ownership, patient permission and missing records', async () => {
  const context = ctx();
  await expect(Mutation.respondAppointment(null, { status: 'Approved' }, context)).rejects.toThrow('Either slotId or userId');
  helper.getPatientIdFromSlotId.mockRejectedValueOnce(Error('Slot not found'));
  await expect(Mutation.respondAppointment(null, { slotId: 4, status: 'Approved' }, context)).rejects.toThrow('Slot not found');
  helper.getPatientIdFromSlotId.mockRejectedValueOnce(Error('database'));
  await expect(Mutation.respondAppointment(null, { slotId: 4, status: 'Approved' }, context)).rejects.toThrow('Failed to resolve slot');
  helper.getPatientIdFromSlotId.mockResolvedValueOnce(10);
  await expect(Mutation.respondAppointment(null, { userId: 9, slotId: 4, status: 'Approved' }, context)).rejects.toThrow('does not belong');
  permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(false);
  await expect(Mutation.respondAppointment(null, { userId: 9, status: 'Approved' }, context)).rejects.toThrow('Unauthorized');
  Wrapper.Query._getUserAppointmentRecords.mockResolvedValueOnce(null);
  await expect(Mutation.respondAppointment(null, { userId: 9, status: 'Approved' }, context)).rejects.toThrow('No appointment record');
  Wrapper.Query._getUserAppointmentRecords.mockResolvedValueOnce([]);
  await expect(Mutation.respondAppointment(null, { userId: 9, status: 'Approved' }, context)).rejects.toThrow('No appointment record');
});

test('appointment response uses explicit or latest slot and sends patient notification', async () => {
  const context = ctx();
  Wrapper.Mutation._respondAppointment.mockResolvedValueOnce({ id: 4, patientId: 9 });
  expect(await Mutation.respondAppointment(null, { slotId: 4, status: 'Approved' }, context)).toEqual({ id: 4, patientId: 9 });
  expect(sockets.notifyUser).toHaveBeenCalledWith(9, 'appointment:responded', { status: 'Approved', notes: undefined, slotId: 4 }, expect.objectContaining({ email: 'p@example.com', notes: null }));
  Wrapper.Query._getUserAppointmentRecords.mockResolvedValueOnce([{ id: 5 }]);
  Wrapper.Mutation._respondAppointment.mockResolvedValueOnce({ id: 5, patientId: 9 });
  expect(await Mutation.respondAppointment(null, { userId: 9, status: 'Rejected', notes: 'full' }, context)).toEqual({ id: 5, patientId: 9 });
  expect(Wrapper.Mutation._respondAppointment.mock.calls[1][1]).toEqual({ slotId: 5, status: 'Rejected', notes: 'full' });
  expect(sockets.notifyUser.mock.calls[1][0]).toBe('9');
  expect(sockets.notifyUser.mock.calls[1][3].notes).toBe('full');
  Wrapper.Mutation._respondAppointment.mockResolvedValueOnce({ id: 6, patientId: 9 });
  expect(await Mutation.respondAppointment(null, { patientIdentifier: ' A ', slotId: 4, status: 'Approved' }, context)).toEqual({ id: 6, patientId: 9 });
});

test('attendance resolves the patient, enforces approval permission and notifies them', async () => {
  const context = ctx(); permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(false);
  await expect(Mutation.recordAppointmentAttendance(null, { slotId: 4 }, context)).rejects.toThrow('Unauthorized');
  Wrapper.Mutation._recordAppointmentAttendance.mockResolvedValueOnce({ patientId: 9 });
  expect(await Mutation.recordAppointmentAttendance(null, { slotId: 4, arrived_at: 'today' }, context)).toEqual({ patientId: 9 });
  expect(sockets.notifyUser).toHaveBeenCalledWith(9, 'appointment:attendance-recorded', { slotId: 4, arrived_at: 'today' }, expect.objectContaining({ email: 'p@example.com' }));
});

test('scheduler mutations use edit permission for input or resolved schedule branch', async () => {
  const context = ctx();
  for (const [name, operation] of Object.entries(Mutation).filter(([name]) => !['respondAppointment', 'recordAppointmentAttendance'].includes(name))) {
    permit.isMedicalPermittedBranchBased.mockResolvedValueOnce(false);
    await expect(operation(null, args, context)).rejects.toThrow('Unauthorized');
    const result = { name }; Wrapper.Mutation[`_${name}`].mockResolvedValueOnce(result);
    expect(await operation(null, args, context)).toBe(result);
    expect(Wrapper.Mutation[`_${name}`]).toHaveBeenCalled();
    expect(permit.isMedicalPermittedBranchBased).toHaveBeenCalledWith(5, 'EDIT_CONFIG', 'Arlegui');
  }
});
