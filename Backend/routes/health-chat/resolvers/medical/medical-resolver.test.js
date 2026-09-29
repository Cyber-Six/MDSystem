const mockQueryDelegates = {};
const mockMutationDelegates = {};
const proxy = delegates => new Proxy({}, { get(_target, name) { return delegates[name] ||= jest.fn(); } });
jest.mock('../wrapper/wrapper.js', () => ({ Query: proxy(mockQueryDelegates), Mutation: proxy(mockMutationDelegates) }));
jest.mock('../../../../config/query.js', () => ({ query: jest.fn() }));
jest.mock('../../../../services/authorization/permit.js', () => ({ permissions: { health_chat_allow_access: 'CHAT' }, isMedicalPermitted: jest.fn(), isMedicalPermittedPatientBased: jest.fn(), isMedicalAdmin: jest.fn(), getStaffBranch: jest.fn() }));
jest.mock('../wrapper/helper.js', () => ({ getPatientIdFromChatId: jest.fn() }));

const Wrapper = require('../wrapper/wrapper.js'); const db = require('../../../../config/query.js'); const permit = require('../../../../services/authorization/permit.js');
const helper = require('../wrapper/helper.js'); const { Query, Mutation } = require('./medical-resolver.js');
const ctx = () => ({ user: { id: 5 }, res: { status: jest.fn().mockReturnThis() } });
const args = { chatId: 3, input: { chatId: 3 }, patientId: 9, location: 'Manila', statuses: ['Open'], status: 'Open', searchTerm: 'A', offset: 1, limit: 2, toMedicalId: 6 };
beforeEach(() => {
  jest.clearAllMocks(); permit.isMedicalPermitted.mockResolvedValue({ permitted: true, branch: 'Both' }); permit.isMedicalPermittedPatientBased.mockResolvedValue(true);
  permit.isMedicalAdmin.mockResolvedValue(false); permit.getStaffBranch.mockResolvedValue('Manila'); helper.getPatientIdFromChatId.mockResolvedValue(9);
  db.query.mockResolvedValue({ rows: [{ branch: 'Manila' }] });
});

test('ticket lists enforce chat permission and effective branch before delegation', async () => {
  const context = ctx();
  for (const name of ['getPendingTickets', 'getActiveTickets', 'getAllTickets', 'getPatientConversations']) {
    permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: false, branch: 'Both' });
    await expect(Query[name](null, args, context)).rejects.toThrow('Access denied');
    permit.getStaffBranch.mockResolvedValueOnce('QuezonCity');
    await expect(Query[name](null, args, context)).rejects.toThrow('Access denied by branch scope');
    const result = [{ id: name }]; Wrapper.Query[`_${name}`].mockResolvedValueOnce(result);
    expect(await Query[name](null, args, context)).toBe(result);
    expect(Wrapper.Query[`_${name}`].mock.calls[0][1]).toEqual(expect.objectContaining({ location: 'Manila' }));
  }
});

test('effective scope intersects requested, designation and permission branches, including admin bypass', async () => {
  const context = ctx(); Wrapper.Query._getPendingTickets.mockResolvedValue([]);
  for (const [staffBranch, permissionBranch, location, expected] of [
    ['Both', 'Both', 'Both', 'Both'], ['Manila', 'Both', 'Both', 'Manila'], ['Both', 'QuezonCity', 'Both', 'QuezonCity'],
    ['QuezonCity', 'Both', 'QuezonCity', 'QuezonCity'], [null, null, 'Manila', 'Manila']
  ]) {
    permit.getStaffBranch.mockResolvedValueOnce(staffBranch); permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: true, branch: permissionBranch });
    expect(await Query.getPendingTickets(null, { location }, context)).toEqual([]);
    expect(Wrapper.Query._getPendingTickets.mock.calls.at(-1)[1].location).toBe(expected);
  }
  permit.isMedicalAdmin.mockResolvedValueOnce(true);
  expect(await Query.getPendingTickets(null, { location: '' }, context)).toEqual([]);
  expect(Wrapper.Query._getPendingTickets.mock.calls.at(-1)[1].location).toBe('Both');
  permit.getStaffBranch.mockResolvedValueOnce('QuezonCity'); permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: true, branch: 'Manila' });
  await expect(Query.getPendingTickets(null, { location: 'Both' }, context)).rejects.toThrow('branch scope');
  permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: true });
  expect(await Query.getPendingTickets(null, { location: '' }, context)).toEqual([]);
  for (const name of ['getPendingTickets', 'getActiveTickets', 'getAllTickets', 'getPatientConversations']) {
    Wrapper.Query[`_${name}`].mockResolvedValueOnce([]);
    expect(await Query[name](null, {}, context)).toEqual([]);
  }
});

test('patient scoped reads check permission, patient existence and designation', async () => {
  const context = ctx();
  for (const name of ['getTicket', 'getMessages', 'getPatientMessages', 'getTransferCandidates']) {
    permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(false);
    await expect(Query[name](null, args, context)).rejects.toThrow('Access denied');
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(Query[name](null, args, context)).rejects.toThrow('Patient not found');
    db.query.mockResolvedValueOnce({ rows: [{ branch: 'QuezonCity' }] });
    await expect(Query[name](null, args, context)).rejects.toThrow('Access denied by branch scope');
    const result = { name }; Wrapper.Query[`_${name}`].mockResolvedValueOnce(result);
    expect(await Query[name](null, args, context)).toBe(result);
  }
  expect(helper.getPatientIdFromChatId).toHaveBeenCalledWith(3);
  expect(permit.isMedicalPermittedPatientBased).toHaveBeenCalledWith(5, 'CHAT', 9);
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining('UsersPersonal'), [9]);
});

test('patient scope allows Both designations and patients, and admins bypass origin branch lookup', async () => {
  const context = ctx(); Wrapper.Query._getTicket.mockResolvedValue({ id: 3 });
  permit.getStaffBranch.mockResolvedValueOnce('Both'); db.query.mockResolvedValueOnce({ rows: [{ branch: 'QuezonCity' }] });
  expect(await Query.getTicket(null, args, context)).toEqual({ id: 3 });
  db.query.mockResolvedValueOnce({ rows: [{ branch: 'Both' }] });
  expect(await Query.getTicket(null, args, context)).toEqual({ id: 3 });
  permit.isMedicalAdmin.mockResolvedValueOnce(true);
  expect(await Query.getTicket(null, args, context)).toEqual({ id: 3 });
  permit.getStaffBranch.mockResolvedValueOnce(null); db.query.mockResolvedValueOnce({ rows: [{ branch: 'QuezonCity' }] });
  expect(await Query.getTicket(null, args, context)).toEqual({ id: 3 });
  helper.getPatientIdFromChatId.mockResolvedValueOnce(null); Wrapper.Query._getTransferCandidates.mockResolvedValueOnce([]);
  expect(await Query.getTransferCandidates(null, args, context)).toEqual([]);
});

test('medical chat mutations enforce patient permission and designation before delegation', async () => {
  const context = ctx();
  for (const name of ['approveTicket', 'rejectTicket', 'sendMedicalMessage', 'closeTicket']) {
    permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(false);
    await expect(Mutation[name](null, args, context)).rejects.toThrow('Access denied');
    db.query.mockResolvedValueOnce({ rows: [{ branch: 'QuezonCity' }] });
    await expect(Mutation[name](null, args, context)).rejects.toThrow('Access denied by branch scope');
    const result = { name }; Wrapper.Mutation[`_${name}`].mockResolvedValueOnce(result);
    expect(await Mutation[name](null, args, context)).toBe(result);
    expect(Wrapper.Mutation[`_${name}`]).toHaveBeenLastCalledWith(null, args, context);
  }
});

test('transfer verifies origin and target permissions and their branch scope', async () => {
  const context = ctx();
  permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(false);
  await expect(Mutation.transferTicket(null, args, context)).rejects.toThrow('Access denied');
  permit.isMedicalPermittedPatientBased.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  await expect(Mutation.transferTicket(null, args, context)).rejects.toThrow('New Medical Personnel does not have enough permission');
  db.query.mockResolvedValueOnce({ rows: [{ branch: 'Manila' }] }).mockResolvedValueOnce({ rows: [] });
  await expect(Mutation.transferTicket(null, args, context)).rejects.toThrow('Patient not found');
  db.query.mockResolvedValueOnce({ rows: [{ branch: 'Manila' }] }).mockResolvedValueOnce({ rows: [{ branch: 'QuezonCity' }] });
  await expect(Mutation.transferTicket(null, args, context)).rejects.toThrow('Target staff branch does not match');
  permit.getStaffBranch.mockResolvedValueOnce('Manila').mockResolvedValueOnce(null);
  db.query.mockResolvedValueOnce({ rows: [{ branch: 'Manila' }] }).mockResolvedValueOnce({ rows: [{ branch: 'QuezonCity' }] });
  Wrapper.Mutation._transferTicket.mockResolvedValueOnce({ id: 3 });
  expect(await Mutation.transferTicket(null, args, context)).toEqual({ id: 3 });
  Wrapper.Mutation._transferTicket.mockResolvedValueOnce({ id: 3 });
  expect(await Mutation.transferTicket(null, args, context)).toEqual({ id: 3 });
  expect(permit.isMedicalPermittedPatientBased).toHaveBeenCalledWith(6, 'CHAT', 9);
  expect(Wrapper.Mutation._transferTicket.mock.calls[0][1]).toEqual({ chatId: 3, toMedicalId: 6 });
});

test('admin takeover requires admin status while maintenance operations delegate', async () => {
  const context = ctx();
  await expect(Mutation.takeoverOngoingTicket(null, args, context)).rejects.toThrow('Access denied');
  permit.isMedicalAdmin.mockResolvedValueOnce(true); Wrapper.Mutation._takeoverOngoingTicket.mockResolvedValueOnce({ id: 3 });
  expect(await Mutation.takeoverOngoingTicket(null, args, context)).toEqual({ id: 3 });
  for (const name of ['expireOldTickets', 'extendSession']) {
    const result = { name }; Wrapper.Mutation[`_${name}`].mockResolvedValueOnce(result);
    expect(await Mutation[name](null, args, context)).toBe(result);
    expect(Wrapper.Mutation[`_${name}`]).toHaveBeenLastCalledWith(null, args, context);
  }
});
