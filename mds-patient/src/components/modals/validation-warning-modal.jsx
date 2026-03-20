import React from 'react';
import { createPortal } from 'react-dom';

/**
 * ValidationWarningModal - Displays a styled warning popup listing missing/incomplete fields
 * grouped by form section, with the ability to navigate to specific sections.
 *
 * @param {boolean} isOpen - Whether the modal is visible
 * @param {Function} onClose - Close handler
 * @param {Array} errors - Array of { section, sectionIndex, message } objects
 * @param {Function} onGoToSection - Optional callback(sectionIndex) to navigate to a form step
 * @param {'warning'|'error'} variant - Visual theme: 'warning' (amber) or 'error' (red)
 * @param {string} title - Override the modal heading
 * @param {string} subtitle - Override the subtitle under the heading
 */
const ValidationWarningModal = ({
  isOpen,
  onClose,
  errors = [],
  onGoToSection,
  variant = 'warning',
  title,
  subtitle,
}) => {
  if (!isOpen || errors.length === 0) return null;

  const isError = variant === 'error';
  const colorScheme = isError
    ? {
        bg: 'bg-red-50',
        border: 'border-red-200',
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
        titleColor: 'text-red-900',
        subtitleColor: 'text-red-700',
        closeColor: 'text-red-600 hover:text-red-800 hover:bg-red-100',
        sectionLink: 'text-red-600 hover:text-red-800',
        bulletColor: 'text-red-500',
        btnBg: 'bg-red-600 hover:bg-red-700',
      }
    : {
        bg: 'bg-yellow-100',
        border: 'border-yellow-400',
        iconBg: 'bg-yellow-200',
        iconColor: 'text-yellow-700',
        titleColor: 'text-yellow-900',
        subtitleColor: 'text-yellow-800',
        closeColor: 'text-yellow-700 hover:text-yellow-900 hover:bg-yellow-200',
        sectionLink: 'text-primary-600 hover:text-primary-800 hover:underline',
        bulletColor: 'text-yellow-600',
        btnBg: 'bg-yellow-600 hover:bg-yellow-700',
      };

  // Group errors by section
  const grouped = errors.reduce((acc, err) => {
    const key = err.section || 'General';
    if (!acc[key]) acc[key] = { sectionIndex: err.sectionIndex, items: [] };
    acc[key].items.push(err.message);
    return acc;
  }, {});

  const sectionIcons = {
    'Personal Information': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    'Medical History': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    'Medical Background': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    'Dental History': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
    'OB-GYNE': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    'Certification': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  const handleGoToSection = (sectionIndex) => {
    if (onGoToSection && sectionIndex !== undefined && sectionIndex !== null) {
      onGoToSection(sectionIndex);
      // Don't call onClose() here - let the parent component handle closing
      // onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className={`flex items-center gap-3 px-6 py-4 border-b ${colorScheme.border} ${colorScheme.bg} rounded-t-2xl`}>
          <div className={`flex items-center justify-center w-10 h-10 ${colorScheme.iconBg} rounded-full`}>
            {isError ? (
              <svg className={`w-6 h-6 ${colorScheme.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className={`w-6 h-6 ${colorScheme.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            )}
          </div>
          <div>
            <h3 className={`text-lg font-heading font-bold ${colorScheme.titleColor}`}>
              {title || 'Incomplete Form'}
            </h3>
            <p className={`text-sm ${colorScheme.subtitleColor}`}>
              {subtitle || `Please fix the following ${errors.length} ${errors.length === 1 ? 'issue' : 'issues'} before submitting`}
            </p>
          </div>
          <button 
            onClick={onClose}
            className={`ml-auto p-1 ${colorScheme.closeColor} rounded-lg transition-colors`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4 space-y-4">
          {Object.entries(grouped).map(([section, { sectionIndex, items }]) => (
            <div key={section} className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-secondary-800">
                  <span className="text-amber-600">
                    {sectionIcons[section] || (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </span>
                  <h4 className="font-semibold text-sm">{section}</h4>
                </div>
                {sectionIndex !== undefined && sectionIndex !== null && onGoToSection && (
                  <button
                    onClick={() => handleGoToSection(sectionIndex)}
                    className={`text-xs ${colorScheme.sectionLink} font-semibold flex items-center gap-1 transition-colors`}
                  >
                    Go to section
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>
              <ul className="space-y-1.5">
                {items.map((msg, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-secondary-700">
                    <svg className={`w-4 h-4 ${colorScheme.bulletColor} mt-0.5 flex-shrink-0`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>{msg}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className={`w-full py-2.5 px-4 ${colorScheme.btnBg} text-white font-semibold rounded-xl transition-colors text-sm`}
          >
            {isError ? 'OK, I will fix it' : 'I understand, let me fix it'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ValidationWarningModal;
