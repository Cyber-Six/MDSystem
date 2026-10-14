jest.mock('../../../config/query.js', () => ({ query: jest.fn(), connect: jest.fn(), getUserIdentity: jest.fn() }));
jest.mock('../../../config/multer.js', () => ({ promoteFile: jest.fn(), deleteFile: jest.fn() }));
jest.mock('../query/upsert.js', () => ({ upsertEmergencyNumber: jest.fn() }));
jest.mock('../query/anchor.js', () => ({}));
jest.mock('../query/delete.js', () => ({}));
jest.mock('../../../utils/graphql-helper.js', () => ({ throwGraphQLError: jest.fn(() => { const c = { message: jest.fn(), status: jest.fn(), throw: jest.fn() }; c.message.mockReturnValue(c); c.status.mockReturnValue(c); c.throw.mockImplementation(() => { throw new Error(`${c.status.mock.lastCall[0]}:${c.message.mock.lastCall[0]}`); }); return c; }) }));
jest.mock('../../../utils/logger.js', () => ({ debug: jest.fn(), info: jest.fn(), error: jest.fn() }));
jest.mock('../../../utils/validator.js', () => ({ generateDomainCodes: jest.fn(), normalizeName: jest.fn() }));
jest.mock('../../profile/resolvers/wrapper/wrapper.js', () => ({ Mutation: { _reloadCredentialStatus: jest.fn() } }));
jest.mock('../resolvers/record-validator.js', () => ({ validateUpdateTicket: jest.fn() }));

const Mutation = require('./mutation.js');
const db = require('../../../config/query.js');
const anchor = require('../query/anchor.js');
const remove = require('../query/delete.js');

beforeEach(() => jest.clearAllMocks());

test('rejects invalid staff ticket statuses before opening a database transaction', async () => {
  await expect(Mutation._StaffUpdateTicket(null, { args: { status: 'Pending' }, recordId: 1, scope: 'Both' }, { user: { id: 3 }, res: {} })).rejects.toThrow("400:Invalid status. Must be 'Approved', 'Revision', or 'Rejected'.");
});

test('stores the employee custom category in the existing role column', async () => {
  db.getUserIdentity.mockResolvedValue('Employee');
  db.query.mockResolvedValue({ rows: [{ profileId: 12, role: 'Research officer' }] });

  const result = await Mutation._EmployeeProfile(null, {
    args: { input: { department: 'Science', role: 'Other', position: 'Analyst', employmentCategoryOther: 'Research officer' } },
    recordId: 12,
  }, { user: { id: 4 }, res: {} });

  expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO "employee_profile"'), [12, 'Science', 'Research officer', 'Analyst']);
  expect(result.employmentCategoryOther).toBe('Research officer');
});

test('stores notes and custom appliance details when no catalog appliances are selected', async () => {
  anchor.OralAppliance = jest.fn().mockResolvedValue({ notes: 'ORAL_APPLIANCE_META::{"notes":null,"otherDescription":"Custom guard","otherArch":"Upper"}' });
  remove.OralApplianceRecord = jest.fn();
  const input = { appliances: [], notes: null, otherDescription: 'Custom guard', otherArch: 'Upper' };

  const result = await Mutation._OralApplianceProfile(null, { args: { input }, recordId: 13 }, { user: { id: 4 }, res: {} });

  expect(anchor.OralAppliance).toHaveBeenCalledWith(13, null, { otherDescription: 'Custom guard', otherArch: 'Upper' });
  expect(remove.OralApplianceRecord).toHaveBeenCalledWith(13);
  expect(result).toMatchObject({ id: 13, notes: null, otherDescription: 'Custom guard', otherArch: 'Upper', appliances: [] });
});

test('stores allergy profile notes in the existing allergy record notes field', async () => {
  anchor.Allergy = jest.fn();
  remove.AllergyRecord = jest.fn();
  db.queryControlled = jest.fn().mockResolvedValue({ rows: [{ allergenCatalogId: 8, notes: 'Other: seasonal reactions' }] });
  const result = await Mutation._AllergyProfile(null, {
    args: { input: { notes: 'Other: seasonal reactions', allergies: [{ allergenCatalogId: 8, status: 'Active', severity: 'Mild' }] } },
    recordId: 14,
  }, { user: { id: 4 }, res: {} });

  expect(anchor.Allergy).toHaveBeenCalledWith(14);
  expect(db.queryControlled.mock.calls[0][1]).toEqual([14, 8, 'Active', 'Mild', 'Other: seasonal reactions', null]);
  expect(result.allergies[0].notes).toBe('Other: seasonal reactions');
});
