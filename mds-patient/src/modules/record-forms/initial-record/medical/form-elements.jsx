import React from 'react';
import RecordDisclosure from '../../record-disclosure';

export const Input = ({ id, label, required, error, reserveErrorSpace = false, className = '', ...props }) => {
  const generatedId = React.useId();
  const controlId = id ?? generatedId;
  return (
    <div className="mb-1">
      {label && (
        <label htmlFor={controlId} className="form-label">
          {label}
          {required && <span className="text-error-500 ml-1">*</span>}
        </label>
      )}
      <input
        id={controlId}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? controlId + '-error' : undefined}
        className={`form-input ${error ? 'border-error-500 focus:ring-error-500' : ''} ${className}`}
        {...props}
      />
      {(error || reserveErrorSpace) && (
        <p id={controlId + '-error'} className={`mt-0.5 min-h-4 text-xs text-error-600 ${error ? '' : 'invisible'}`}>{error || ' '}</p>
      )}
    </div>
  );
};

export const Select = ({ id, label, required, error, options, className = '', ...props }) => {
  const generatedId = React.useId();
  const controlId = id ?? generatedId;
  return (
    <div className="mb-2">
      {label && (
        <label htmlFor={controlId} className="form-label">
          {label}
          {required && <span className="text-error-500 ml-1">*</span>}
        </label>
      )}
      <select
        id={controlId}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? controlId + '-error' : undefined}
        className={`form-input ${error ? 'border-error-500 focus:ring-error-500' : ''} ${className}`}
        {...props}
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p id={controlId + '-error'} className="mt-0.5 text-xs text-error-600">{error}</p>}
    </div>
  );
};

export const Checkbox = ({ label, ...props }) => (
  <label className="flex items-center gap-2 mb-1 cursor-pointer">
    <input type="checkbox" className="form-checkbox" {...props} />
    {label && <span className="text-sm text-secondary-700">{label}</span>}
  </label>
);

export const Textarea = ({ id, label, required, error, rows = 3, className = '', ...props }) => {
  const generatedId = React.useId();
  const controlId = id ?? generatedId;
  return (
    <div className="mb-2">
      {label && (
        <label htmlFor={controlId} className="form-label">
          {label}
          {required && <span className="text-error-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        id={controlId}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? controlId + '-error' : undefined}
        className={`form-input min-h-[100px] ${error ? 'border-error-500 focus:ring-error-500' : ''} ${className}`}
        rows={rows}
        {...props}
      />
      {error && <p id={controlId + '-error'} className="mt-0.5 text-xs text-error-600">{error}</p>}
    </div>
  );
};

export const Button = ({ variant = 'primary', children, className = '', ...props }) => {
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    outline: 'btn-outline',
  };

  return (
    <button className={`${variantClasses[variant]} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
};

// Accordion Section Component for collapsible sections
export const AccordionSection = ({
  id,
  title,
  icon,
  isOpen,
  onToggle,
  children
}) => (
  <div className={`border-2 rounded-xl overflow-hidden transition-colors duration-300 mb-4
                  ${isOpen
                    ? 'border-primary-500'
                    : 'border-neutral-200 hover:border-primary-300'}`}>
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={() => onToggle(id)}
      className={`w-full min-h-13 flex items-center justify-between px-6 py-4 text-left
                 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset
                 ${isOpen
                   ? 'bg-primary-50'
                   : 'bg-neutral-50 hover:bg-primary-50/50'}`}
    >
      <div className="flex items-center gap-3">
        <span className="flex items-center justify-center flex-shrink-0">{icon}</span>
        <span className="font-semibold text-secondary-800">{title}</span>
      </div>
      <svg
        className={`w-5 h-5 text-secondary-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    <RecordDisclosure open={isOpen}>
      <div className="p-6 bg-white">
        {children}
      </div>
    </RecordDisclosure>
  </div>
);
