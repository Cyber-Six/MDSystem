const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture, staffRecord } = require('./fixtures');
const { valuesFor, compareSaved } = require('./assertions');
const { submittedRecord } = require('./manifest');
const { replaceValue } = require('./revision');
const { redact } = require('../custom-choices/evidence');

test('complete fixtures retain zero, multiline notes, separate family relationships and custom labels', () => {
  for (const role of ['Student', 'Employee']) {
    const manifest = fixture(role), fields = valuesFor(manifest);
    assert.ok(fields.some(row => row.value === 0));
    assert.ok(fields.some(row => row.display.includes('\n')));
    assert.ok(fields.some(row => row.display === 'QA Self Condition'));
    assert.ok(fields.some(row => row.display === 'Mother' && row.section === 'medicalHistory'));
    const record = staffRecord(manifest);
    assert.doesNotThrow(() => compareSaved(manifest, { record, personal: { logs: [manifest.record.personalInfo] } }, []));
    record.hospitalizationProfile.hospitalizations[0].notes = 'lost note';
    assert.throws(() => compareSaved(manifest, { record, personal: { logs: [manifest.record.personalInfo] } }, []), /hospitalizationProfile/);
  }
});

test('conditional sections and abandoned lifestyle inputs are excluded', () => {
  const manifest = fixture(); manifest.scope = 'Dental';
  assert.ok(valuesFor(manifest).every(row => !['medicalHistory', 'obgynHistory', 'lifestyle'].includes(row.section)));
  manifest.scope = 'Both'; manifest.record.personalInfo.sex = 'Male'; manifest.record.lifestyle.smoker = false;
  manifest.record.lifestyle.numberOfCigarettesPerDay = 999;
  assert.ok(!valuesFor(manifest).some(row => row.value === 999 || row.section === 'obgynHistory'));
});

test('missing selected labels fail rather than allowing approval of an unreadable record', () => {
  const manifest = fixture(); delete manifest.labels['101'];
  assert.throws(() => valuesFor(manifest), /unresolved catalog label/);
});

test('saved contact assertions normalize only the fields normalized by the emergency number write', () => {
  const manifest = fixture();
  manifest.record.emergencyContact.firstContact = {
    contactName: ' QA  Guardian 1-1 ', contactNumber: '0918 000 0001', relationship: ' Mother ', address: 'QA Street',
  };
  const fields = Object.fromEntries(valuesFor(manifest).map(field => [field.path.join('.'), field.value]));
  assert.equal(fields['firstContact.contactName'], 'Qa Guardian 1-1');
  assert.equal(fields['firstContact.contactNumber'], '+639180000001');
  assert.equal(fields['firstContact.relationship'], 'Mother');
  assert.equal(fields['firstContact.address'], 'QA Street');
  assert.equal(fields.middle_name, 'QA');
  assert.equal(fields.contactNumber, '09170000000');
  assert.equal(manifest.record.emergencyContact.firstContact.contactName, ' QA  Guardian 1-1 ');
});

test('saved operation and hospitalization notes follow the first entry fallback', () => {
  const manifest = fixture();
  manifest.record.operationProfile.operations[0].notes = null;
  const saved = valuesFor(manifest);
  assert.equal(saved.find(field => field.section === 'operationProfile' && field.path.join('.') === 'operations.0.notes').value, 'QA Operation Notes');
  assert.equal(saved.find(field => field.section === 'hospitalizationProfile' && field.path.join('.') === 'hospitalizations.0.notes').value, 'QA Hospital Detail');
});

test('compares the first allergy entry fallback and keeps each explicit entry note', () => {
  const manifest = fixture('Student', 'update');
  const { allergies } = manifest.record.allergyProfile;
  allergies.push({ ...allergies[0], notes: 'second entry' });
  delete allergies[0].notes;
  const record = staffRecord(manifest);
  const saved = { record, personal: { logs: [manifest.record.personalInfo] } };
  record.allergyProfile.allergies[0].notes = record.allergyProfile.notes;
  delete record.allergyProfile.notes;
  assert.doesNotThrow(() => compareSaved(manifest, saved, []));
  allergies[0].notes = 'specific entry';
  assert.throws(() => compareSaved(manifest, saved, []), /allergyProfile.allergies.0.notes/);
  record.allergyProfile.allergies[0].notes = 'specific entry';
  record.allergyProfile.allergies[1].notes = 'wrong';
  assert.throws(() => compareSaved(manifest, saved, []), /allergyProfile.allergies.1.notes/);
});

test('checks update contact details across approval without comparing the verification flag', () => {
  const manifest = fixture('Student', 'update');
  for (const contact of Object.values(manifest.record.emergencyContact)) contact.isVerified = false;
  const record = staffRecord(manifest);
  delete record.emergencyContact.firstContact.isVerified;
  record.emergencyContact.secondContact.isVerified = true;
  const saved = { record, personal: { logs: [manifest.record.personalInfo] } };

  assert.ok(valuesFor(manifest).every(field => field.path.at(-1) !== 'isVerified'));
  assert.doesNotThrow(() => compareSaved(manifest, saved, []));
  record.emergencyContact.firstContact.relationship = 'Changed';
  assert.throws(() => compareSaved(manifest, saved, []), /emergencyContact.firstContact.relationship/);
});

test('compares Employee update roles using the stored value shown by staff', () => {
  for (const [label, stored] of [
    ['Non-Teaching', 'Staff'], ['Non-Teaching (Officer)', 'StaffOfficer'],
    ['Teaching', 'NonStaff'], ['Teaching (Officer)', 'NonStaffOfficer'],
    ['Staff', 'Staff'], ['Other', 'Other'],
  ]) {
    const manifest = fixture('Employee', 'update');
    manifest.record.profile.role = label;
    const record = staffRecord(manifest);
    record.profile.role = stored;
    const saved = { record, personal: { logs: [manifest.record.personalInfo] } };

    const role = valuesFor(manifest).find(field => field.section === 'profile' && field.label === 'Role');
    assert.equal(role.value, stored);
    assert.equal(role.display, stored);
    assert.doesNotThrow(() => compareSaved(manifest, saved, []));
    assert.equal(manifest.record.profile.role, label);
    record.profile.role = 'Wrong';
    assert.throws(() => compareSaved(manifest, saved, []), /profile.role/);
  }
});

test('Student program labels survive a later oral appliance catalog response with the same ID', () => {
  const search = { response: { data: { searchStudentProgram: [{ id: '14', label: 'BS Computer Science' }] } } };
  const catalogs = { response: { data: { oralApplianceCatalog: [{ id: '14', name: 'Occlusal Splint' }] } } };
  const submission = {
    request: { query: 'mutation BatchCreateInitialRecords { submitTicket }', variables: { studentInput: { programId: '14' } } },
    response: { data: { submitTicket: 'Pending' } },
  };
  assert.equal(submittedRecord([catalogs, search]).labels['14'], 'Occlusal Splint');
  const manifest = { scope: 'Both', ticketId: '1', ...submittedRecord([catalogs, search, catalogs, submission]) };
  assert.equal(manifest.labels['program:14'], 'BS Computer Science');
  assert.equal(manifest.labels['oralApplianceProfile:14'], 'Occlusal Splint');
  assert.equal(manifest.labels['14'], 'Occlusal Splint');

  const snapshot = { record: { profile: { id: '1', program: 'BS Computer Science' } } };
  assert.doesNotThrow(() => compareSaved(manifest, snapshot, []));
  delete manifest.labels['program:14'];
  assert.throws(() => compareSaved(manifest, snapshot, []), /unresolved catalog label: profile.programId/);
});

test('revision changes preserve every unrelated field and normalize month input', () => {
  const original = fixture().record;
  const revised = replaceValue(original, 'QA Hospital Notes', 'QA Revised Notes');
  assert.equal(revised.hospitalizationProfile.notes, 'QA Revised Notes');
  assert.deepEqual(revised.medicalHistory, original.medicalHistory);
  assert.equal(replaceValue({ date: '2025-06-01' }, '2025-06', '2025-07').date, '2025-07-01');
});

test('evidence redaction removes passwords and tokens', () => {
  const value = JSON.stringify(redact({ password: 'do-not-print', accessToken: 'do-not-print', message: 'Bearer abc.def.ghi', status: 'Pending' }));
  assert.doesNotMatch(value, /do-not-print|abc\.def\.ghi/);
  assert.match(value, /Pending/);
});
