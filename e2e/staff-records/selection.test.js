const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fixture } = require('./fixtures');
const { reserve, loadCandidates, assertTicket } = require('./selection');
const { incompleteReason, submittedRecord } = require('./manifest');
const { recoverInputManifest } = require('./recovery');

function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'staff-records-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('records are isolated by role, deployment, workflow and original-input completeness', t => {
  const dir = temp(t), manifest = fixture();
  const file = path.join(dir, 'input.json'); fs.writeFileSync(file, JSON.stringify(manifest));
  const accounts = [{ email: 'qa@example.test', role: 'Student', createdAt: '2026-01-01', url: manifest.url, recordManifests: [{ kind: 'initial', ticketId: manifest.ticketId, path: file }] }];
  const scenario = { role: 'Student', kind: 'initial', action: 'approve' };
  assert.equal(loadCandidates(accounts, scenario, manifest.url).candidates.length, 1);
  assert.equal(loadCandidates(accounts, { ...scenario, role: 'Employee' }, manifest.url).candidates.length, 0);
  assert.equal(loadCandidates(accounts, scenario, 'https://different.qa.invalid').candidates.length, 0);
  assert.equal(loadCandidates(accounts, { ...scenario, kind: 'update' }, manifest.url).candidates.length, 0);
  manifest.controls = []; fs.writeFileSync(file, JSON.stringify(manifest));
  assert.match(loadCandidates(accounts, { ...scenario, action: 'revise' }, manifest.url).reasons[0], /revision/);
  manifest.record.medicalHistory = null; fs.writeFileSync(file, JSON.stringify(manifest));
  assert.equal(loadCandidates(accounts, scenario, manifest.url).candidates.length, 0);
  assert.match(incompleteReason(manifest), /medicalHistory/);
});

test('patient reservation survives separate runs and prevents reuse in conflicting scenarios', t => {
  const file = path.join(temp(t), 'reserved.json'), manifest = fixture(), account = { url: manifest.url };
  assert.equal(reserve({ id: 'student-initial-approve' }, account, manifest, file), true);
  assert.equal(reserve({ id: 'student-initial-approve' }, account, manifest, file), true);
  assert.equal(reserve({ id: 'student-initial-reject' }, account, manifest, file), false);
  assert.equal(JSON.parse(fs.readFileSync(file)).length, 1);
  fs.writeFileSync(`${file}.lock`, '');
  assert.throws(() => reserve({ id: 'x' }, account, manifest, file), /concurrently/);
});

test('stale, wrong-owner and wrong-status tickets stop before a decision', () => {
  const manifest = fixture(), good = { id: manifest.ticketId, patientId: manifest.patientId, status: 'Pending', scope: 'Both' };
  assert.doesNotThrow(() => assertTicket(manifest, good));
  for (const change of [{ id: 'newer' }, { patientId: 'unrelated' }, { status: 'Approved' }, { scope: 'Dental' }]) {
    let decided = false;
    assert.throws(() => { assertTicket(manifest, { ...good, ...change }); decided = true; }, /no staff decision/);
    assert.equal(decided, false);
  }
});

test('only successful original submission inputs become expected values; aborted probes are excluded', () => {
  const response = { data: { submitTicket: 'Pending' } };
  const network = [
    { request: { query: 'mutation { createInitialPersonalRecord(input: $input) { id } }', variables: { input: { first_name: 'QA' } } }, response },
    { request: { query: 'mutation BatchCreateInitialRecords { submitTicket }', variables: { medHistInput: { notes: 'original' } } }, response },
    { request: { query: 'mutation BatchCreateInitialRecords { submitTicket }', variables: { medHistInput: { notes: 'aborted' } } }, response: { abortedForInvalidInputProbe: true } },
  ];
  assert.equal(submittedRecord(network).record.medicalHistory.notes, 'original');
  assert.equal(submittedRecord(network).record.personalInfo.first_name, 'QA');
});

test('legacy input recovery requires matching authenticated patient, ticket, identifier and names', () => {
  const manifest = fixture();
  const account = { role: 'Student', url: manifest.url, ready: true, ticketId: manifest.ticketId };
  const vars = { input: manifest.record.personalInfo };
  const names = { profile: 'studentInput', emergencyContact: 'emergencyInput', medicalHistory: 'medHistInput', allergyProfile: 'allergyInput', hospitalizationProfile: 'hospInput', operationProfile: 'opInput', medicationProfile: 'medInput', immunizationProfile: 'immuInput', lifestyle: 'lifeInput', visualAcuityProfile: 'vaInput', dentalHistory: 'dentalHistInput', dentalProcedureProfile: 'dentalProcInput', oralApplianceProfile: 'oralAppInput', dentalPhotoRecord: 'dentalPhotoInput', obgynHistory: 'obgynInput' };
  const variables = Object.fromEntries(Object.entries(names).map(([key, variable]) => [variable, manifest.record[key]]));
  const report = { status: 'passed', evidence: { role: 'Student', mode: 'initial', ticket: { id: manifest.ticketId, patientId: manifest.patientId, scope: 'Both' }, network: [
    { request: { query: 'mutation { createInitialPersonalRecord(input: $input) { id } }', variables: vars }, response: { data: {} } },
    { request: { query: 'mutation BatchCreateInitialRecords { submitTicket }', variables }, response: { data: { submitTicket: 'Pending' } } },
  ] } };
  const identity = { ticket: { id: manifest.ticketId, patientId: manifest.patientId }, personal: manifest.record.personalInfo };
  assert.ok(recoverInputManifest(account, report, identity));
  assert.equal(recoverInputManifest(account, report, { ...identity, ticket: { ...identity.ticket, patientId: 'other' } }), null);
  assert.equal(recoverInputManifest(account, report, { ...identity, personal: { ...identity.personal, identifier: 'other' } }), null);
  assert.equal(recoverInputManifest(account, { ...report, status: 'failed' }, identity), null);
});

test('execution lease rejects concurrent staff workflows including the same scenario', t => {
  const { acquireExecutionLease } = require('./selection');
  const file = path.join(temp(t), 'running.lock');
  const release = acquireExecutionLease(file);
  assert.throws(() => acquireExecutionLease(file), /execution lease/);
  release(); acquireExecutionLease(file)();
});

test('catalog labels are isolated by section when independent catalogs share numeric IDs', () => {
  const original = submittedRecord([{ request: { query: 'query Catalogs { ... }' }, response: { data: { medicalConditionCatalog: [{ id: 1, name: 'QA Condition' }], oralApplianceCatalog: [{ id: '1', name: 'QA Appliance' }] } } }]);
  assert.equal(original.labels['medicalHistory:1'], 'QA Condition');
  assert.equal(original.labels['oralApplianceProfile:1'], 'QA Appliance');
});
