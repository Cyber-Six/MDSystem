import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

/**
 * ConfirmModal - A reusable confirmation dialog
 *
 * @param {boolean} isOpen - Whether the modal is visible
 * @param {function} onClose - Called when user cancels
 * @param {function} onConfirm - Called when user confirms
 * @param {string} title - Modal title
 * @param {string} message - Confirmation message
 * @param {string} confirmText - Text for confirm button (default: "Confirm")
 * @param {string} cancelText - Text for cancel button (default: "Cancel")
 * @param {string} variant - "danger" or "warning" (default: "danger")
 */
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  const colors = {
    danger: {
      icon: 'text-red-600 dark:text-red-400',
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      button: 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white'
    },
    warning: {
      icon: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      button: 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 text-white'
    }
  };

  const colorScheme = colors[variant];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50">
      <div
        className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorScheme.iconBg}`}>
              <AlertTriangle className={`w-5 h-5 ${colorScheme.icon}`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
                {title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500 dark:text-neutral-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors
                       text-neutral-700 dark:text-neutral-300
                       border border-neutral-300 dark:border-neutral-600
                       hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${colorScheme.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
