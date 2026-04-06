import React, { useState, useEffect } from 'react';

/**
 * Reusable Confirmation Modal
 * Replaces window.confirm with a modern, accessible modal
 * Supports danger (delete, reject, cancel) and primary (approve) variants
 */
const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary', // 'primary' | 'danger'
  showNotesInput = false,
  notesLabel = 'Notes',
  notesPlaceholder = 'Enter notes (optional)',
  notesRequired = false,
  isLoading = false,
}) => {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setNotes('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (showNotesInput && notesRequired && !notes.trim()) {
      return;
    }
    onConfirm(notes);
  };

  const isDanger = variant === 'danger';

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b ${
          isDanger 
            ? 'bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-800' 
            : 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800'
        }`}>
          <div className="flex items-center gap-3">
            {isDanger ? (
              <div className="w-10 h-10 rounded-full bg-error-100 dark:bg-error-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-error-600 dark:text-error-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            )}
            <h2 className={`text-lg font-bold ${
              isDanger 
                ? 'text-error-700 dark:text-error-400' 
                : 'text-primary-700 dark:text-primary-400'
            }`}>
              {title}
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-secondary-800 dark:text-white">
              {message}
            </p>
            {description && (
              <p className="text-xs text-secondary-600 dark:text-neutral-400">
                {description}
              </p>
            )}
          </div>

          {/* Optional Notes Input */}
          {showNotesInput && (
            <div>
              <label className="block text-xs font-medium text-secondary-700 dark:text-neutral-300 mb-2">
                {notesLabel}
                {notesRequired && <span className="text-error-500 ml-1">*</span>}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={notesPlaceholder}
                rows={3}
                required={notesRequired}
                className="w-full px-3 py-2 text-sm text-secondary-800 dark:text-white bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-transparent resize-none"
              />
              {notesRequired && !notes.trim() && (
                <p className="text-xs text-error-600 dark:text-error-400 mt-1">
                  This field is required
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-900/50 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || (showNotesInput && notesRequired && !notes.trim())}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 ${
              isDanger
                ? 'bg-error-600 hover:bg-error-700 dark:bg-error-600 dark:hover:bg-error-700'
                : 'bg-primary-600 hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-700'
            }`}
          >
            {isLoading && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
