import React from 'react';

export const Input = ({ label, required, error, reserveErrorSpace = false, className = '', ...props }) => (
  <div className="mb-1">
    {label && (
      <label className="form-label">
        {label}
        {required && <span className="text-error-500 ml-1">*</span>}
      </label>
    )}
    <input
      className={`form-input ${error ? 'border-error-500 focus:ring-error-500' : ''} ${className}`}
      {...props}
    />
    {(error || reserveErrorSpace) && (
      <p className={`mt-0.5 min-h-4 text-xs text-error-600 ${error ? '' : 'invisible'}`}>{error || ' '}</p>
    )}
  </div>
);

export const Select = ({ label, required, error, options, className = '', ...props }) => (
  <div className="mb-2">
    {label && (
      <label className="form-label">
        {label}
        {required && <span className="text-error-500 ml-1">*</span>}
      </label>
    )}
    <select
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
    {error && <p className="mt-0.5 text-xs text-error-600">{error}</p>}
  </div>
);

export const Checkbox = ({ label, ...props }) => (
  <div className="flex items-center mb-1">
    <input type="checkbox" className="form-checkbox" {...props} />
    {label && <label className="ml-2 text-xs text-secondary-700">{label}</label>}
  </div>
);

export const Textarea = ({ label, required, error, rows = 3, className = '', ...props }) => (
  <div className="mb-2">
    {label && (
      <label className="form-label">
        {label}
        {required && <span className="text-error-500 ml-1">*</span>}
      </label>
    )}
    <textarea
      className={`form-input min-h-[100px] ${error ? 'border-error-500 focus:ring-error-500' : ''} ${className}`}
      rows={rows}
      {...props}
    />
    {error && <p className="mt-0.5 text-xs text-error-600">{error}</p>}
  </div>
);

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
  <div className={`border-2 rounded-xl overflow-hidden transition-all duration-300 mb-4
                  ${isOpen
                    ? 'border-primary-500'
                    : 'border-neutral-200 hover:border-primary-300'}`}>
    <button
      type="button"
      onClick={() => onToggle(id)}
      className={`w-full flex items-center justify-between px-6 py-4 text-left
                 transition-all duration-200
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
    <div className={`transition-all duration-300 ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
      <div className="p-6 bg-white">
        {children}
      </div>
    </div>
  </div>
);
