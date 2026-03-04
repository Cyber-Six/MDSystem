import React, { useState } from 'react';

/**
 * SectionWrapper
 *
 * Shared chrome for each review section:
 *  - Collapsible header with title and scope badge
 *  - Edit toggle with DPA-compliant reason field
 *  - "Modified by Staff" indicator
 *  - Locked state for role-based restrictions
 */
const SectionWrapper = ({
  title,
  icon,
  scopeLabel,      // 'Medical' | 'Dental'
  isLocked = false, // true if staff role can't access this section
  children,
  isEditing = false,
  onToggleEdit,
  editReason = '',
  onEditReasonChange,
  hasEdits = false,
  isPending = false,  // show edit button only for actionable statuses
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const scopeColors = {
    Medical: 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400',
    Dental: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
  };

  if (isLocked) {
    return (
      <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden opacity-60">
        <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 flex items-center gap-3">
          {icon && <span className="text-neutral-400 dark:text-neutral-500">{icon}</span>}
          <h3 className="text-sm font-semibold text-secondary-900 dark:text-white uppercase tracking-wide flex-1">
            {title}
          </h3>
          <span className="inline-flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-700 px-2 py-1 rounded">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Not accessible
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center gap-3 cursor-pointer select-none"
        onClick={() => setCollapsed((c) => !c)}
      >
        {icon && <span className="text-secondary-600 dark:text-neutral-400">{icon}</span>}
        <h3 className="text-sm font-semibold text-secondary-900 dark:text-white uppercase tracking-wide flex-1">
          {title}
        </h3>

        {/* Scope badge */}
        {scopeLabel && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${scopeColors[scopeLabel] ?? 'bg-neutral-100 text-neutral-600'}`}>
            {scopeLabel}
          </span>
        )}

        {/* Modified indicator */}
        {hasEdits && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-700 dark:text-warning-400 bg-warning-100 dark:bg-warning-900/30 px-2 py-0.5 rounded">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Modified by Staff
          </span>
        )}

        {/* Edit toggle (only when pending) */}
        {isPending && onToggleEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleEdit();
            }}
            className={`text-xs font-medium px-2 py-1 rounded transition-colors inline-flex items-center gap-1 ${
              isEditing
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                : 'bg-white dark:bg-neutral-700 text-secondary-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-600'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {isEditing ? 'Editing' : 'Edit'}
          </button>
        )}

        {/* Collapse chevron */}
        <svg
          className={`w-4 h-4 text-secondary-400 dark:text-neutral-500 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="p-4 space-y-4">
          {/* DPA reason field when editing */}
          {isEditing && (
            <div className="bg-warning-50 dark:bg-warning-900/10 border border-warning-200 dark:border-warning-800 rounded-lg p-3">
              <label className="block text-xs font-semibold text-warning-800 dark:text-warning-400 mb-1">
                Edit Reason (required for DPA compliance)
              </label>
              <input
                type="text"
                value={editReason}
                onChange={(e) => onEditReasonChange?.(e.target.value)}
                placeholder="e.g., Corrected typo in patient name, Fixed date format..."
                className="w-full px-3 py-1.5 text-sm border border-warning-300 dark:border-warning-700 rounded-lg bg-white dark:bg-neutral-800 text-secondary-900 dark:text-white focus:ring-2 focus:ring-warning-500 focus:border-warning-500"
              />
              <p className="mt-1 text-xs text-warning-600 dark:text-warning-500">
                All edits are logged for Data Privacy Act compliance.
              </p>
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
};

export default SectionWrapper;

/**
 * DataRow — Reusable key-value display row
 */
export const DataRow = ({ label, value, isEdited = false, originalValue }) => {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="grid grid-cols-3 gap-4 py-2 border-b border-neutral-100 dark:border-neutral-700/50">
      <dt className="font-medium text-secondary-600 dark:text-neutral-400 text-sm">{label}</dt>
      <dd className="col-span-2 text-secondary-900 dark:text-white text-sm">
        {isEdited && originalValue !== undefined && (
          <span className="line-through text-secondary-400 dark:text-neutral-500 mr-2 text-xs">{originalValue}</span>
        )}
        {value}
        {isEdited && (
          <span className="ml-2 text-xs text-warning-600 dark:text-warning-400 font-medium">
            (edited)
          </span>
        )}
      </dd>
    </div>
  );
};

/**
 * EditableField — Inline editable field for review sections
 */
export const EditableField = ({
  label,
  value,
  isEditing = false,
  onChange,
  type = 'text',
  placeholder,
  options,        // for select type
  originalValue,
}) => {
  const isEdited = originalValue !== undefined && value !== originalValue;

  if (!isEditing) {
    return <DataRow label={label} value={value} isEdited={isEdited} originalValue={originalValue} />;
  }

  return (
    <div className="grid grid-cols-3 gap-4 py-2 border-b border-neutral-100 dark:border-neutral-700/50">
      <dt className="font-medium text-secondary-600 dark:text-neutral-400 text-sm pt-1.5">{label}</dt>
      <dd className="col-span-2">
        {isEdited && originalValue !== undefined && (
          <span className="line-through text-secondary-400 dark:text-neutral-500 text-xs block mb-1">
            Original: {originalValue}
          </span>
        )}
        {type === 'select' && options ? (
          <select
            value={value ?? ''}
            onChange={(e) => onChange?.(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          >
            {options.map((opt) => (
              <option key={opt.value ?? opt} value={opt.value ?? opt}>
                {opt.label ?? opt}
              </option>
            ))}
          </select>
        ) : type === 'textarea' ? (
          <textarea
            value={value ?? ''}
            onChange={(e) => onChange?.(e.target.value)}
            rows={2}
            placeholder={placeholder}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 resize-none"
          />
        ) : (
          <input
            type={type}
            value={value ?? ''}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          />
        )}
      </dd>
    </div>
  );
};

/**
 * SectionSkeleton — Loading placeholder for a section
 */
export const SectionSkeleton = ({ title }) => (
  <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden animate-pulse">
    <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3" />
    </div>
    <div className="p-4 space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="grid grid-cols-3 gap-4">
          <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded" />
          <div className="col-span-2 h-3 bg-neutral-100 dark:bg-neutral-700/50 rounded" />
        </div>
      ))}
    </div>
  </div>
);
