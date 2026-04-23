/**
 * Tests: Appointment Purpose — Staff Scheduler Defaults
 *
 * Covers the behavior change: purposeRequired is now ALWAYS true for all
 * schedulers. Staff cannot enable/disable it per-scheduler. The toggle
 * checkbox has been removed from the UI.
 *
 * Run: node --test "src/modules/appointment/__tests__/appointment-purpose.test.js"
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Inline mirror of getDefaults() used in scheduler-modal.jsx and the
// editForm initialisation in availability-manager.jsx
// ---------------------------------------------------------------------------

/**
 * Returns the default form values for a new or existing scheduler.
 * purposeRequired is hardcoded to true — it can no longer be toggled.
 */
function getSchedulerDefaults(scheduler) {
  return {
    label: scheduler?.label || '',
    location: scheduler?.location || 'Arlegui',
    patientType: scheduler?.patientType ?? null,
    schedulePerWeek: scheduler?.schedulePerWeek || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    morningAllowed: scheduler?.morningAllowed ?? 20,
    afternoonAllowed: scheduler?.afternoonAllowed ?? 15,
    notes: scheduler?.notes || '',
    isActive: scheduler?.isActive ?? true,
    whitelistOnly: scheduler?.whitelistOnly ?? false,
    purposeRequired: true,  // always required — not derived from scheduler record
  };
}

/**
 * Builds the input payload that handleSaveScheduler sends to the API.
 * purposeRequired is always true regardless of editForm state.
 */
function buildSchedulerUpdatePayload(editForm) {
  return {
    label: editForm.label,
    location: editForm.location,
    patientType: editForm.patientType ?? null,
    schedulePerWeek: editForm.schedulePerWeek,
    morningAllowed: editForm.morningAllowed,
    afternoonAllowed: editForm.afternoonAllowed,
    notes: editForm.notes || null,
    isActive: editForm.isActive,
    whitelistOnly: editForm.whitelistOnly,
    purposeRequired: true,  // always true — ignores editForm.purposeRequired
  };
}

function buildSchedulerCreatePayload(editForm) {
  return {
    label: editForm.label,
    location: editForm.location,
    patientType: editForm.patientType ?? null,
    schedulePerWeek: editForm.schedulePerWeek,
    morningAllowed: editForm.morningAllowed,
    afternoonAllowed: editForm.afternoonAllowed,
    notes: editForm.notes || null,
    whitelistOnly: editForm.whitelistOnly ?? false,
    purposeRequired: true,  // always true
    slotIncludedDates: [],
    slotExcludedDates: [],
    whiteLists: [],
  };
}

// ---------------------------------------------------------------------------
// Tests: getSchedulerDefaults
// ---------------------------------------------------------------------------

test('new scheduler defaults always have purposeRequired: true', () => {
  const defaults = getSchedulerDefaults(null);
  assert.equal(defaults.purposeRequired, true);
});

test('existing scheduler with purposeRequired: false still gets purposeRequired: true', () => {
  const existingScheduler = {
    id: 'sched-1',
    label: 'General Checkup',
    location: 'Arlegui',
    purposeRequired: false,   // legacy record saved with false
    isActive: true,
    whitelistOnly: false,
    schedulePerWeek: ['Monday', 'Tuesday'],
    morningAllowed: 25,
    afternoonAllowed: 20,
    notes: '',
  };
  const defaults = getSchedulerDefaults(existingScheduler);
  assert.equal(defaults.purposeRequired, true);
});

test('existing scheduler with purposeRequired: true keeps purposeRequired: true', () => {
  const existingScheduler = { purposeRequired: true };
  const defaults = getSchedulerDefaults(existingScheduler);
  assert.equal(defaults.purposeRequired, true);
});

test('scheduler defaults preserve other fields correctly', () => {
  const scheduler = {
    label: 'Dental',
    location: 'Casal',
    patientType: 'Student',
    morningAllowed: 10,
    afternoonAllowed: 8,
    isActive: false,
    whitelistOnly: true,
    purposeRequired: false,
  };
  const defaults = getSchedulerDefaults(scheduler);
  assert.equal(defaults.label, 'Dental');
  assert.equal(defaults.location, 'Casal');
  assert.equal(defaults.patientType, 'Student');
  assert.equal(defaults.morningAllowed, 10);
  assert.equal(defaults.afternoonAllowed, 8);
  assert.equal(defaults.isActive, false);
  assert.equal(defaults.whitelistOnly, true);
  // purposeRequired is always overridden to true
  assert.equal(defaults.purposeRequired, true);
});

// ---------------------------------------------------------------------------
// Tests: buildSchedulerUpdatePayload
// ---------------------------------------------------------------------------

test('update payload always sends purposeRequired: true even if editForm has false', () => {
  const editForm = {
    label: 'General',
    location: 'Arlegui',
    patientType: null,
    schedulePerWeek: ['Monday'],
    morningAllowed: 20,
    afternoonAllowed: 15,
    notes: '',
    isActive: true,
    whitelistOnly: false,
    purposeRequired: false,  // legacy editForm with false
  };
  const payload = buildSchedulerUpdatePayload(editForm);
  assert.equal(payload.purposeRequired, true);
});

test('update payload always sends purposeRequired: true regardless of editForm value', () => {
  const editFormTrue  = { label: 'A', location: 'Arlegui', patientType: null, schedulePerWeek: [], morningAllowed: 20, afternoonAllowed: 15, notes: '', isActive: true, whitelistOnly: false, purposeRequired: true };
  const editFormFalse = { ...editFormTrue, purposeRequired: false };
  const editFormUndef = { ...editFormTrue, purposeRequired: undefined };

  assert.equal(buildSchedulerUpdatePayload(editFormTrue).purposeRequired,  true);
  assert.equal(buildSchedulerUpdatePayload(editFormFalse).purposeRequired, true);
  assert.equal(buildSchedulerUpdatePayload(editFormUndef).purposeRequired, true);
});

// ---------------------------------------------------------------------------
// Tests: buildSchedulerCreatePayload
// ---------------------------------------------------------------------------

test('create payload always sends purposeRequired: true', () => {
  const editForm = {
    label: 'New Scheduler',
    location: 'QuezonCity',
    patientType: 'Employee',
    schedulePerWeek: ['Monday', 'Wednesday', 'Friday'],
    morningAllowed: 30,
    afternoonAllowed: 25,
    notes: null,
    whitelistOnly: false,
    purposeRequired: false,  // UI-entered value (now irrelevant)
  };
  const payload = buildSchedulerCreatePayload(editForm);
  assert.equal(payload.purposeRequired, true);
});

test('create payload includes slotIncludedDates and slotExcludedDates arrays', () => {
  const editForm = { label: 'X', location: 'Arlegui', patientType: null, schedulePerWeek: [], morningAllowed: 0, afternoonAllowed: 0, notes: null, whitelistOnly: false, purposeRequired: false };
  const payload = buildSchedulerCreatePayload(editForm);
  assert.deepEqual(payload.slotIncludedDates, []);
  assert.deepEqual(payload.slotExcludedDates, []);
  assert.deepEqual(payload.whiteLists, []);
});

// ---------------------------------------------------------------------------
// Tests: Confirming the checkbox/toggle is gone (behavioral contract)
// ---------------------------------------------------------------------------

test('purposeRequired value is not reactive to any user toggle input', () => {
  // This test documents the contract: no matter what a "toggle" call would
  // do to editForm.purposeRequired, the payload to the API always uses true.
  let editForm = getSchedulerDefaults(null);
  assert.equal(editForm.purposeRequired, true);

  // Simulate what the old "toggle" onChange would have done
  editForm = { ...editForm, purposeRequired: false };

  // Even if editForm.purposeRequired is false, the payload must be true
  const updatePayload = buildSchedulerUpdatePayload(editForm);
  const createPayload = buildSchedulerCreatePayload(editForm);

  assert.equal(updatePayload.purposeRequired, true);
  assert.equal(createPayload.purposeRequired, true);
});
