import React from 'react';

export default function AllergyOptionGroup({ label, selectedCount, children }) {
  return (
    <details className="allergy-option-group">
      <summary className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500">
        <span>{label}</span>
        <span className="text-xs rounded-full px-2 py-0.5 bg-neutral-100 dark:bg-neutral-700">{selectedCount} selected</span>
      </summary>
      <div className="allergy-option-grid p-2">{children}</div>
    </details>
  );
}
