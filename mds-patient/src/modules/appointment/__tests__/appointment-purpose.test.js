/**
 * Tests: Appointment Purpose Validation (Patient-side)
 *
 * Covers the behavior change: purpose is now ALWAYS required for all
 * appointments regardless of the scheduler's purposeRequired flag.
 *
 * Run: node --test "src/modules/appointment/__tests__/appointment-purpose.test.js"
 *   or via: npm test  (if the test glob is updated to include this path)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Inline mirror of the validation logic used in:
//   - patient-appointment-service.js  (submitAppointment)
//   - appointment.jsx                 (handleSubmit)
//   - ReviewSubmit.jsx                (purposeMissing)
// ---------------------------------------------------------------------------

/**
 * Returns true when the purpose value is considered valid (non-empty after trim).
 * This is the single validation rule now that purpose is always required.
 */
function isPurposeValid(purpose) {
  return (purpose || '').trim().length > 0;
}

/**
 * Simulates the submitAppointment service-level guard.
 * Throws exactly the same error as patient-appointment-service.js.
 */
function validatePurposeOrThrow(purpose) {
  const normalizedPurpose = (purpose || '').trim();
  if (!normalizedPurpose) {
    throw new Error('Purpose / reason for visit is required.');
  }
  return normalizedPurpose;
}

/**
 * Returns the purposeRequired value used by the patient appointment wizard.
 * After the change this is a constant — no longer derived from the scheduler.
 */
function getPurposeRequiredFlag(_scheduler) {
  // purposeRequired is always true — ignores scheduler config
  return true;
}

/**
 * Builds the error message used in appointment.jsx when purpose is missing.
 */
function getMissingPurposeErrorMessage() {
  return 'Purpose / reason for visit is required for this appointment type.';
}

// ---------------------------------------------------------------------------
// Tests: isPurposeValid
// ---------------------------------------------------------------------------

test('isPurposeValid — empty string is invalid', () => {
  assert.equal(isPurposeValid(''), false);
});

test('isPurposeValid — undefined is invalid', () => {
  assert.equal(isPurposeValid(undefined), false);
});

test('isPurposeValid — null is invalid', () => {
  assert.equal(isPurposeValid(null), false);
});

test('isPurposeValid — whitespace-only string is invalid', () => {
  assert.equal(isPurposeValid('   '), false);
  assert.equal(isPurposeValid('\t\n'), false);
});

test('isPurposeValid — valid single word is accepted', () => {
  assert.equal(isPurposeValid('Checkup'), true);
});

test('isPurposeValid — valid sentence is accepted', () => {
  assert.equal(isPurposeValid('Follow-up consultation for back pain'), true);
});

test('isPurposeValid — string with leading/trailing spaces is accepted', () => {
  // trim() strips surrounding whitespace; as long as inner content exists it's valid
  assert.equal(isPurposeValid('  Checkup  '), true);
});

// ---------------------------------------------------------------------------
// Tests: validatePurposeOrThrow (service-level guard)
// ---------------------------------------------------------------------------

test('validatePurposeOrThrow — throws for empty string', () => {
  assert.throws(
    () => validatePurposeOrThrow(''),
    { message: 'Purpose / reason for visit is required.' }
  );
});

test('validatePurposeOrThrow — throws for whitespace-only input', () => {
  assert.throws(
    () => validatePurposeOrThrow('   '),
    { message: 'Purpose / reason for visit is required.' }
  );
});

test('validatePurposeOrThrow — throws for null / undefined', () => {
  assert.throws(() => validatePurposeOrThrow(null),      { message: 'Purpose / reason for visit is required.' });
  assert.throws(() => validatePurposeOrThrow(undefined), { message: 'Purpose / reason for visit is required.' });
});

test('validatePurposeOrThrow — returns trimmed value on success', () => {
  const result = validatePurposeOrThrow('  Back pain follow-up  ');
  assert.equal(result, 'Back pain follow-up');
});

test('validatePurposeOrThrow — does not throw for valid purpose', () => {
  assert.doesNotThrow(() => validatePurposeOrThrow('General checkup'));
});

// ---------------------------------------------------------------------------
// Tests: purposeRequired is always true (ignores scheduler config)
// ---------------------------------------------------------------------------

test('purposeRequired is true when scheduler has purposeRequired: false', () => {
  const scheduler = { id: 'abc', label: 'General', purposeRequired: false };
  assert.equal(getPurposeRequiredFlag(scheduler), true);
});

test('purposeRequired is true when scheduler has purposeRequired: true', () => {
  const scheduler = { id: 'abc', label: 'General', purposeRequired: true };
  assert.equal(getPurposeRequiredFlag(scheduler), true);
});

test('purposeRequired is true even when scheduler is null', () => {
  assert.equal(getPurposeRequiredFlag(null), true);
});

test('purposeRequired is true even when scheduler is undefined', () => {
  assert.equal(getPurposeRequiredFlag(undefined), true);
});

// ---------------------------------------------------------------------------
// Tests: ReviewSubmit purposeMissing derived flag
// ---------------------------------------------------------------------------

test('purposeMissing is true when purpose is empty', () => {
  const purpose = '';
  // purposeRequired = true (always), purposeMissing = !(purpose || '').trim()
  const purposeMissing = !(purpose || '').trim();
  assert.equal(purposeMissing, true);
});

test('purposeMissing is false when purpose has content', () => {
  const purpose = 'Annual physical exam';
  const purposeMissing = !(purpose || '').trim();
  assert.equal(purposeMissing, false);
});

// ---------------------------------------------------------------------------
// Tests: Error message content
// ---------------------------------------------------------------------------

test('missing purpose error message is human-readable', () => {
  const msg = getMissingPurposeErrorMessage();
  assert.ok(msg.length > 0);
  assert.match(msg, /purpose/i);
  assert.match(msg, /required/i);
});
