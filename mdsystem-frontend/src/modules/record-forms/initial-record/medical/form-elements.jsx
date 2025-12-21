import React from 'react';

export const Input = ({ label, required, error, ...props }) => (
  <div className="mb-4">
    {label && (
      <label className="form-label">
        {label}
        {required && <span className="text-error-500 ml-1">*</span>}
      </label>
    )}
    <input
      className={`form-input ${error ? 'border-error-500 focus:ring-error-500' : ''}`}
      {...props}
    />
    {error && <p className="mt-1 text-sm text-error-600">{error}</p>}
  </div>
);

export const Select = ({ label, required, error, options, ...props }) => (
  <div className="mb-4">
    {label && (
      <label className="form-label">
        {label}
        {required && <span className="text-error-500 ml-1">*</span>}
      </label>
    )}
    <select
      className={`form-input ${error ? 'border-error-500 focus:ring-error-500' : ''}`}
      {...props}
    >
      <option value="">Select...</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    {error && <p className="mt-1 text-sm text-error-600">{error}</p>}
  </div>
);

export const Checkbox = ({ label, ...props }) => (
  <div className="flex items-center mb-2">
    <input type="checkbox" className="form-checkbox" {...props} />
    {label && <label className="ml-2 text-sm text-secondary-700">{label}</label>}
  </div>
);

export const Textarea = ({ label, required, error, ...props }) => (
  <div className="mb-4">
    {label && (
      <label className="form-label">
        {label}
        {required && <span className="text-error-500 ml-1">*</span>}
      </label>
    )}
    <textarea
      className={`form-input min-h-[100px] ${error ? 'border-error-500 focus:ring-error-500' : ''}`}
      {...props}
    />
    {error && <p className="mt-1 text-sm text-error-600">{error}</p>}
  </div>
);

export const Button = ({ variant = 'primary', children, ...props }) => {
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    outline: 'btn-outline',
  };

  return (
    <button className={variantClasses[variant]} {...props}>
      {children}
    </button>
  );
};
