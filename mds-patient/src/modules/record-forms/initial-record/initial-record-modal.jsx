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
  onComplete,
  isRevision = false,
  revisionNote = null
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
      className="fixed inset-0 z-[9999] flex items-center justify-center"
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
        className="relative w-full max-w-4xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl mx-4 flex flex-col animate-slide-in"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className={`shrink-0 px-5 py-3 sm:px-6 sm:py-4 rounded-t-2xl ${isRevision ? 'bg-yellow-500' : 'bg-primary-500'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-white/25 rounded-lg">
                {isRevision ? (
                  <svg className="w-5 h-5 text-secondary-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-secondary-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
              </div>
              <div>
                <h1 id="initial-record-modal-title" className="text-base sm:text-lg font-bold text-secondary-900" style={{ margin: 0 }}>
                  {isRevision ? 'Revise Your Medical Record' : 'Complete Your Medical Record'}
                </h1>
                <p className="text-xs sm:text-sm text-secondary-800/70" style={{ margin: 0 }}>
                  {isRevision
                    ? 'Staff requested corrections — your previous answers are pre-filled below'
                    : 'Please fill out your initial medical record to access the dashboard'}
                </p>
              </div>
            </div>
            <div className={`hidden sm:flex items-center gap-1.5 text-xs font-medium bg-white/30 text-secondary-900 px-3 py-1.5 rounded-full`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isRevision ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" : "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"} />
              </svg>
              <span>{isRevision ? 'Revision Required' : 'Required for Access'}</span>
            </div>
          </div>
        </div>

        {/* Revision Note Banner */}
        {isRevision && revisionNote && (
          <div className="shrink-0 mx-5 mt-4 px-4 py-3 bg-yellow-50 border border-yellow-300 rounded-lg flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-yellow-800">Staff Note</p>
              <p className="text-sm text-yellow-700 mt-0.5">{revisionNote}</p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-h-0 flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default InitialRecordModal;
