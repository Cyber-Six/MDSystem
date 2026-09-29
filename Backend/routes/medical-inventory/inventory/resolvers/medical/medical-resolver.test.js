const mockQueryDelegates = {};
const mockMutationDelegates = {};
const proxy = delegates => new Proxy({}, { get(_target, name) { return delegates[name] ||= jest.fn(); } });
jest.mock('../wrapper/wrapper.js', () => ({ Query: proxy(mockQueryDelegates), Mutation: proxy(mockMutationDelegates) }));
jest.mock('../../../../../services/authorization/permit.js', () => ({ permissions: { inventory_allow_view: 'VIEW', inventory_allow_configure: 'CONFIGURE', inventory_allow_edit: 'EDIT' }, isMedicalPermitted: jest.fn(), isMedicalPermittedBranchBased: jest.fn(), getStaffBranch: jest.fn() }));
jest.mock('../../../../../utils/logger.js', () => ({ warn: jest.fn(), error: jest.fn() }));
jest.mock('../wrapper/helper.js', () => ({ batchIdToBranch: jest.fn() }));

const Wrapper = require('../wrapper/wrapper.js');
const permit = require('../../../../../services/authorization/permit.js');
const helper = require('../wrapper/helper.js');
const logger = require('../../../../../utils/logger.js');
const { Query, Mutation } = require('./medical-resolver.js');
const ctx = (user = { id: 5 }) => ({ user, res: { status: jest.fn().mockReturnThis() } });
beforeEach(() => { jest.clearAllMocks(); permit.isMedicalPermitted.mockResolvedValue({ permitted: true }); permit.isMedicalPermittedBranchBased.mockResolvedValue(true); permit.getStaffBranch.mockResolvedValue('Manila'); helper.batchIdToBranch.mockResolvedValue('Arlegui'); });

test('all inventory queries and mutations reject anonymous callers', async () => {
  const args = { id: 2, batchId: 3, input: { location: 'Arlegui' } };
  for (const operation of [...Object.values(Query), ...Object.values(Mutation)]) await expect(operation(null, args, ctx(null))).rejects.toThrow('Unauthorized');
  expect(permit.isMedicalPermitted).not.toHaveBeenCalled();
});

test('item reads and catalog mutations require their respective global permissions', async () => {
  const context = ctx();
  for (const [name, args] of [['getMedicalItems', { offset: 1, active: false }], ['getMedicalItem', { id: 8 }]]) {
    permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: false });
    await expect(Query[name](null, args, context)).rejects.toThrow('Unauthorized');
    const result = { name }; Wrapper.Query[`_${name}`].mockResolvedValueOnce(result);
    expect(await Query[name](null, args, context)).toBe(result);
  }
  expect(Wrapper.Query._getMedicalItems.mock.calls[0][1]).toEqual({ active: false, offset: 1 });
  for (const [name, args] of [['createMedicalItems', { input: { label: 'A' } }], ['updateMedicalItems', { id: 1, input: { label: 'B' } }], ['deleteMedicalItems', { id: 1 }]]) {
    permit.isMedicalPermitted.mockResolvedValueOnce({ permitted: false });
    await expect(Mutation[name](null, args, context)).rejects.toThrow('Unauthorized');
    const result = { name }; Wrapper.Mutation[`_${name}`].mockResolvedValueOnce(result);
    expect(await Mutation[name](null, args, context)).toBe(result);
    expect(Wrapper.Mutation[`_${name}`]).toHaveBeenLastCalledWith(null, args, context);
  }
  expect(permit.isMedicalPermitted).toHaveBeenCalledWith(5, 'CONFIGURE');
});

test('supply reads enforce branch location and view permission', async () => {
  const context = ctx();
  for (const name of ['getMedicalSupply', 'getSupplyBatches']) {
    await expect(Query[name](null, { location: 'QuezonCity' }, context)).rejects.toThrow('Unauthorized');
    permit.isMedicalPermittedBranchBased.mockResolvedValueOnce(false);
    await expect(Query[name](null, { location: 'Arlegui' }, context)).rejects.toThrow('Unauthorized');
    const result = [{ id: name }]; Wrapper.Query[`_${name}`].mockResolvedValueOnce(result);
    expect(await Query[name](null, { location: 'Casal' }, context)).toBe(result);
    expect(Wrapper.Query[`_${name}`].mock.calls[0][1]).toEqual({ availableOnly: true, location: 'Casal' });
  }
  permit.getStaffBranch.mockResolvedValueOnce('QuezonCity'); Wrapper.Query._getMedicalSupply.mockResolvedValueOnce([]);
  expect(await Query.getMedicalSupply(null, { location: 'QuezonCity' }, context)).toEqual([]);
  permit.getStaffBranch.mockResolvedValueOnce('Both'); Wrapper.Query._getSupplyBatches.mockResolvedValueOnce([]);
  expect(await Query.getSupplyBatches(null, { location: 'QuezonCity' }, context)).toEqual([]);
  Wrapper.Query._getSupplyBatches.mockResolvedValueOnce([]);
  expect(await Query.getSupplyBatches(null, {}, context)).toEqual([]);
});

test('supply additions use the input branch, edit permission and staff recipient ID', async () => {
  const context = ctx();
  for (const name of ['addMedicalSupply', 'addSupplyBatch']) {
    const args = { input: { location: 'Arlegui', quantity: 2 } };
    permit.isMedicalPermittedBranchBased.mockResolvedValueOnce(false);
    await expect(Mutation[name](null, args, context)).rejects.toThrow('Unauthorized');
    const result = { id: name }; Wrapper.Mutation[`_${name}`].mockResolvedValueOnce(result);
    expect(await Mutation[name](null, args, context)).toBe(result);
    expect(Wrapper.Mutation[`_${name}`].mock.calls[0][1]).toEqual({ input: args.input, receivedBy: 5 });
    expect(permit.isMedicalPermittedBranchBased).toHaveBeenCalledWith(5, 'EDIT', 'Arlegui');
  }
});

test('batch mutations resolve the correct branch and reject absent, failed, or unauthorized lookups', async () => {
  const context = ctx(); const args = { batchId: 9, input: { quantity: 3 } };
  for (const [name, table] of [['splitMedicalSupply', 'SupplyBatch'], ['splitMedicineSupply', 'MedicineBatch'], ['updateMedicalSupply', 'MedicineBatch'], ['updateSupplyBatch', 'SupplyBatch']]) {
    helper.batchIdToBranch.mockResolvedValueOnce(null);
    await expect(Mutation[name](null, args, context)).rejects.toThrow('Internal error retrieving batch information');
    helper.batchIdToBranch.mockRejectedValueOnce(Error('database offline'));
    await expect(Mutation[name](null, args, context)).rejects.toThrow('Internal error retrieving batch information');
    permit.isMedicalPermittedBranchBased.mockResolvedValueOnce(false);
    await expect(Mutation[name](null, args, context)).rejects.toThrow('Unauthorized');
    const result = { name }; Wrapper.Mutation[`_${name}`].mockResolvedValueOnce(result);
    expect(await Mutation[name](null, args, context)).toBe(result);
    expect(helper.batchIdToBranch).toHaveBeenCalledWith(table, 9);
    expect(permit.isMedicalPermittedBranchBased).toHaveBeenCalledWith(5, 'EDIT', 'Arlegui');
    expect(Wrapper.Mutation[`_${name}`]).toHaveBeenLastCalledWith(null, args, context);
  }
  expect(logger.error).toHaveBeenCalled();
});
