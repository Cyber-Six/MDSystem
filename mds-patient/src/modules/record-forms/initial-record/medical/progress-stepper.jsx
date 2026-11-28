import React from 'react';

const ProgressStepper = ({ currentStep, steps }) => (
  <nav aria-label="Record progress" className="record-progress rounded-xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-950/40">
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <p className="text-base font-semibold text-secondary-900 dark:text-primary-100">{steps[currentStep]}</p>
      <p className="text-sm text-secondary-600 dark:text-primary-200">Step {currentStep + 1} of {steps.length}</p>
    </div>
    <ol className="flex gap-1.5 sm:gap-2">
      {steps.map((step, index) => (
        <li key={step} aria-current={index === currentStep ? 'step' : undefined} className="min-w-0 flex-1">
          <span className={'block h-1.5 rounded-full ' + (index <= currentStep ? 'bg-primary-500' : 'bg-primary-200 dark:bg-neutral-600')} />
          <span className={'mt-2 hidden text-xs leading-snug sm:block ' + (index === currentStep ? 'font-semibold text-secondary-900 dark:text-primary-100' : 'text-secondary-500 dark:text-neutral-400')}>
            {step}
          </span>
          <span className="sr-only sm:hidden">{step}</span>
        </li>
      ))}
    </ol>
  </nav>
);

export default ProgressStepper;
