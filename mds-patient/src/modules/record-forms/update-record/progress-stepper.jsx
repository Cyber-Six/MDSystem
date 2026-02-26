import React from 'react';

const ProgressStepper = ({ currentStep, steps }) => {
  return (
    <div className="max-w-2xl mx-auto flex items-start">
      {steps.map((step, index) => (
        <React.Fragment key={index}>
          {/* Step Circle + Label below */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300
                ${
                  index < currentStep
                    ? 'bg-green-500 text-white'
                    : index === currentStep
                    ? 'bg-primary-500 text-white ring-4 ring-primary-300 dark:ring-primary-800'
                    : 'bg-stone-200 dark:bg-neutral-700 text-secondary-500 dark:text-neutral-400'
                }`}
            >
              {index < currentStep ? '✓' : index + 1}
            </div>
            <span className={`mt-1.5 text-xs text-center hidden sm:block whitespace-nowrap ${
              index <= currentStep
                ? 'text-primary-700 dark:text-primary-300 font-medium'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}>
              {step}
            </span>
          </div>

          {/* Connector Line — vertically centered on the circles */}
          {index < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 mt-4 ${
              index < currentStep ? 'bg-green-500' : 'bg-neutral-200 dark:bg-neutral-700'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default ProgressStepper;

