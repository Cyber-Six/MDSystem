import React, { useState } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, X, Loader2, AlertTriangle } from 'lucide-react';

const TicketStatusBanner = ({ status, onCancel, isLoading }) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const getStatusConfig = () => {
    switch (status) {
      case 'Open':
        return {
          icon: Clock,
          text: 'Waiting for Staff Approval',
          description: 'Your request has been submitted and is pending review. A medical staff member will review and approve it shortly. You will be notified when the chat is ready.',
          bgColor: 'bg-amber-50 dark:bg-amber-900/20',
          borderColor: 'border-amber-200 dark:border-amber-800',
          iconColor: 'text-amber-500',
          textColor: 'text-amber-700 dark:text-amber-300',
          showCancel: true
        };
      case 'Ongoing':
        return {
          icon: CheckCircle,
          text: 'Chat Active',
          description: 'You are now connected with medical staff.',
          bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
          borderColor: 'border-emerald-200 dark:border-emerald-800',
          iconColor: 'text-emerald-500',
          textColor: 'text-emerald-700 dark:text-emerald-300',
          showCancel: false
        };
      case 'Closed':
        return {
          icon: XCircle,
          text: 'Chat Closed',
          description: 'This conversation has been closed.',
          bgColor: 'bg-neutral-50 dark:bg-neutral-800',
          borderColor: 'border-neutral-200 dark:border-neutral-700',
          iconColor: 'text-neutral-500',
          textColor: 'text-neutral-700 dark:text-neutral-300',
          showCancel: false
        };
      case 'Expired':
        return {
          icon: AlertCircle,
          text: 'Chat Expired',
          description: 'This conversation has expired due to inactivity.',
          bgColor: 'bg-neutral-50 dark:bg-neutral-800',
          borderColor: 'border-neutral-200 dark:border-neutral-700',
          iconColor: 'text-neutral-500',
          textColor: 'text-neutral-700 dark:text-neutral-300',
          showCancel: false
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  const Icon = config.icon;

  const handleConfirmCancel = async () => {
    setIsCancelling(true);
    try {
      await onCancel();
    } finally {
      setIsCancelling(false);
      setShowConfirmModal(false);
    }
  };

  return (
    <>
      <div className={`flex items-start gap-3 p-4 rounded-lg border ${config.bgColor} ${config.borderColor} mb-4`}>
        <Icon className={`w-5 h-5 ${config.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className={`text-sm font-semibold ${config.textColor}`}>
              {config.text}
            </h4>
            {config.showCancel && (
              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={isLoading || isCancelling}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium
                           text-neutral-500 dark:text-neutral-400
                           hover:text-red-600 dark:hover:text-red-400
                           hover:bg-red-50 dark:hover:bg-red-950/40
                           border border-transparent hover:border-red-200 dark:hover:border-red-800/50
                           rounded-md transition-all duration-150
                           disabled:opacity-40 disabled:cursor-not-allowed"
                title="Cancel this request"
              >
                <X className="w-3 h-3" />
                <span>Cancel Request</span>
              </button>
            )}
          </div>
          <p className={`text-xs ${config.textColor} opacity-90`}>
            {config.description}
          </p>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowConfirmModal(false); }}
        >
          <div className="w-full max-w-sm rounded-xl border shadow-xl
                          bg-white dark:bg-neutral-900
                          border-neutral-200 dark:border-neutral-700
                          animate-[fadeInScale_180ms_ease-out]">
            <style>{`
              @keyframes fadeInScale {
                from { opacity: 0; transform: scale(0.95); }
                to   { opacity: 1; transform: scale(1); }
              }
            `}</style>

            {/* Header */}
            <div className="flex items-start gap-3 p-5 pb-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
                <AlertTriangle className="w-4.5 h-4.5 text-red-500" />
              </div>
              <div className="flex-1 pt-0.5">
                <h3 className="text-sm font-semibold text-secondary-900 dark:text-white">
                  Cancel Request?
                </h3>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  This will withdraw your pending consultation request. You can submit a new one any time.
                </p>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isCancelling}
                className="flex-shrink-0 p-1 rounded-md text-neutral-400 hover:text-neutral-600
                           dark:text-neutral-500 dark:hover:text-neutral-300
                           hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t
                            border-neutral-100 dark:border-neutral-800">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isCancelling}
                className="px-4 py-2 text-xs font-medium rounded-lg transition-colors
                           text-neutral-600 dark:text-neutral-400
                           bg-neutral-100 dark:bg-neutral-800
                           hover:bg-neutral-200 dark:hover:bg-neutral-700
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Keep Request
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg
                           transition-colors text-white bg-red-500 hover:bg-red-600
                           dark:bg-red-600 dark:hover:bg-red-500
                           disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Cancelling…
                  </>
                ) : (
                  'Yes, Cancel'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TicketStatusBanner;
