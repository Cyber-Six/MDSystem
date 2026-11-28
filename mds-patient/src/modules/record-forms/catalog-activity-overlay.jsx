import React from 'react';

export default function CatalogActivityOverlay({ action }) {
  if (!action) return null;
  return (
    <span className="pointer-events-none absolute right-3 top-3 z-10 text-primary-600 dark:text-primary-400" role="status" aria-live="polite" aria-busy="true" aria-label={action === 'adding' ? 'Adding option' : 'Searching options'}>
      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
      </svg>
    </span>
  );
}
