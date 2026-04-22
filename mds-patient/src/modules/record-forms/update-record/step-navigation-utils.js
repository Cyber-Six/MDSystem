export const buildUpdateRecordSteps = ({ effectiveRecordType, skipPersonalStep = false }) => {
  if (!effectiveRecordType) {
    return skipPersonalStep ? [] : ['Personal Info'];
  }

  const steps = skipPersonalStep ? [] : ['Personal Info'];

  if (effectiveRecordType === 'medical' || effectiveRecordType === 'both') {
    steps.push('Medical History');
  }

  if (effectiveRecordType === 'dental' || effectiveRecordType === 'both') {
    steps.push('Dental History');
  }

  steps.push('Review & Submit');
  return steps;
};

export const clampStepIndex = (currentStep, stepsLength) => {
  if (!Number.isFinite(stepsLength) || stepsLength <= 0) {
    return 0;
  }

  if (!Number.isFinite(currentStep) || currentStep <= 0) {
    return 0;
  }

  return Math.min(currentStep, stepsLength - 1);
};

export const getBackButtonState = ({ currentStep, canReturnToChoicePage }) => {
  const isFirstStep = currentStep <= 0;

  if (isFirstStep && canReturnToChoicePage) {
    return {
      label: 'Cancel',
      disabled: false,
      action: 'cancel-to-choice',
    };
  }

  if (isFirstStep) {
    return {
      label: 'Back',
      disabled: true,
      action: 'none',
    };
  }

  return {
    label: 'Back',
    disabled: false,
    action: 'back',
  };
};