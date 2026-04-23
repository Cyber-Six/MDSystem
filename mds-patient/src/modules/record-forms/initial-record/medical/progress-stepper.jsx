import React from 'react';

const ProgressStepper = ({ currentStep, steps }) => {
  return (
    <div className="max-w-4xl mx-auto flex items-start">
      {steps.map((step, index) => (
        <React.Fragment key={index}>
          <div className="flex flex-col items-center flex-shrink-0">
            <div
              className={`progress-step ${
                index < currentStep
                  ? 'completed'
                  : index === currentStep
                  ? 'active'
                  : 'upcoming'
              }`}
            >
              {index < currentStep ? '✓' : index + 1}
            </div>
            <span className={`mt-1.5 text-xs text-center hidden sm:block whitespace-nowrap ${
              index <= currentStep
                ? 'text-primary-700 font-medium'
                : 'text-neutral-500'
            }`}>
              {step}
            </span>
          </div>

          {index < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 mt-4 ${
              index < currentStep ? 'bg-success-500' : 'bg-neutral-200'
            }`} />
          )}
        </React.Fragment>
      ))}
      </div>
  );
};

export default ProgressStepper;
