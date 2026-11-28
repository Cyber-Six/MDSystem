import React, { useId, useState } from 'react';
import RecordDisclosure from './record-disclosure';

export default function AllergyOptionGroup({ label, selectedCount, children }) {
  const contentId = useId();
  const [open, setOpen] = useState(false);
  return (
    <div className="allergy-option-group">
      <button type="button" aria-expanded={open} aria-controls={contentId} onClick={() => setOpen(value => !value)} className="flex w-full items-center justify-between gap-3 px-3 py-2 cursor-pointer text-left text-sm font-medium">
        <span>{label}</span>
        <span className="text-xs rounded-full px-2 py-0.5 bg-neutral-100 dark:bg-neutral-700">{selectedCount} selected</span>
      </button>
      <RecordDisclosure id={contentId} open={open}>
        <div className="allergy-option-grid p-2">{children}</div>
      </RecordDisclosure>
    </div>
  );
}
