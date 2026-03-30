import React from 'react';

export const Input = ({ label, required, error, reserveErrorSpace = false, className = '', ...props }) => (
  <div className="mb-2">
    {label && (
      <label className="block text-xs font-medium text-secondary-700 dark:text-primary-500 mb-1">
        {label}
        {required && <span className="text-error-500 ml-1">*</span>}
      </label>
    )}
    <input
      className={`w-full px-3 py-2 text-sm text-secondary-800 bg-white border border-neutral-300 rounded-lg
                 transition-all duration-200
                 hover:border-primary-400
                 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                 placeholder:text-neutral-400
                 dark:bg-neutral-800 dark:border-neutral-600 dark:text-white dark:placeholder:text-neutral-500
                 dark:hover:border-primary-500 dark:focus:border-primary-500
                 ${error ? 'border-error-500 focus:ring-error-500/20 focus:border-error-500' : ''}
                 ${className}`}
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
      <label className="block text-xs font-medium text-secondary-700 dark:text-primary-500 mb-1">
        {label}
        {required && <span className="text-error-500 ml-1">*</span>}
      </label>
    )}
    <select
      className={`w-full px-3 py-2 text-sm text-secondary-800 bg-white border border-neutral-300 rounded-lg
                 transition-all duration-200
                 hover:border-primary-400
                 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                 dark:bg-neutral-800 dark:border-neutral-600 dark:text-white
                 dark:hover:border-primary-500 dark:focus:border-primary-500
                 ${error ? 'border-error-500 focus:ring-error-500/20 focus:border-error-500' : ''}
                 ${className}`}
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

export const Checkbox = ({ label, checked, onChange, ...props }) => (
  <label className="flex items-center cursor-pointer group mb-2">
    <div className="relative">
      <input 
        type="checkbox" 
        className="sr-only peer"
        checked={checked}
        onChange={onChange}
        {...props} 
      />
      <div className="w-5 h-5 border-2 border-neutral-300 dark:border-neutral-600 rounded 
                     peer-checked:bg-primary-500 peer-checked:border-primary-500
                     transition-all duration-200
                     group-hover:border-primary-400">
      </div>
      <svg 
        className="absolute top-0.5 left-0.5 w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    </div>
    {label && (
      <span className="ml-2.5 text-sm text-secondary-700 dark:text-neutral-300 group-hover:text-secondary-900 dark:group-hover:text-white">
        {label}
      </span>
    )}
  </label>
);

export const Textarea = ({ label, required, error, className = '', ...props }) => (
  <div className="mb-4">
    {label && (
      <label className="block text-sm font-medium text-secondary-700 dark:text-primary-500 mb-1.5">
        {label}
        {required && <span className="text-error-500 ml-1">*</span>}
      </label>
    )}
    <textarea
      className={`w-full px-4 py-2.5 text-secondary-800 bg-white border border-neutral-300 rounded-lg
                 min-h-[100px] resize-y
                 transition-all duration-200
                 hover:border-primary-400
                 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                 placeholder:text-neutral-400
                 dark:bg-neutral-800 dark:border-neutral-600 dark:text-white dark:placeholder:text-neutral-500
                 dark:hover:border-primary-500 dark:focus:border-primary-500
                 ${error ? 'border-error-500 focus:ring-error-500/20 focus:border-error-500' : ''}
                 ${className}`}
      {...props}
    />
    {error && <p className="mt-1.5 text-sm text-error-600">{error}</p>}
  </div>
);

export const Button = ({ variant = 'primary', children, className = '', ...props }) => {
  const variants = {
    primary: `bg-primary-500 hover:bg-primary-600 text-white font-semibold 
              transition-all duration-200`,
    secondary: `bg-neutral-100 hover:bg-neutral-200 text-secondary-700 font-medium
               border border-neutral-300 hover:border-neutral-400
               dark:bg-neutral-700 dark:text-neutral-200 dark:border-neutral-600 dark:hover:bg-neutral-600
               transition-all duration-200`,
    outline: `bg-transparent border-2 border-primary-500 text-primary-600 font-semibold
             hover:bg-primary-50 hover:border-primary-600
             dark:hover:bg-primary-500/10
             transition-all duration-200`,
  };

  return (
    <button 
      className={`px-6 py-2.5 rounded-lg ${variants[variant]} ${className}`} 
      {...props}
    >
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
  <div className={`border-2 rounded-xl overflow-hidden transition-all duration-300
                  ${isOpen 
                    ? 'border-primary-500 dark:border-primary-500' 
                    : 'border-neutral-200 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-500/50'}`}>
    <button
      type="button"
      onClick={() => onToggle(id)}
      className={`w-full flex items-center justify-between px-5 py-4 text-left
                 transition-all duration-200
                 ${isOpen 
                   ? 'bg-primary-50 dark:bg-primary-500/10' 
                   : 'bg-neutral-50 dark:bg-neutral-800 hover:bg-primary-50/50 dark:hover:bg-primary-500/5'}`}
    >
      <div className="flex items-center gap-3">
        <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">{icon}</span>
        <span className="font-heading font-semibold text-secondary-800 dark:text-white">{title}</span>
      </div>
      <svg 
        className={`w-5 h-5 text-primary-600 dark:text-primary-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    <div className={`transition-all duration-300 ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
      <div className="p-5 bg-white dark:bg-neutral-900">
        {children}
      </div>
    </div>
  </div>
);

// Tab Component
export const TabGroup = ({ tabs, activeTab, onTabChange }) => (
  <div className="flex border-b border-neutral-200 dark:border-neutral-700 mb-6">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        type="button"
        onClick={() => onTabChange(tab.id)}
        className={`px-6 py-3 font-medium text-sm transition-all duration-200 relative
                   ${activeTab === tab.id 
                     ? 'text-primary-600 dark:text-primary-500' 
                     : 'text-neutral-500 dark:text-neutral-400 hover:text-primary-500'}`}
      >
        {tab.label}
        {activeTab === tab.id && (
          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-t-full" />
        )}
      </button>
    ))}
  </div>
);
