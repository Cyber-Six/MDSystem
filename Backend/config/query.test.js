jest.mock('./db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../utils/security', () => ({ hashPassword: jest.fn(async () => 'hash') }));
jest.mock('../utils/validator', () => ({ deduceRoleFromEmail: jest.fn(() => 'Student') }));
jest.mock('../utils/logger', () => require('../test-support/fixtures.cjs').loggerMock());
let pool, queries;
beforeEach(() => { jest.resetModules(); pool = require('./db'); queries = require('./query'); });
test('exposes the pool and acquires connections or propagates connection failure', async () => {
  expect(queries.db()).toBe(pool);
  const client = {};
  pool.connect.mockResolvedValueOnce(client).mockRejectedValueOnce(new Error('offline'));
  await expect(queries.connect()).resolves.toBe(client);
  await expect(queries.connect()).rejects.toThrow('offline');
});
test('runs queries on the pool or caller transaction', async () => {
  const result = { rows: [{ id: 1 }] }, client = { query: jest.fn().mockResolvedValue(result) };
  pool.query.mockResolvedValue(result);
  await expect(queries.query('SELECT $1', [1])).resolves.toBe(result);
  await expect(queries.queryClient(client, 'SELECT $1', [1])).resolves.toBe(result);
  await expect(queries.queryControlled('SELECT $1', [1])).resolves.toEqual({ success: true, rows: result.rows });
  await expect(queries.queryControlledClient(client, 'SELECT $1', [1])).resolves.toEqual({ success: true, rows: result.rows });
  expect(client.query).toHaveBeenCalledWith('SELECT $1', [1]);
});
test.each(['23503', '23505', 'unexpected'])('preserves controlled query failure %s', async code => {
  const error = Object.assign(new Error('DB error'), { code, detail: 'constraint' });
  pool.query.mockRejectedValue(error);
  await expect(queries.queryControlled('SQL', [])).rejects.toBe(error);
});
test('counts credentials and normalizes registration data', async () => {
  pool.query.mockResolvedValueOnce({ rows: [{ count: '3' }] }).mockResolvedValue({ rows: [{ id: 12 }] });
  await expect(queries.countUserByEmail('user@test.invalid')).resolves.toBe(3);
  await expect(queries.createUser({ email: 'user@test.invalid', password: 'secret', role: 'patient', data_consent_version: 'v1' })).resolves.toEqual({ id: 12 });
  expect(pool.query).toHaveBeenLastCalledWith(expect.stringContaining('INSERT INTO "UserCredentials"'), ['user@test.invalid', 'hash', 'patient', 'v1']);
  await expect(queries.createPatient({ id: 12, email: 'msmith@tip.edu.ph' })).resolves.toEqual({ id: 12 });
  expect(pool.query).toHaveBeenLastCalledWith(expect.stringContaining('INSERT INTO "Patients"'), [12, 'Student']);
});
test.each([
  ['findUserByEmail', 'user@test.invalid', { id: 12 }, { id: 12 }],
  ['findEmailByUserId', 12, { email: 'user@test.invalid' }, 'user@test.invalid'],
  ['getUserConsentStateByEmail', 'user@test.invalid', { data_consent: true }, { data_consent: true }],
  ['getUserIdentity', 12, { identity: 'patient' }, 'patient'],
  ['getUserCredentialStatus', 12, { status: 'Verified' }, 'Verified'],
  ['getUserBranch', 12, { branch: 'Manila' }, 'Manila'],
  ['getUserPatientType', 12, { profile: 'Student' }, 'Student'],
  ['getMedicalPersonnelStatus', 12, { is_active: false }, false],
  ['getCredentialLockStateByEmail', 'user@test.invalid', { id: 12, status: 'Locked' }, { userId: 12, status: 'Locked', lockedUntil: null }],
  ['getCredentialLockStateByUserId', 12, { id: 12, email: 'user@test.invalid', status: 'Locked' }, { userId: 12, email: 'user@test.invalid', status: 'Locked', lockedUntil: null }],
])('%s returns its public shape, missing state, and propagates DB failures', async (method, input, row, expected) => {
  pool.query.mockResolvedValueOnce({ rows: [row] }).mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(new Error('offline'));
  await expect(queries[method](input)).resolves.toEqual(expected);
  expect(pool.query).toHaveBeenCalledWith(expect.any(String), [input]);
  await expect(queries[method](input)).resolves.toBeNull();
  await expect(queries[method](input)).rejects.toThrow('offline');
});
test('handles nullable credential fields', async () => {
  pool.query.mockResolvedValue({ rows: [{ id: 12 }] });
  await expect(queries.findEmailByUserId(12)).resolves.toBeNull();
  await expect(queries.getUserCredentialStatus(12)).resolves.toBeNull();
  await expect(queries.getCredentialLockStateByEmail('user')).resolves.toEqual({ userId: 12, status: null, lockedUntil: null });
  await expect(queries.getCredentialLockStateByUserId(12)).resolves.toEqual({ userId: 12, email: null, status: null, lockedUntil: null });
});
test('updates passwords and rejects missing credentials', async () => {
  pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 12 }] }).mockResolvedValueOnce({ rowCount: 0, rows: [] });
  await expect(queries.updateUserPasswordById(12, 'new')).resolves.toEqual({ id: 12 });
  expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SET password_hash = $1'), ['hash', 12]);
  await expect(queries.updateUserPasswordById(12, 'new')).rejects.toThrow('USER_NOT_FOUND');
});
test('updates consent and identity with parameterized values', async () => {
  pool.query.mockResolvedValueOnce({ rows: [{ id: 12 }] }).mockResolvedValueOnce({ rows: [] });
  const consent = { data_consent: true, data_consent_version: 'v2', data_consent_agreed: 'today' };
  await expect(queries.updateUserConsent(12, consent)).resolves.toEqual({ id: 12 });
  expect(pool.query).toHaveBeenCalledWith(expect.any(String), [true, 'v2', 'today', 12]);
  await expect(queries.updateUserConsent(12, consent)).resolves.toBeNull();
  pool.query.mockResolvedValueOnce({ rows: [{ id: 12, identity: 'medical' }] }).mockResolvedValueOnce({ rows: [] });
  await expect(queries.updateUserIdentity(12, 'medical')).resolves.toEqual({ id: 12, identity: 'medical' });
  expect(pool.query).toHaveBeenLastCalledWith(expect.any(String), ['medical', 12]);
  await expect(queries.updateUserIdentity(12, 'medical')).resolves.toBeNull();
});
test.each(['setExpiredUpdateTickets', 'setExpiredPersonalTickets'])('%s expires only pending tickets and propagates failure', async method => {
  pool.query.mockResolvedValueOnce({ rowCount: 1 }).mockRejectedValueOnce(new Error('offline'));
  await expect(queries[method](12)).resolves.toBeUndefined();
  expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("SET status = 'Expired'"), [12]);
  await expect(queries[method](12)).rejects.toThrow('offline');
});
test('recognizes verified credentials and active personnel', async () => {
  pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ status: 'Unverified' }] }).mockResolvedValueOnce({ rows: [{ status: 'Verified' }] }).mockRejectedValueOnce(new Error('offline'));
  await expect(queries.isUserValidated(12)).resolves.toBe(false);
  await expect(queries.isUserValidated(12)).resolves.toBe(false);
  await expect(queries.isUserValidated(12)).resolves.toBe(true);
  await expect(queries.isUserValidated(12)).rejects.toThrow('offline');
  pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 12 }] }).mockRejectedValueOnce(new Error('offline'));
  await expect(queries.isActiveMedicalPersonnel(12)).resolves.toBe(false);
  await expect(queries.isActiveMedicalPersonnel(12)).resolves.toBe(true);
  await expect(queries.isActiveMedicalPersonnel(12)).rejects.toThrow('offline');
});
test.each([
  [{ email: 'user', userId: 12, wasSuccessful: true, ipAddress: '127.0.0.1', userAgent: 'test', userType: 'patient' }, undefined, {}, [12, 'user', true, '127.0.0.1', 'test', 'Patient']],
  [{ portal: 'staff' }, undefined, {}, [null, null, false, null, null, 'Medical']],
  [{}, undefined, {}, [null, null, false, null, null, null]],
  ['user', true, { ipAddress: '127.0.0.1', userAgent: 'test', userType: 'medical' }, [null, 'user', true, '127.0.0.1', 'test', 'Medical']],
  ['user', false, { portal: 'patient' }, [null, 'user', false, null, null, 'Patient']],
  [null, false, {}, [null, null, false, null, null, null]],
  [[], false, {}, [null, [], false, null, null, null]],
])('records login attempts in both calling conventions %j', async (input, success, metadata, values) => {
  await queries.recordLoginAttempt(input, success, metadata);
  expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO "UserLoginAttempt"'), values);
});
test('uses default login metadata and propagates audit failure', async () => {
  pool.query.mockRejectedValue(new Error('offline'));
  await expect(queries.recordLoginAttempt('user', true)).rejects.toThrow('offline');
});
test('writes system audit events using a supplied transaction or the pool', async () => {
  const values = { eventType: 'update', actorId: 12, actorType: 'medical', targetId: 13, action: 'approve', details: {}, changedBy: 12 };
  const client = { query: jest.fn().mockResolvedValue({ rows: [{ id: 9 }] }) };
  pool.query.mockResolvedValue({ rows: [{ id: 8 }] });
  await expect(queries.setSystemAuditLog(values)).resolves.toBe(8);
  await expect(queries.setSystemAuditLog({ ...values, client })).resolves.toBe(9);
  expect(client.query).toHaveBeenCalledWith(expect.stringContaining('SystemAuditLog'), ['update', 12, 'medical', 13, 'approve', {}, 12]);
});
test.each(['verifyUserIdentities', 'getUserIdentitiesDetailed', 'getPatientBranches'])('%s skips invalid lists and propagates failures', async method => {
  for (const input of [null, []]) await expect(queries[method](input)).resolves.toEqual(method === 'verifyUserIdentities' ? { valid: [], invalid: [] } : []);
  expect(pool.query).not.toHaveBeenCalled();
  pool.query.mockRejectedValue(new Error('offline'));
  await expect(queries[method]([12])).rejects.toThrow('offline');
});
test('maps bulk identity and branch rows and identifies missing IDs', async () => {
  pool.query.mockResolvedValue({ rows: [{ id: 12, userId: 12, identity: 'patient', status: 'Verified', is_medical_personnel: false, is_active: false, branch: 'Manila' }] });
  await expect(queries.verifyUserIdentities(['12', 13])).resolves.toEqual({ valid: [{ id: '12', identity: 'patient', status: 'Verified' }], invalid: [13], totalRequested: 2, totalValid: 1, totalInvalid: 1 });
  await expect(queries.getUserIdentitiesDetailed([12])).resolves.toEqual([{ id: '12', identity: 'patient', status: 'Verified', isMedicalPersonnel: false, isActive: false, branch: 'Manila' }]);
  await expect(queries.getPatientBranches([12])).resolves.toEqual([{ userId: '12', branch: 'Manila' }]);
});
test.each([[null, 'Both'], [[], 'Both'], [[{ branch: null }], 'Both'], [[{ branch: 'Manila' }, { branch: 'Manila' }], 'Manila'], [[{ branch: 'Manila' }, { branch: 'QuezonCity' }], 'Both']])('resolves union scope for %j', (branches, expected) => {
  expect(queries.resolveUnionBranch(branches)).toBe(expected);
});
test('initializes preference schema once and reads preference defaults', async () => {
  pool.query.mockResolvedValue({ rows: [{}] });
  await expect(queries.getUserPreferences(12)).resolves.toEqual({ appearance: {}, notification: {} });
  expect(pool.query).toHaveBeenCalledTimes(3);
  pool.query.mockResolvedValueOnce({ rows: [{ appearance: { theme: 'dark' }, notification: { web: false } }] });
  await expect(queries.getUserPreferences(12)).resolves.toEqual({ appearance: { theme: 'dark' }, notification: { web: false } });
  expect(pool.query).toHaveBeenCalledTimes(4);
  pool.query.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(new Error('offline'));
  await expect(queries.getUserPreferences(12)).resolves.toBeNull();
  await expect(queries.getUserPreferences(12)).rejects.toThrow('offline');
});
test('retries preference setup after failure and reports unsuccessful writes', async () => {
  pool.query.mockRejectedValueOnce(new Error('DDL unavailable')).mockResolvedValue({ rows: [{}] });
  await expect(queries.getUserPreferences(12)).resolves.toEqual({ appearance: {}, notification: {} });
  await expect(queries.setUserPreferences(12, {})).resolves.toEqual({ appearance: {}, notification: {} });
  expect(pool.query).toHaveBeenLastCalledWith(expect.stringContaining('ON CONFLICT(id)'), [12, null, null]);
  pool.query.mockResolvedValueOnce({ rows: [{ appearance: { theme: 'dark' }, notification: { web: true } }] });
  await expect(queries.setUserPreferences(12, { appearance: { theme: 'dark' }, notification: { web: true } })).resolves.toEqual({ appearance: { theme: 'dark' }, notification: { web: true } });
  expect(pool.query).toHaveBeenLastCalledWith(expect.any(String), [12, '{"theme":"dark"}', '{"web":true}']);
  pool.query.mockResolvedValueOnce({ rows: [] });
  await expect(queries.setUserPreferences(12, {})).rejects.toThrow('Failed to set preferences');
});
