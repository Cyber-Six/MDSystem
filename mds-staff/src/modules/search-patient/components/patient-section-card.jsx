import React from 'react';

export default function PatientSectionCard({ title, right, children }) {
  return (
    <section className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      <header className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50/70 dark:bg-neutral-700/30 flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-secondary-700 dark:text-neutral-300">{title}</h4>
        {right}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}
