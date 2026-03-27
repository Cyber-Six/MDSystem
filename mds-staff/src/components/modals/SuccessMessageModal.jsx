import React, { useEffect } from 'react';

/**
 * Success Message Modal Component (Staff)
 * Displays success/info/confirmation messages with consistent styling.
 * Auto-closes after specified duration.
 */
const SuccessMessageModal = ({ 
  isOpen, 
  onClose,
  title = 'Success',
  message,
  details = null,
  autoCloseDuration = 3000,
  actionButtonText = 'OK'
}) => {
  // Auto-close modal after specified duration
  useEffect(() => {
    if (!isOpen || !autoCloseDuration) return;

    const timer = setTimeout(() => {
      onClose?.();
    }, autoCloseDuration);

    return () => clearTimeout(timer);
  }, [isOpen, autoCloseDuration, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-2xl max-w-md w-full p-8 animate-in fade-in zoom-in duration-300">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-center text-secondary-900 dark:text-white mb-2">
          {title}
        </h2>

        {/* Message */}
        <p className="text-center text-secondary-700 dark:text-neutral-300 text-sm leading-relaxed mb-2">
          {message}
        </p>

        {/* Details (optional) */}
        {details && (
          <p className="text-center text-secondary-600 dark:text-neutral-400 text-xs mb-6">
            {details}
          </p>
        )}

        {/* Action Button */}
        <button
          onClick={onClose}
          className="
            w-full px-4 py-2.5 
            bg-success-600 hover:bg-success-700 
            text-white font-medium 
            rounded-lg transition-colors
            focus:outline-none focus:ring-2 focus:ring-success-500 focus:ring-offset-2
            dark:focus:ring-offset-neutral-800
          "
        >
          {actionButtonText}
        </button>
      </div>
    </div>
  );
};

export default SuccessMessageModal;
