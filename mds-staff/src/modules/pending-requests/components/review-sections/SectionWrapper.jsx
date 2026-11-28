import React, { useId } from 'react';
import { LockKeyhole, Pencil } from 'lucide-react';

export const hasReviewValue = (value) =>
  value != null && (typeof value !== 'string' || value.trim() !== '');

export const formatReviewDate = (value) => {
  if (!hasReviewValue(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
    : String(value);
};

export default function SectionWrapper({
  title,
  isLocked = false,
  children,
  isEditing = false,
  onToggleEdit,
  hasEdits = false,
  isPending = false,
}) {
  const headingId = useId();
  return (
    <section data-review-section={title} aria-labelledby={headingId} className="record-review-card">
      <div className="record-review-card-header">
        <h3 id={headingId}>{title}</h3>
        {isLocked ? (
          <span className="flex items-center gap-1.5 text-xs text-secondary-600 dark:text-neutral-300">
            <LockKeyhole size={14} aria-hidden="true" />
            Restricted
          </span>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-x-2">
            {hasEdits && <span className="text-xs font-medium text-warning-700 dark:text-warning-300">Modified by Staff</span>}
            {isPending && onToggleEdit && (
              <button type="button" onClick={onToggleEdit} className="record-review-edit" aria-label={`${isEditing ? 'Done editing' : 'Edit'} ${title}`}>
                {!isEditing && <Pencil size={14} aria-hidden="true" />}
                {isEditing ? 'Done' : 'Edit'}
              </button>
            )}
          </div>
        )}
      </div>
      {!isLocked && (
        <div className="record-review-card-body">
          {children}
          {isPending && onToggleEdit && isEditing && (
            <div className="flex justify-end">
              <button type="button" onClick={onToggleEdit} className="record-review-edit">OK</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export const ReviewGroup = ({ title, children, ...props }) => (
  <div className="record-review-group" {...props}>
    <h4>{title}</h4>
    {children}
  </div>
);

const displayValue = (value) => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;

const ReviewRow = ({ label, children }) => (
  <div className="record-review-row">
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
);

export const DataRow = ({ label, value, isEdited = false, originalValue }) => {
  if (!hasReviewValue(value) && !isEdited) return null;
  return (
    <ReviewRow label={label}>
      {isEdited && hasReviewValue(originalValue) && (
        <span className="mr-2 text-xs line-through text-secondary-500 dark:text-neutral-400">{displayValue(originalValue)}</span>
      )}
      {hasReviewValue(value) ? displayValue(value) : <span className="text-secondary-500 dark:text-neutral-400">Cleared</span>}
      {isEdited && <span className="ml-2 text-xs font-medium text-warning-700 dark:text-warning-300">(edited)</span>}
    </ReviewRow>
  );
};

export const ReviewNote = ({ label, value }) => hasReviewValue(value) && (
  <dl className="record-review-note">
    <dt>{label}</dt>
    <dd>{value}</dd>
  </dl>
);

export const ReviewChip = ({ tone, children, detail, ...props }) => (
  <span className="record-review-chip" data-tone={tone} {...props}>
    {children}
    {detail && <span className="font-normal">{detail}</span>}
  </span>
);

export const EditableField = ({
  label,
  value,
  isEditing = false,
  onChange,
  type = 'text',
  placeholder,
  options,
  originalValue,
  maxLength,
}) => {
  const fieldId = useId();
  const isEdited = originalValue !== undefined && value !== originalValue;

  if (!isEditing) {
    const formatted = type === 'date' ? formatReviewDate(value) : value;
    const original = type === 'date' ? formatReviewDate(originalValue) : originalValue;
    return <DataRow label={label} value={formatted} isEdited={isEdited} originalValue={original} />;
  }

  const fieldProps = {
    id: fieldId,
    value: value ?? '',
    onChange: (event) => onChange?.(event.target.value),
    className: 'record-review-input',
  };

  return (
    <ReviewRow label={<label htmlFor={fieldId}>{label}</label>}>
      {isEdited && hasReviewValue(originalValue) && (
        <span className="mb-1 block text-xs line-through text-secondary-500 dark:text-neutral-400">
          Original: {displayValue(originalValue)}
        </span>
      )}
      {type === 'select' && options ? (
        <select {...fieldProps}>
          {!hasReviewValue(value) && <option value="" disabled>Select an option</option>}
          {options.map((option) => (
            <option key={option.value ?? option} value={option.value ?? option}>
              {option.label ?? option}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea {...fieldProps} rows={2} placeholder={placeholder} />
      ) : (
        <input {...fieldProps} type={type} maxLength={maxLength} placeholder={placeholder} />
      )}
    </ReviewRow>
  );
};

export const SectionSkeleton = () => (
  <div aria-hidden="true" className="record-review-card motion-safe:animate-pulse">
    <div className="record-review-card-header">
      <div className="h-4 w-1/3 rounded bg-neutral-200 dark:bg-neutral-700" />
    </div>
    <div className="record-review-card-body">
      {[1, 2, 3].map((row) => (
        <div key={row} className="h-3 w-3/4 rounded bg-neutral-100 dark:bg-neutral-700/50" />
      ))}
    </div>
  </div>
);
