import React from 'react';

const ProgressStepper = ({ currentStep, steps }) => {
  return (
    <div>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={index}>
            {/* Step Circle */}
            <div className="flex flex-col items-center flex-1">
              <div className="relative">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                    ${
                      index < currentStep
                        ? 'bg-success-500 border-success-500 text-white'
                        : index === currentStep
                        ? 'bg-primary-500 border-primary-500 text-white'
                        : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-400 dark:text-neutral-500'
                    }`}
                >
                  {index < currentStep ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <span className="text-sm font-bold">{index + 1}</span>
                  )}
                </div>
              </div>
              {/* Hide text on small screens */}
              <div className="mt-3 text-center hidden sm:block">
                <p
                  className={`text-sm font-medium transition-colors duration-300 ${
                    index <= currentStep
                      ? 'text-secondary-800 dark:text-white'
                      : 'text-neutral-400 dark:text-neutral-500'
                  }`}
                >
                  {step}
                </p>
              </div>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 sm:mx-4 -mt-0 sm:-mt-8 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-700">
                <div
                  className={`h-full transition-all duration-500 ease-out ${
                    index < currentStep
                      ? 'bg-success-500 w-full'
                      : 'bg-transparent w-0'
                  }`}
                  style={{ width: index < currentStep ? '100%' : '0%' }}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default ProgressStepper;
