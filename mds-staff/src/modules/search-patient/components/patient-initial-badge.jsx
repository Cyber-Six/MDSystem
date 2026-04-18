import React from 'react';

const SIZE_CLASSES = {
  sm: 'h-5 w-5 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
};

const APPEARANCE_CLASSES = {
  gradient: 'bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-600 text-white shadow-sm ring-1 ring-black/5 dark:from-amber-300 dark:via-yellow-300 dark:to-amber-400 dark:text-neutral-900 dark:ring-white/10',
  solidYellow: 'bg-yellow-400 text-white ring-1 ring-black/5 dark:bg-yellow-400 dark:text-white dark:ring-white/10',
};

export default function PatientInitialBadge({ initials, size = 'md', appearance = 'solidYellow', className = '' }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold shrink-0 ${APPEARANCE_CLASSES[appearance] || APPEARANCE_CLASSES.gradient} ${SIZE_CLASSES[size] || SIZE_CLASSES.md} ${className}`}
    >
      {initials}
    </span>
  );
}