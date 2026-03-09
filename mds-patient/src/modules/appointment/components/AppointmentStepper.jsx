import React from 'react';
import { STEP_LABELS } from './shared';

const AppointmentStepper = ({ step }) => (
  <div className="mb-8">
    <div className="max-w-2xl mx-auto flex items-start">
      {STEP_LABELS.map((label, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center flex-shrink-0">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold
              ${i < step ? 'bg-green-500 text-white' : i === step ? 'bg-primary-500 text-secondary-900 ring-4 ring-primary-300 dark:ring-primary-800' : 'bg-stone-200 dark:bg-neutral-700 text-secondary-500 dark:text-neutral-400'}`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`mt-1.5 text-xs text-center hidden sm:block whitespace-nowrap ${i <= step ? 'text-primary-700 dark:text-primary-300 font-medium' : 'text-neutral-500 dark:text-neutral-400'}`}>
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 mt-4 ${i < step ? 'bg-green-500' : 'bg-neutral-200 dark:bg-neutral-700'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  </div>
);

export default AppointmentStepper;
