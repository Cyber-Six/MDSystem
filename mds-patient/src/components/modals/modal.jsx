import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md', 
  showCloseButton = true,
  className = '',
  contentClassName = '',
  backdropBlur = 12,
  backdropOpacity = 0.85,
}) => {
  const modalRef = useRef(null);

  // Handle ESC key press
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      const handleTab = (e) => {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement?.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement?.focus();
              e.preventDefault();
            }
          }
        }
      };

      modalRef.current.addEventListener('keydown', handleTab);
      firstElement?.focus();

      return () => {
        modalRef.current?.removeEventListener('keydown', handleTab);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full mx-4'
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={{ 
        backgroundColor: `rgba(0, 0, 0, ${backdropOpacity})`,
        backdropFilter: `blur(${backdropBlur}px)`,
        WebkitBackdropFilter: `blur(${backdropBlur}px)`
      }}
    >
      <div 
        ref={modalRef}
        className={`
          relative w-full ${sizeClasses[size]} 
          bg-white dark:bg-neutral-900
          rounded-lg shadow-xl
          max-h-[90vh] flex flex-col
          animate-slide-in
          ${className}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-700">
            {title && (
              <h2 
                id="modal-title"
                className="text-xl font-semibold text-gray-900 dark:text-white"
              >
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="
                  p-2 rounded-lg
                  text-gray-500 dark:text-gray-400
                  hover:bg-gray-100 dark:hover:bg-neutral-800
                  transition-colors duration-200
                "
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className={`px-6 py-4 overflow-y-auto min-h-0 ${contentClassName}`}>
          {children}
        </div>
      </div>
    </div>
  );

  // Use Portal to render modal at document.body level
  // This ensures it's outside any parent stacking context
  return createPortal(modalContent, document.body);
};

export default Modal;
