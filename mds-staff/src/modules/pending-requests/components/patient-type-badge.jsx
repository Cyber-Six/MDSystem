import React from 'react';

const typeStyles = {
  Student: 'bg-accent-50 text-accent-800 ring-accent-200 dark:bg-accent-900/30 dark:text-accent-200 dark:ring-accent-700',
  Employee: 'bg-secondary-100 text-secondary-800 ring-secondary-200 dark:bg-secondary-900/40 dark:text-secondary-200 dark:ring-secondary-600',
};

export default function PatientTypeBadge({ profileType }) {
  const knownType = Object.hasOwn(typeStyles, profileType);
  const label = knownType ? profileType : 'Type unavailable';
  const style = knownType
    ? typeStyles[profileType]
    : 'bg-neutral-100 text-neutral-600 ring-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:ring-neutral-600';

  return (
    <span
      aria-label={`Patient type: ${label}`}
      className={`inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      {label}
    </span>
  );
}
