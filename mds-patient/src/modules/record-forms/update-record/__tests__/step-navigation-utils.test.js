import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUpdateRecordSteps,
  clampStepIndex,
  getBackButtonState,
} from '../step-navigation-utils.js';

test('buildUpdateRecordSteps includes Personal/Medical/Review for medical update', () => {
  const steps = buildUpdateRecordSteps({
    effectiveRecordType: 'medical',
    skipPersonalStep: false,
  });

  assert.deepEqual(steps, ['Personal Info', 'Medical History', 'Review & Submit']);
});

test('buildUpdateRecordSteps includes all sections for both update', () => {
  const steps = buildUpdateRecordSteps({
    effectiveRecordType: 'both',
    skipPersonalStep: false,
  });

  assert.deepEqual(steps, [
    'Personal Info',
    'Medical History',
    'Dental History',
    'Review & Submit',
  ]);
});

test('clampStepIndex prevents overrun that causes Step 6 of 5', () => {
  assert.equal(clampStepIndex(5, 5), 4);
  assert.equal(clampStepIndex(4, 5), 4);
  assert.equal(clampStepIndex(0, 5), 0);
});

test('getBackButtonState returns Cancel on first step when choice page exists', () => {
  const state = getBackButtonState({
    currentStep: 0,
    canReturnToChoicePage: true,
  });

  assert.deepEqual(state, {
    label: 'Cancel',
    disabled: false,
    action: 'cancel-to-choice',
  });
});

test('getBackButtonState returns disabled Back on first step when choice page is hidden', () => {
  const state = getBackButtonState({
    currentStep: 0,
    canReturnToChoicePage: false,
  });

  assert.deepEqual(state, {
    label: 'Back',
    disabled: true,
    action: 'none',
  });
});

test('getBackButtonState returns enabled Back after first step', () => {
  const state = getBackButtonState({
    currentStep: 2,
    canReturnToChoicePage: true,
  });

  assert.deepEqual(state, {
    label: 'Back',
    disabled: false,
    action: 'back',
  });
});
