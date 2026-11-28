import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ListFilter } from 'lucide-react';
import { STATUS_OPTIONS } from './request-list-utils';
import './requests.css';

export default function StatusFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);
  const summary = useMemo(() => {
    if (value.length === STATUS_OPTIONS.length) return 'All statuses';
    if (!value.length) return 'No statuses';
    return value.map((status) => STATUS_OPTIONS.find((option) => option.value === status)?.label || status).join(', ');
  }, [value]);

  const toggle = (status) => {
    if (value.includes(status)) {
      if (value.length > 1) onChange(value.filter((item) => item !== status));
    } else onChange([...value, status]);
  };

  return <div className="request-status-picker" ref={pickerRef}>
    <span className="request-picker-label">Status</span>
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary aria-label={`Statuses: ${summary}`}>
        <ListFilter size={16} aria-hidden="true" />
        <span>{summary}</span>
        <span className="request-status-count">{value.length}</span>
        <ChevronDown size={15} className="request-picker-chevron" aria-hidden="true" />
      </summary>
      {open && <div className="request-status-menu" aria-label="Filter by status">
        <div className="request-status-menu-heading">
          <span>Show requests with</span>
          <button type="button" onClick={() => onChange(STATUS_OPTIONS.map(({ value: status }) => status))}>Select all</button>
        </div>
        {STATUS_OPTIONS.map(({ value: status, label }) => {
          const checked = value.includes(status);
          return <label key={status} className="request-status-option">
            <input type="checkbox" checked={checked} onChange={() => toggle(status)} />
            <span className="request-checkbox" aria-hidden="true">{checked && <Check size={13} />}</span>
            <span>{label}</span>
          </label>;
        })}
        <p className="request-status-hint">Choose one or more statuses.</p>
      </div>}
    </details>
  </div>;
}
