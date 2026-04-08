import React, { useState, useMemo } from 'react';

/**
 * Request Action Modal
 * Reusable modal for approving or rejecting medicine requests with optional notes
 * Includes batch selection during approval for FEFO allocation
 */
const RequestActionModal = ({ request, action, onConfirm, onCancel, batches = [], items = [] }) => {
  const [notes, setNotes] = useState('');
  // Initialize state for each item's quantity and batch selection
  const [approvedQuantities, setApprovedQuantities] = useState(() => {
    const initial = {};
    request?.items?.forEach((item, idx) => {
      initial[idx] = item.quantity || '';
    });
    return initial;
  });
  const [approvedBatchIds, setApprovedBatchIds] = useState(() => {
    const initial = {};
    request?.items?.forEach((item, idx) => {
      initial[idx] = '';
    });
    return initial;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quantityErrors, setQuantityErrors] = useState({});

  if (!request) return null;

  const isApprove = action?.toLowerCase() === 'approve';
  const isReject = action?.toLowerCase() === 'reject';

  if (!isApprove && !isReject) return null;

  // Get available batches for each requested item
  const getAvailableBatchesForItem = (requestedItem) => {
    return batches.filter((b) => {
      const available = Number(b.availableQuantity ?? b.currentQuantity ?? 0);
      const sameItem = requestedItem?.itemId
        ? String(b.medicalItemId) === String(requestedItem.itemId)
        : requestedItem?.medicineId
        ? String(b.medicalItemId) === String(requestedItem.medicineId)
        : false;
      const sameLocation = request?.location
        ? b.location === request.location
        : true;

      return sameItem && available > 0 && sameLocation;
    }).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  };

  const handleSubmit = async () => {
    // Validate quantities only for approval
    if (isApprove) {
      const errors = {};
      let hasErrors = false;

      request?.items?.forEach((item, idx) => {
        const qty = Number(approvedQuantities[idx]);
        if (!approvedQuantities[idx] || isNaN(qty) || qty <= 0) {
          errors[idx] = 'Quantity must be a positive number';
          hasErrors = true;
        } else {
          // Check against available stock in the selected batch (or any available batch if not selected)
          const selectedBatchId = approvedBatchIds[idx];
          const availableBatches = getAvailableBatchesForItem(item);

          let maxAvailable = availableBatches.reduce((sum, b) => sum + (Number(b.availableQuantity ?? b.currentQuantity ?? 0)), 0);

          if (selectedBatchId) {
            // If a specific batch is selected, check only that batch
            const selectedBatch = availableBatches.find(b => String(b.id) === String(selectedBatchId));
            maxAvailable = selectedBatch ? Number(selectedBatch.availableQuantity ?? selectedBatch.currentQuantity ?? 0) : 0;
          }

          if (qty > maxAvailable) {
            errors[idx] = `Quantity exceeds available stock (${maxAvailable} available)`;
            hasErrors = true;
          }
        }
      });

      if (hasErrors) {
        setQuantityErrors(errors);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Auto-select FEFO batches for items with no explicit selection
      const finalBatchIds = { ...approvedBatchIds };
      if (isApprove) {
        request?.items?.forEach((item, idx) => {
          if (!finalBatchIds[idx]) {
            const availableBatches = getAvailableBatchesForItem(item);
            if (availableBatches.length > 0) {
              // Auto-select first FEFO batch (already sorted by expiry date)
              finalBatchIds[idx] = availableBatches[0].id;
            }
          }
        });
      }
      // Pass all approved quantities and batch IDs along with notes
      await onConfirm(request, notes || null, isApprove ? approvedQuantities : null, isApprove ? finalBatchIds : null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to format date
  const formatDate = (dateValue) => {
    if (!dateValue) return '—';
    try {
      let date;
      if (typeof dateValue === 'number') {
        date = new Date(dateValue * 1000);
      } else if (typeof dateValue === 'string') {
        const trimmed = dateValue.trim();
        if (/^\d+$/.test(trimmed)) {
          const numeric = Number(trimmed);
          date = new Date(trimmed.length >= 13 ? numeric : numeric * 1000);
        } else {
          date = new Date(trimmed);
        }
      } else {
        date = dateValue;
      }
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (err) {
      return '—';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 p-6 pb-4 border-b border-neutral-200 dark:border-neutral-700">
          {isApprove ? (
            <>
              <div className="w-10 h-10 rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-success-700 dark:text-success-400">Approve Request</h2>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-error-100 dark:bg-error-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-error-600 dark:text-error-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-error-700 dark:text-error-400">Reject Request</h2>
            </>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Request Info */}
            <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-3 space-y-3">
              {/* Request ID */}
              <div>
                <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Request ID</p>
                <p className="text-sm font-medium text-secondary-700 dark:text-neutral-300">#{request.id}</p>
              </div>

              {/* Date */}
              <div>
                <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Date Created</p>
                <p className="text-xs text-secondary-600 dark:text-neutral-400">{formatDate(request.created_at)}</p>
              </div>

              {/* Purpose */}
              {request.purpose && (
                <div>
                  <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Purpose</p>
                  <p className="text-xs text-secondary-600 dark:text-neutral-400 break-words whitespace-pre-wrap">{request.purpose}</p>
                </div>
              )}
            </div>

            {/* Each Item - Quantity & Batch Selection */}
            {request.items?.length > 0 && (
              <div className="space-y-4">
                {request.items.map((item, idx) => {
                  const availableBatches = getAvailableBatchesForItem(item);

                  return (
                    <div key={idx} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 space-y-3">
                      {/* Item Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-secondary-700 dark:text-neutral-200">
                            {item.itemName || `Medicine #${item.medicineId || item.batchId}`}
                          </h3>
                          <p className="text-xs text-secondary-500 dark:text-neutral-400">
                            Requested: {item.quantity} unit{item.quantity > 1 ? 's' : ''}
                          </p>
                        </div>
                        <span className="text-xs font-medium px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full">
                          #{idx + 1}
                        </span>
                      </div>

                      {/* Quantity Input (Only for Approval) */}
                      {isApprove && (
                        <div>
                          <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-2">
                            Approved Quantity <span className="text-error-500">*</span>
                          </label>
                          {(() => {
                            const selectedBatchId = approvedBatchIds[idx];
                            const availableBatches = getAvailableBatchesForItem(item);
                            let maxAvailable = availableBatches.reduce((sum, b) => sum + (Number(b.availableQuantity ?? b.currentQuantity ?? 0)), 0);

                            if (selectedBatchId) {
                              const selectedBatch = availableBatches.find(b => String(b.id) === String(selectedBatchId));
                              maxAvailable = selectedBatch ? Number(selectedBatch.availableQuantity ?? selectedBatch.currentQuantity ?? 0) : 0;
                            }

                            return (
                              <>
                                <input
                                  type="number"
                                  min="1"
                                  max={maxAvailable}
                                  value={approvedQuantities[idx] || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const numVal = val ? Number(val) : 0;

                                    setApprovedQuantities({
                                      ...approvedQuantities,
                                      [idx]: val,
                                    });

                                    // Real-time validation
                                    if (val && numVal > maxAvailable) {
                                      setQuantityErrors({
                                        ...quantityErrors,
                                        [idx]: `Max ${maxAvailable} available${selectedBatchId ? ' in selected batch' : ''}`,
                                      });
                                    } else if (val && numVal <= 0) {
                                      setQuantityErrors({
                                        ...quantityErrors,
                                        [idx]: 'Quantity must be at least 1',
                                      });
                                    } else {
                                      setQuantityErrors({
                                        ...quantityErrors,
                                        [idx]: '',
                                      });
                                    }
                                  }}
                                  placeholder={`Enter quantity (max: ${maxAvailable})`}
                                  className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                                    quantityErrors[idx]
                                      ? 'border-error-300 dark:border-error-600'
                                      : 'border-neutral-300 dark:border-neutral-600'
                                  }`}
                                />
                                <p className="text-[10px] text-secondary-400 dark:text-neutral-500 mt-1">
                                  {selectedBatchId ? `Limited to selected batch (${maxAvailable} available)` : `Total available across all batches: ${maxAvailable}`}
                                </p>
                                {quantityErrors[idx] && (
                                  <p className="text-xs text-error-600 dark:text-error-400 mt-1">{quantityErrors[idx]}</p>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {/* Batch Selection (Only for Approval) */}
                      {isApprove && availableBatches.length > 0 && (
                        <div>
                          <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-2">
                            Batch Selection (Optional - Auto: FEFO)
                          </label>
                          <select
                            value={approvedBatchIds[idx] || ''}
                            onChange={(e) => {
                              setApprovedBatchIds({
                                ...approvedBatchIds,
                                [idx]: e.target.value,
                              });
                            }}
                            className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          >
                            <option value="">Auto (FEFO - Earliest Expiry First)</option>
                            {availableBatches.map((batch) => {
                              const expiry = batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
                              const available = batch.availableQuantity ?? batch.currentQuantity ?? 0;
                              return (
                                <option key={batch.id} value={batch.id}>
                                  {batch.batchNumber || batch.id} — Expires {expiry} ({available} available)
                                </option>
                              );
                            })}
                          </select>
                          <p className="text-[10px] text-secondary-400 dark:text-neutral-500 mt-1">
                            {approvedBatchIds[idx] ? 'Batch locked for dispense step' : 'Staff can adjust during dispense if needed'}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Notes Input */}
            <div>
              <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-2">
                {isReject ? 'Reason for Rejection' : 'Notes'} (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isReject
                  ? 'e.g., Out of stock, Expired, Incorrect dosage...'
                  : 'e.g., Available at clinic, pick up from counter...'}
                rows={3}
                className="w-full px-3 py-2 text-xs border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isApprove
                ? 'bg-success-500 hover:bg-success-600'
                : 'bg-error-500 hover:bg-error-600'
            }`}
          >
            {isSubmitting ? 'Processing...' : (isApprove ? 'Approve' : 'Reject')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestActionModal;
