import React, { useState, useEffect } from 'react';
import { X, Pill, Loader2, AlertCircle, Package } from 'lucide-react';
import { getMyPrescriptions } from '../health-chat-service';

const MyPrescriptionsModal = ({ isOpen, onClose }) => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    loadPrescriptions();
  }, [isOpen]);

  const loadPrescriptions = async () => {
    try {
      setLoading(true);
      const data = await getMyPrescriptions(0, 50);
      setPrescriptions(data || []);
    } catch {
      setError('Failed to load prescriptions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30">
              <Pill className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-secondary-900 dark:text-white leading-tight">
                My Prescriptions
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Medicines issued to you
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500 dark:text-neutral-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: 'thin' }}>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm
                            bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
                            text-red-700 dark:text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {!loading && !error && prescriptions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
              <Package className="w-10 h-10 mb-3 text-neutral-300 dark:text-neutral-600" />
              <p className="text-sm">No prescriptions yet</p>
              <p className="text-xs mt-1 text-neutral-400 dark:text-neutral-500">
                Prescriptions issued by your doctor will appear here.
              </p>
            </div>
          )}

          {!loading && prescriptions.map((rx) => (
            <div
              key={rx.id}
              className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-4 border border-neutral-200 dark:border-neutral-700"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold
                                   bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                    <Pill className="w-2.5 h-2.5" />
                    {rx.action || 'Issue'}
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 text-right">
                  {formatDate(rx.issuedAt)}
                </p>
              </div>

              {rx.notes && (
                <p className="text-xs text-neutral-600 dark:text-neutral-300 mb-3 leading-relaxed">
                  {rx.notes}
                </p>
              )}

              <div className="flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                <span>Total qty: <span className="font-semibold text-secondary-800 dark:text-white">{rx.quantity}</span></span>
                <span>Rx #{rx.id}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-300
                       hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default MyPrescriptionsModal;
