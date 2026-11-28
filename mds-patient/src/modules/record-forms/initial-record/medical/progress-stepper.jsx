import React, { useEffect, useRef, useState } from 'react';

const getScrollProgress = (element) => {
  const maxScroll = element.scrollHeight - element.clientHeight;
  return maxScroll > 0 ? Math.min(1, Math.max(0, element.scrollTop / maxScroll)) : 1;
};

export const getRecordScrollContainer = (anchor) => {
  for (let element = anchor; element && element !== document.body; element = element.parentElement) {
    if (/^(auto|scroll|overlay)$/.test(window.getComputedStyle(element).overflowY)) return element;
  }
  return null;
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

    const scrollElement = getRecordScrollContainer(anchor);
    const updateProgress = () => {
      const nextProgress = getScrollProgress(scrollElement || document.scrollingElement || document.documentElement);
      if (!hideVisual) setScrollProgress(nextProgress);
      onProgressChange?.({ currentStep: safeCurrentStep, steps, scrollProgress: nextProgress });
    };

    const eventTarget = scrollElement || window;
    eventTarget.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(updateProgress) : null;
    resizeObserver?.observe(scrollElement || document.documentElement);
    for (const child of (scrollElement || document.body).children) resizeObserver?.observe(child);
    updateProgress();

    return () => {
      resizeObserver?.disconnect();
      eventTarget.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
    };
  }, [scrollContainerRef, onProgressChange, safeCurrentStep, steps, trackScroll, hideVisual]);

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
              <span className="record-progress-track">
                <span
                  className="record-progress-fill"
                  style={{ width: `${segmentProgress * 100}%` }}
                />
              </span>
              <span className="record-progress-label mt-2 hidden text-xs leading-snug sm:block">
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
