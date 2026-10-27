const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const registry = require('./account-registry');
const { redact } = require('./evidence');
const ErrorReporter = require('./error-reporter');
test('persist accounts, retain older credentials, isolate deployments, and honor overrides', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-registry-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'accounts.json');
  const first = { email: 'first@qa.test', password: 'private-one', role: 'Student', url: 'https://example.test/', createdAt: '2025-01-01' };
  registry.save(first, file);
  assert.equal(registry.candidates('Student', first.url, {}, file).length, 0);
  registry.save({ email: first.email, url: first.url, ready: true, ticketId: '1' }, file);
  registry.save({ ...first, email: 'new@qa.test', ready: true, createdAt: '2025-02-01' }, file);
  assert.equal(registry.read(file)[0].password, first.password);
  assert.deepEqual(registry.candidates('Student', first.url, {}, file).map(a => a.email), ['new@qa.test', first.email]);
  assert.equal(registry.candidates('Employee', first.url, {}, file).length, 0);
  assert.equal(registry.candidates('Student', 'https://other.test', {}, file).length, 0);
  assert.equal(registry.candidates('Student', first.url, { E2E_CUSTOM_STUDENT_EMAIL: 'override', E2E_CUSTOM_STUDENT_PASSWORD: 'secret' }, file)[0].email, 'override');
  assert.equal(registry.candidates('Student', first.url, { E2E_CUSTOM_STUDENT_EMAIL: 'override', E2E_CUSTOM_STUDENT_PASSWORD: 'secret' }, file)[0].source, 'environment');
  assert.throws(() => registry.candidates('Student', first.url, { E2E_CUSTOM_STUDENT_EMAIL: 'partial' }, file), /both/);
  assert.equal(registry.candidates('Student', first.url, { E2E_CUSTOM_STUDENT_EMAIL: 'actual-student-qa-email', E2E_CUSTOM_STUDENT_PASSWORD: 'actual-student-qa-password' }, file)[0].email, 'new@qa.test');
  registry.save({ email: first.email, url: first.url, authInvalid: true }, file);
  assert.deepEqual(registry.candidates('Student', first.url, {}, file).map(a => a.email), ['new@qa.test']);
  assert.equal(registry.candidates('Student', first.url, {}, file)[0].source, 'registry');
  assert.ok(!JSON.stringify(redact(registry.read(file))).includes('private-one'));
});
test('mocked eligibility accepts approved records and explains pending and wrong-role blockers', () => {
  const personal = { getCredentialStatus: 'Active', getPersonalRecord: { id: '1' }, getPersonalRecordLogStatus: null };
  const emr = { getPatientBasicInfo: { profile_type: 'Student' }, getUpdateTicket: { status: 'Approved' } };
  assert.deepEqual(registry.eligibility('Student', personal, emr), []);
  emr.getUpdateTicket.status = 'Pending';
  assert.match(registry.eligibility('Student', personal, emr).join(), /staff approval/);
  assert.match(registry.eligibility('Employee', personal, emr).join(), /role/);
});

test('custom-choice reports redact saved account credentials and configured secrets', t => {
  const originalRead = registry.read;
  const envKeys = ['E2E_CUSTOM_STUDENT_EMAIL', 'E2E_CUSTOM_STUDENT_PASSWORD', 'E2E_TEST_OTP'];
  const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  registry.read = () => [{ email: 'private-qa@qa.test', password: 'private-qa-password' }];
  process.env.E2E_CUSTOM_STUDENT_EMAIL = 'private-qa@qa.test';
  process.env.E2E_CUSTOM_STUDENT_PASSWORD = 'private-qa-password';
  process.env.E2E_TEST_OTP = 'private-qa-otp';
  t.after(() => {
    registry.read = originalRead;
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  const output = new ErrorReporter().clean('private-qa@qa.test private-qa-password private-qa-otp');
  for (const secret of ['private-qa@qa.test', 'private-qa-password', 'private-qa-otp']) {
    assert.equal(output.includes(secret), false);
  }
  const evidence = JSON.stringify(redact({ loginEmail: 'private-qa@qa.test', loginPassword: 'private-qa-password', message: 'Used private-qa@qa.test' }));
  for (const secret of ['private-qa@qa.test', 'private-qa-password']) {
    assert.equal(evidence.includes(secret), false);
  }
});
