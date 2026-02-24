import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Modal overlay for Initial Medical Record
 * Shows as an overlay on top of the dashboard with blur effect
 * This modal cannot be closed/dismissed - user must complete the form
 */
const InitialRecordModal = ({ 
  isOpen, 
  children,
  onComplete
}) => {
  const modalRef = useRef(null);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Prevent ESC key from closing the modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown, true);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto py-4 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="initial-record-modal-title"
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)'
      }}
    >
      <div 
        ref={modalRef}
        className="relative w-full max-w-5xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl my-4 animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 id="initial-record-modal-title" className="text-xl font-bold">
                  Complete Your Medical Record
                </h1>
                <p className="text-sm text-white/80">
                  Please fill out your initial medical record to access the dashboard
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-sm bg-white/20 px-4 py-2 rounded-full">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Required for Access</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[calc(100vh-120px)] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default InitialRecordModal;
