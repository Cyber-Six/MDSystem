import React, { useEffect } from 'react';
import Modal from './modal';
import { CheckCircle, Info, AlertCircle } from 'lucide-react';

/**
 * Success Message Modal Component
 * Uses the existing Modal wrapper for consistent styling.
 * Used for displaying success/info/confirmation messages.
 */
const SuccessMessageModal = ({ 
  isOpen, 
  onClose,
  title = 'Success',
  message,
  details = null,
  icon = 'success', // 'success', 'info', or 'warning'
  autoCloseDuration = 3000,
  actionButtonText = 'OK',
  size = 'md'
}) => {
  // Auto-close modal after specified duration
  useEffect(() => {
    if (!isOpen || !autoCloseDuration) return;

    const timer = setTimeout(() => {
      onClose?.();
    }, autoCloseDuration);

    return () => clearTimeout(timer);
  }, [isOpen, autoCloseDuration, onClose]);

  // Render icon based on type
  const renderIcon = () => {
    switch (icon) {
      case 'success':
        return <CheckCircle className="w-16 h-16 text-green-500 dark:text-green-400 mx-auto mb-4" />;
      case 'info':
        return <Info className="w-16 h-16 text-blue-500 dark:text-blue-400 mx-auto mb-4" />;
      case 'warning':
        return <AlertCircle className="w-16 h-16 text-amber-500 dark:text-amber-400 mx-auto mb-4" />;
      default:
        return null;
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      title={title}
      size={size}
      showCloseButton={true}
    >
      <div className="text-center">
        {/* Icon */}
        {renderIcon()}

        {/* Message */}
        <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {message}
        </p>

        {/* Details (optional) */}
        {details && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            {details}
          </p>
        )}

        {/* Action Button */}
        <button
          onClick={onClose}
          className="
            w-full px-4 py-2.5 
            bg-green-600 hover:bg-green-700 
            text-white font-medium 
            rounded-lg transition-colors
            focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2
            dark:focus:ring-offset-neutral-900
          "
        >
          {actionButtonText}
        </button>
      </div>
    </Modal>
  );
};

export default SuccessMessageModal;
