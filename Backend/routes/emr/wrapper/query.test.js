jest.mock('../../../config/query.js', () => ({ query: jest.fn(), isUserValidated: jest.fn(), setExpiredUpdateTickets: jest.fn() }));
jest.mock('../../../utils/graphql-helper.js', () => ({ throwGraphQLError: jest.fn(() => { const c = { message: jest.fn(), status: jest.fn(), throw: jest.fn() }; c.message.mockReturnValue(c); c.status.mockReturnValue(c); c.throw.mockImplementation(() => { throw new Error(`${c.status.mock.lastCall[0]}:${c.message.mock.lastCall[0]}`); }); return c; }) }));
jest.mock('../../../utils/logger.js', () => ({ debug: jest.fn(), error: jest.fn(), info: jest.fn() }));
jest.mock('dotenv', () => ({ config: jest.fn() }));

const db = require('../../../config/query.js');
const Query = require('./query.js');

beforeEach(() => jest.clearAllMocks());

test('gets the most recent update ticket and adds patient ID', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ id: 4, status: 'Pending', scope: 'Both' }] });
  await expect(Query._getUserUpdateTicket(null, { userId: 7 }, { user: { id: 7 }, res: {} })).resolves.toMatchObject({ id: 4, patientId: 7 });
  expect(db.query.mock.calls[0][1]).toEqual([7]);
});

test('rejects missing IDs and expires an old validated in-progress ticket', async () => {
  await expect(Query._getUserUpdateTicket(null, { userId: null }, { user: null, res: {} })).rejects.toThrow('401:Unauthorized');
  db.query.mockResolvedValueOnce({ rows: [{ id: 5, status: 'InProgress', created_at: new Date('2000-01-01') }] });
  db.isUserValidated.mockResolvedValueOnce(true);
  await expect(Query._getUserUpdateTicket(null, { userId: 7 }, { user: { id: 7 }, res: {} })).resolves.toMatchObject({ id: 5, patientId: 7, status: 'Expired' });
  expect(db.setExpiredUpdateTickets).toHaveBeenCalledWith(5);
});

test('matches exact ticket reads to the patient and leaves the ticket status unchanged', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ id: 42, status: 'InProgress' }] });
  const context = { user: { id: 3 }, res: {} };
  await expect(Query._getUserUpdateTicket(null, { userId: 7, ticketId: '42' }, context))
    .resolves.toMatchObject({ id: 42, patientId: 7, status: 'InProgress' });
  expect(db.query.mock.lastCall).toEqual([expect.stringContaining('WHERE pul."patientId" = $1'), [7, '42']]);
  expect(db.query.mock.lastCall[0]).toContain('AND pul.id = $2');
  expect(db.setExpiredUpdateTickets).not.toHaveBeenCalled();

  db.query.mockResolvedValueOnce({ rows: [] });
  await expect(Query._getUserImmunizationProfile(null, { userId: 7, ticketId: '42', limit: 1 }, context)).resolves.toEqual([]);
  expect(db.query.mock.lastCall[0]).toContain('pul."patientId" = $1');
  expect(db.query.mock.lastCall[0]).toContain('AND pul.id = $6');
  expect(db.query.mock.lastCall[1]).toEqual([7, 1, 0, new Date(0), null, '42']);
});

test('returns the stored custom employee category in readable profile data', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ id: 12, profile_type: 'Employee', role: 'Other', employmentCategoryOther: 'Research officer' }] });

  const profiles = await Query._getUserProfile(null, { userId: 7 }, { user: { id: 7 }, res: {} });

  expect(db.query.mock.calls[0][0]).toContain('ep."employmentCategoryOther"');
  expect(profiles[0]).toMatchObject({
    __typename: 'EmployeeProfile',
    role: 'Other',
    employmentCategoryOther: 'Research officer',
  });
});

test.each([
  ['_getUserMedicalHistory', 'MedicalHistory', 'mh', 'MedicalCondition', 'conditions', { conditionId: 3, relationship: 'Mother' }],
  ['_getUserImmunizationProfile', 'Immunization', 'im', 'ImmunizationRecord', 'immunizations', { vaccineTypeId: 8, doseNumber: 2 }],
])('%s reads the ticket and child rows without selecting profile notes', async (method, table, alias, childTable, field, child) => {
  const from = '2025-01-01T00:00:00Z';
  const anchor = { id: 12, created_at: from, status: 'Pending' };
  db.query.mockResolvedValueOnce({ rows: [{ ...anchor }] }).mockResolvedValueOnce({ rows: [child] });

  await expect(Query[method](null, { userId: 7, from, limit: 1, statuses: ['Pending'] }, { user: { id: 7 }, res: {} }))
    .resolves.toEqual([{ ...anchor, [field]: [child] }]);
  const [[profileSql, profileParams], [childSql, childParams]] = db.query.mock.calls;
  expect(profileSql).toContain(`SELECT ${alias}.id, pul.created_at, pul.status`);
  expect(profileSql).toContain(`FROM "${table}"`);
  expect(profileParams).toEqual([7, 1, 0, new Date(from), ['Pending']]);
  expect(childSql).toContain(`FROM "${childTable}"`);
  expect(childParams).toEqual([12]);
});

test('ticket lists include the authoritative patient type without dropping legacy patients', async () => {
  const rows = [
    { id: 1, patientId: 7, profile_type: 'Student' },
    { id: 2, patientId: 8, profile_type: 'Employee' },
    { id: 3, patientId: 9, profile_type: null },
  ];
  db.query.mockResolvedValueOnce({ rows });
  await expect(Query._getStatusUpdateTickets(null, { statuses: ['Pending'], branch: 'Both', offset: 0, limit: 20 }, { user: { id: 1 }, res: {} })).resolves.toEqual(rows);
  const [sql, values] = db.query.mock.calls[0];
  expect(sql).toContain('p.profile::text   AS profile_type');
  expect(sql).toContain('LEFT JOIN "Patients" p ON p.id = pul."patientId"');
  expect(values).toEqual(['Both', ['Pending'], 20, 0]);
});
