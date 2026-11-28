import React, { useEffect, useRef, useState } from 'react';

const getScrollProgress = (element) => {
  if (!element) return 0;
  const maxScroll = element.scrollHeight - element.clientHeight;
  return maxScroll > 0 ? Math.min(1, Math.max(0, element.scrollTop / maxScroll)) : 0;
};

const ProgressStepper = ({
  currentStep,
  steps,
  scrollContainerRef,
  scrollProgress: externalScrollProgress,
  onProgressChange,
  trackScroll = true,
  hideVisual = false,
  compact = false,
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const stepperRef = useRef(null);
  const safeCurrentStep = Math.min(Math.max(currentStep, 0), steps.length - 1);
  const displayedScrollProgress = externalScrollProgress ?? scrollProgress;

  useEffect(() => {
    if (!trackScroll) return undefined;
    const anchor = scrollContainerRef?.current || stepperRef.current;
    if (typeof window === 'undefined') return undefined;

    let scrollElement = anchor;
    while (scrollElement && scrollElement !== document.body) {
      const { overflowY } = window.getComputedStyle(scrollElement);
      if (/(auto|scroll)/.test(overflowY) && scrollElement.scrollHeight > scrollElement.clientHeight) break;
      scrollElement = scrollElement.parentElement;
    }

    const usesWindow = !scrollElement || scrollElement === document.body;
    const updateProgress = () => {
      let nextProgress;
      if (!usesWindow) {
        nextProgress = getScrollProgress(scrollElement);
      } else {
        const root = document.documentElement;
        const maxScroll = root.scrollHeight - window.innerHeight;
        nextProgress = maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
      }
      setScrollProgress(nextProgress);
      onProgressChange?.({ currentStep: safeCurrentStep, steps, scrollProgress: nextProgress });
    };

    const eventTarget = usesWindow ? window : scrollElement;
    eventTarget.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    updateProgress();

    return () => {
      eventTarget.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
    };
  }, [scrollContainerRef, onProgressChange, safeCurrentStep, steps, trackScroll]);

  if (hideVisual) return null;

  const overallProgress = Math.max(0, safeCurrentStep + displayedScrollProgress);

  return (
    <nav ref={stepperRef} aria-label="Record progress" className={compact
      ? 'record-progress px-4 pb-2 sm:px-6'
      : 'record-progress sticky top-0 z-20 mb-6 rounded-xl border border-primary-200 bg-primary-50 p-4 shadow-sm dark:border-primary-800 dark:bg-primary-950/95'}>
      {!compact && (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-base font-semibold text-secondary-900 dark:text-primary-100">{steps[safeCurrentStep]}</p>
          <p className="text-sm text-secondary-600 dark:text-primary-200">Step {safeCurrentStep + 1} of {steps.length}</p>
        </div>
      )}
      <div
        className="sr-only"
        role="progressbar"
        aria-label="Form completion"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={Math.min(steps.length, overallProgress)}
        aria-valuetext={`Step ${safeCurrentStep + 1} of ${steps.length}`}
      />
      <ol aria-label="Record steps" className="flex gap-1.5 sm:gap-2">
        {steps.map((step, index) => {
          const segmentProgress = index < safeCurrentStep
            ? 1
            : index === safeCurrentStep
              ? displayedScrollProgress
              : 0;

          return (
            <li key={step} aria-current={index === safeCurrentStep ? 'step' : undefined} className="min-w-0 flex-1">
              <span className="block h-1.5 overflow-hidden rounded-full bg-primary-200 dark:bg-neutral-600">
                <span
                  className="block h-full rounded-full bg-primary-500 transition-[width] duration-200 ease-out"
                  style={{ width: `${segmentProgress * 100}%` }}
                />
              </span>
              <span className={'mt-2 hidden text-xs leading-snug sm:block ' + (index === safeCurrentStep ? 'font-semibold text-secondary-900 dark:text-primary-100' : 'text-secondary-500 dark:text-neutral-400')}>
                {step}
              </span>
              <span className="sr-only sm:hidden">{step}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default ProgressStepper;
