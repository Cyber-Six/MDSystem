const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture, staffRecord } = require('./fixtures');
const { valuesFor, compareSaved } = require('./assertions');
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
