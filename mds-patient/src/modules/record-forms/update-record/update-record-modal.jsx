import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Modal overlay for Update Medical Record
 * Shows as an overlay on top of the dashboard with blur effect
 * Similar to InitialRecordModal but for record updates
 */
const UpdateRecordModal = ({ 
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

  // Prevent ESC key from closing the modal when it's a revision (force completion)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && isRevision) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    if (isOpen && isRevision) {
      document.addEventListener('keydown', handleKeyDown, true);
    }

    return () => {
      if (isRevision) {
        document.removeEventListener('keydown', handleKeyDown, true);
      }
    };
  }, [isOpen, isRevision]);

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-record-modal-title"
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)'
      }}
    >
      <div 
        ref={modalRef}
        className="relative w-full max-w-5xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl mx-4 flex flex-col animate-slide-in"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className={`shrink-0 rounded-t-2xl ${isRevision ? 'bg-yellow-500' : 'bg-primary-500'}`}>
          <div className="px-5 py-3 sm:px-6 sm:py-4 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
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
              <div className="flex-1">
                <h1 id="update-record-modal-title" className="text-base sm:text-lg font-bold text-secondary-900" style={{ margin: 0 }}>
                  {isRevision ? 'Revise Your Medical Record' : 'Update Your Medical Record'}
                </h1>
                <p className="text-xs sm:text-sm text-secondary-800/70" style={{ margin: 0 }}>
                  {isRevision
                    ? 'Staff requested corrections — your previous answers are pre-filled below'
                    : 'Keep your health information current and complete'}
                </p>
              </div>
            </div>
            <div className={`hidden sm:flex items-center gap-1.5 text-xs font-medium bg-white/30 text-secondary-900 px-3 py-1.5 rounded-full flex-shrink-0`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isRevision ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" : "M12 6.253v13m0-13C6.5 6.253 2 10.998 2 17s4.5 10.747 10 10.747c5.5 0 10-4.998 10-10.747 0-3 1-5 1-6.253M12 6.253L7 3m0 0l5-3m-5 3l5 3"} />
              </svg>
              <span>{isRevision ? 'Revision Required' : 'Update Required'}</span>
            </div>
          </div>

          {/* Staff Note — attached flush to the bottom of the header, no gap */}
          {isRevision && revisionNote && (
            <div className="mx-5 mb-4 px-4 py-3 bg-yellow-400/30 rounded-xl flex items-start gap-3">
              <svg className="w-4 h-4 text-secondary-800 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <div className="flex-1">
                <p className="text-xs font-semibold text-secondary-900 uppercase tracking-wide mb-1">Staff Note</p>
                <div className="text-sm text-secondary-800 whitespace-pre-wrap leading-relaxed bg-white/50 dark:bg-neutral-900/50 rounded-lg px-3 py-2 border-l-3 border-yellow-600">
                  {revisionNote}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default UpdateRecordModal;
