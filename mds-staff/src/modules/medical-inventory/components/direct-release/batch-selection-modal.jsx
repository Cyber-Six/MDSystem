import React, { useState, useMemo } from 'react';
import { formatBatchDisplay, formatDateDisplay } from '../../medical-inventory-service';

/**
 * Batch Selection Modal
 * Displays available batches for a medicine and allows staff to select one
 * Defaults to FEFO (First Expiry, First Out)
 */
const BatchSelectionModal = ({ medicine, batches, onSelect, onCancel }) => {
  const [selectedBatchId, setSelectedBatchId] = useState(null);

  // Sort batches by expiry date (FEFO - earliest first)
  const sortedBatches = useMemo(() => {
    return [...batches].sort((a, b) => {
      const dateA = new Date(a.expiryDate || '2099-12-31').getTime();
      const dateB = new Date(b.expiryDate || '2099-12-31').getTime();
      return dateA - dateB;
    });
  }, [batches]);

  // Set default to the earliest expiry batch
  React.useEffect(() => {
    if (sortedBatches.length > 0 && !selectedBatchId) {
      setSelectedBatchId(sortedBatches[0].batchId);
    }
  }, [sortedBatches, selectedBatchId]);

  const handleConfirm = () => {
    const selected = sortedBatches.find((b) => b.batchId === selectedBatchId);
    if (selected) {
      onSelect(selected);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    try {
      return new Date(expiryDate) < new Date();
    } catch {
      return false;
    }
  };

  const isExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false;
    try {
      const expiry = new Date(expiryDate);
      const today = new Date();
      const daysUntilExpiry = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
    } catch {
      return false;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary-50 to-accent-50 dark:from-neutral-700 dark:to-neutral-700 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-secondary-900 dark:text-white">
              Select Batch
            </h2>
            <p className="text-[11px] text-secondary-500 dark:text-neutral-400 leading-none mt-0.5">
              {medicine.item_name}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-secondary-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-3">
          {/* FEFO Info */}
          <div className="flex items-start gap-2 px-3 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
            <svg className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-xs font-medium text-primary-900 dark:text-primary-100">FEFO Applied</p>
              <p className="text-[10px] text-primary-700 dark:text-primary-300 mt-0.5">
                Batches are sorted by expiry date (earliest first)
              </p>
            </div>
          </div>

          {/* Batch List */}
          <div className="space-y-2">
            {sortedBatches.length > 0 ? (
              sortedBatches.map((batch, idx) => {
                const isSelected = selectedBatchId === batch.batchId;
                const expired = isExpired(batch.expiryDate);
                const expiringSoon = isExpiringSoon(batch.expiryDate);

                return (
                  <button
                    key={batch.batchId}
                    onClick={() => setSelectedBatchId(batch.batchId)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600'
                    } ${expired ? 'opacity-60' : ''}`}
                    disabled={expired}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {/* Left: Batch Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          {/* FEFO Badge */}
                          {idx === 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300 rounded-full text-[10px] font-bold">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              FEFO
                            </span>
                          )}

                          {/* Expiry Status Badge */}
                          {expired && (
                            <span className="inline-flex items-center px-2 py-0.5 bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-300 rounded-full text-[10px] font-bold">
                              Expired
                            </span>
                          )}
                          {!expired && expiringSoon && (
                            <span className="inline-flex items-center px-2 py-0.5 bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300 rounded-full text-[10px] font-bold">
                              Expiring Soon
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-medium text-secondary-800 dark:text-white">
                          {formatBatchDisplay(batch, { compact: true })}
                        </p>
                      </div>

                      {/* Right: Selection Indicator */}
                      <div className="flex-shrink-0">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'border-primary-500 bg-primary-500'
                              : 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700'
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">No batches available</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedBatchId || isExpired(sortedBatches.find((b) => b.id === selectedBatchId)?.expiryDate)}
            className="px-4 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-600 rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            Select Batch
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchSelectionModal;
