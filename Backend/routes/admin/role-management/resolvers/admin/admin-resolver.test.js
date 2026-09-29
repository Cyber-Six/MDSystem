const mockQueryDelegates = {};
const mockMutationDelegates = {};
const delegateProxy = delegates => new Proxy({}, { get(_target, name) { return delegates[name] ||= jest.fn(); } });
jest.mock('../wrapper/wrapper.js', () => ({ Query: delegateProxy(mockQueryDelegates), Mutation: delegateProxy(mockMutationDelegates) }));
jest.mock('../../../../../services/authorization/permit.js', () => ({ permissions: { is_admin: 'IS_ADMIN' }, isMedicalPermitted: jest.fn() }));

const Wrapper = require('../wrapper/wrapper.js');
const permit = require('../../../../../services/authorization/permit.js');
const { Query, Mutation } = require('./admin-resolver.js');
const context = (user = { id: 5 }) => ({ user, res: { status: jest.fn().mockReturnThis() } });
beforeEach(() => { jest.clearAllMocks(); permit.isMedicalPermitted.mockResolvedValue({ permitted: true }); });

test.each([['Query', Query], ['Mutation', Mutation]])('all %s operations enforce admin permission and pass exact arguments to their wrapper', async (kind, operations) => {
  const ctx = context(); const args = { sample: 8 }; const root = { root: true };
  for (const [name, operation] of Object.entries(operations)) {
    const delegate = Wrapper[kind][`_${name}`];
    const result = { operation: name };
    delegate.mockResolvedValueOnce(result);
    expect(await operation(root, args, ctx)).toBe(result);
    expect(delegate).toHaveBeenLastCalledWith(root, args, ctx);
  }
  expect(permit.isMedicalPermitted).toHaveBeenCalledTimes(Object.keys(operations).length);
  expect(permit.isMedicalPermitted).toHaveBeenCalledWith(5, 'IS_ADMIN');
});

test.each([['Query', Query], ['Mutation', Mutation]])('anonymous callers cannot invoke any %s operation', async (kind, operations) => {
  const ctx = context(null);
  for (const operation of Object.values(operations)) await expect(operation(null, {}, ctx)).rejects.toThrow('Unauthorized');
  expect(permit.isMedicalPermitted).not.toHaveBeenCalled();
  for (const name of Object.keys(operations)) expect(Wrapper[kind][`_${name}`]).not.toHaveBeenCalled();
});

test.each([['Query', Query], ['Mutation', Mutation]])('non-admin staff cannot invoke any %s operation', async (kind, operations) => {
  permit.isMedicalPermitted.mockResolvedValue({ permitted: false });
  const ctx = context();
  for (const operation of Object.values(operations)) await expect(operation(null, {}, ctx)).rejects.toThrow('Admin access required.');
  for (const name of Object.keys(operations)) expect(Wrapper[kind][`_${name}`]).not.toHaveBeenCalled();
});
