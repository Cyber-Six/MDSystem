'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const store = require('./store');
const { execute, stageNames } = require('./engine');
const { parse } = require('../../scripts/e2e-lifecycle');
const urls = { E2E_PATIENT_URL: 'https://patient.qa.invalid', E2E_STAFF_URL: 'https://staff.qa.invalid' };
function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mds-lifecycle-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const run = store.open('qa-run', urls, false, root);
  return { run, persist: value => store.write(value, root), root };
}
function driverFor(scenario, events = []) {
  const account = { email: `${scenario.id}@qa.invalid`, password: 'private-credential' };
  const initial = { verified: true, patientId: scenario.id, ticketId: `${scenario.id}-initial`, role: scenario.role, kind: 'initial', url: urls.E2E_PATIENT_URL };
  const update = { ...initial, ticketId: `${scenario.id}-update`, kind: 'update', baseline: { ticketId: initial.ticketId, record: { unchanged: true } } };
  const driver = { reconcile: async () => events.push('reconcile') };
  for (const name of stageNames(scenario)) driver[name] = async (current, registered) => {
    events.push(name);
    if (name === 'initialSubmission') await registered(account);
    else assert.equal(current.account.email, account.email);
    return { account, manifest: name === 'updateSubmission' || (name === 'decision' && scenario.kind === 'update') ? update : initial,
      status: name === 'baselineApproval' ? 'Approved' : name === 'decision' ? scenario.action === 'reject' ? 'Rejected' : 'Approved' : 'Pending' };
  };
  return driver;
}
test('all 12 chains use distinct accounts, exact tickets, and an approved update baseline', async t => {
  const { run, persist, root } = setup(t);
  for (const scenario of run.scenarios) {
    const events = [];
    await execute(run, scenario, driverFor(scenario, events), persist);
    assert.deepEqual(events, stageNames(scenario));
    assert.ok(Object.values(scenario.stages).every(stage => stage.status === 'passed'));
  }
  const saved = store.read(run.id, root);
  assert.equal(new Set(saved.scenarios.map(item => item.account.email)).size, 12);
  assert.equal(saved.scenarios[0].account.password, 'private-credential');
  assert.equal(store.open(run.id, urls, true, root).scenarios.length, 12);
  if (process.platform !== 'win32') assert.equal(fs.statSync(store.filename(run.id, root)).mode & 0o777, 0o600);
});
test('failed submission saves credentials, blocks downstream writes, and does not stop another scenario', async t => {
  const { run, persist, root } = setup(t), scenario = run.scenarios[0];
  const driver = driverFor(scenario);
  driver.initialSubmission = async (_scenario, registered) => { await registered({ email: 'recover@qa.invalid', password: 'recoverable' }); throw new Error('partial submission'); };
  await assert.rejects(execute(run, scenario, driver, persist), /partial submission/);
  const saved = store.read(run.id, root);
  assert.equal(saved.scenarios[0].account.password, 'recoverable');
  assert.equal(scenario.stages.decision.status, 'blocked');
  await execute(run, run.scenarios[1], driverFor(run.scenarios[1]), persist);
  assert.equal(run.scenarios[1].stages.decision.status, 'passed');
  const events = [];
  await assert.rejects(execute(run, scenario, driverFor(scenario, events), persist), /uncertain/);
  assert.deepEqual(events, ['reconcile']);
});
test('resume checks current authenticated identity and skips already verified write stages', async t => {
  const { run, persist } = setup(t), scenario = run.scenarios.find(item => item.kind === 'update');
  const first = driverFor(scenario);
  first.baselineApproval = async () => { throw new Error('decision interrupted'); };
  await assert.rejects(execute(run, scenario, first, persist));
  const events = [];
  await assert.rejects(execute(run, scenario, driverFor(scenario, events), persist), /uncertain/);
  assert.deepEqual(events, ['reconcile']);
  const other = run.scenarios[0];
  await execute(run, other, driverFor(other), persist);
  const resumed = [];
  await execute(run, other, driverFor(other, resumed), persist);
  assert.deepEqual(resumed, ['reconcile']);
});
test('stale or reset account reconciliation blocks all stages without replacing the patient', async t => {
  const { run, persist } = setup(t), scenario = run.scenarios[0];
  await execute(run, scenario, driverFor(scenario), persist);
  const original = structuredClone(scenario.account), events = [];
  const driver = driverFor(scenario, events);
  driver.reconcile = async () => { throw new Error('INVALID_CREDENTIALS after reset'); };
  await assert.rejects(execute(run, scenario, driver, persist), /INVALID_CREDENTIALS/);
  assert.deepEqual(events, []);
  assert.deepEqual(scenario.account, original);
});
test('wrong patient, deployment, ticket, and baseline cannot pass between stages', async t => {
  for (const problem of ['patient', 'deployment', 'ticket', 'baseline', 'account']) {
    const { run, persist } = setup(t), scenario = run.scenarios.find(item => item.kind === 'update');
    const driver = driverFor(scenario);
    const name = problem === 'ticket' ? 'baselineApproval' : 'updateSubmission';
    const original = driver[name];
    driver[name] = async (...args) => {
      const result = await original(...args);
      if (problem === 'patient') result.manifest.patientId = 'unrelated';
      if (problem === 'deployment') result.manifest.url = 'https://elsewhere.invalid';
      if (problem === 'ticket') result.manifest = { ...result.manifest, ticketId: 'unrelated' };
      if (problem === 'baseline') result.manifest.baseline.ticketId = 'unrelated';
      if (problem === 'account') result.account = { email: 'unrelated', password: 'x' };
      return result;
    };
    await assert.rejects(execute(run, scenario, driver, persist), /another|mismatch|baseline|change patients/);
    assert.equal(scenario.stages.decision.status, 'blocked');
  }
});
test('run IDs and deployment isolation are enforced and unsafe CLI overrides are refused', t => {
  const { run, root } = setup(t);
  assert.throws(() => store.open(run.id, { ...urls, E2E_STAFF_URL: 'https://other.invalid' }, true, root), /different deployment/);
  assert.throws(() => store.open(run.id, urls, false, root), /already exists/);
  assert.throws(() => store.filename('../outside'), /Invalid/);
  assert.deepEqual(parse(['--run-id', 'qa-run', '--headed', '--grep', 'Student']), { runId: 'qa-run', forwarded: ['--headed', '--grep', 'Student'] });
  for (const flag of ['--workers=2', '--retries=2', '--trace=on', '--project=custom-choices', '--ui', '--no-deps', '-j2']) assert.throws(() => parse([flag]), /fixed/);
});
test('sanitized report omits credentials, tokens, and the private original manifest', async t => {
  const { run, persist } = setup(t), scenario = run.scenarios[0];
  const key = 'E2E_LIFECYCLE_TEST_PASSWORD', previous = process.env[key];
  process.env[key] = 'private-credential';
  t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  await execute(run, scenario, driverFor(scenario), persist);
  scenario.stages.initialSubmission.result.manifest.privateInput = 'original-input-manifest-marker';
  const report = require('./reporter').summarize(run.id, run, [{ errors: ['private-credential recover@qa.invalid Bearer qa-access'],
    evidence: { password: 'private-credential', accessToken: 'qa-access', authorization: 'Bearer qa-access' } }]);
  const text = JSON.stringify(report);
  for (const secret of ['private-credential', 'recover@qa.invalid', 'qa-access', 'original-input-manifest-marker']) assert.equal(text.includes(secret), false);
  assert.equal(report.scenarios[0].stages[0].ticketId, scenario.stages.initialSubmission.result.manifest.ticketId);
});
