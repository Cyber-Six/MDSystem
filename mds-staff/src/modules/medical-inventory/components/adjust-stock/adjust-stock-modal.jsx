import React, { useState } from 'react';

/**
 * Adjust Stock Modal — manual stock correction (add / subtract) with mandatory reason.
 * Validates quantity before submission and prevents invalid operations.
 */
const AdjustStockModal = ({ batch, onClose, onAdjust }) => {
  const [type, setType] = useState('add');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation logic
  const qty = Math.max(0, parseInt(quantity) || 0);
  const maxSubtract = batch.currentQuantity || batch.availableQuantity || 0;
  const isQuantityValid = qty > 0;
  const isReasonValid = reason.trim().length > 0;
  const isSubtractValid = type === 'add' || qty <= maxSubtract;
  const isValid = isQuantityValid && isReasonValid && isSubtractValid && !isSubmitting;
  const newQty = type === 'add' ? maxSubtract + qty : maxSubtract - qty;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;

    // Prevent negative resulting quantities
    if (newQty < 0) {
      alert('Error: Adjustment would result in negative quantity');
      return;
    }

    setIsSubmitting(true);
    try {
      onAdjust({ batchId: batch.id, type, quantity: qty, reason: reason.trim(), newQuantity: newQty });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-secondary-900 dark:text-white">Adjust Stock</h2>
            <p className="text-[11px] text-secondary-500 dark:text-neutral-400 leading-none mt-0.5">Manual stock correction for batch {batch.batchNumber}</p>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
            <svg className="w-4 h-4 text-secondary-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Batch Info */}
        <div className="px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Batch</p>
              <p className="text-xs font-mono font-medium text-secondary-800 dark:text-white">{batch.batchNumber}</p>
            </div>
            <div>
              <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Location</p>
              <p className="text-xs font-medium text-secondary-800 dark:text-white">{batch.location}</p>
            </div>
            <div>
              <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Current Qty</p>
              <p className="text-xs font-bold text-secondary-800 dark:text-white">{maxSubtract}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Correction Type */}
          <div>
            <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-2">Correction Type *</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setType('add')} disabled={isSubmitting} className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${type === 'add' ? 'border-success-500 bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400' : 'border-neutral-300 dark:border-neutral-600 text-secondary-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Stock
              </button>
              <button type="button" onClick={() => setType('subtract')} disabled={isSubmitting} className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${type === 'subtract' ? 'border-error-500 bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400' : 'border-neutral-300 dark:border-neutral-600 text-secondary-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                Remove Stock
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">Quantity *</label>
            <input
              type="number"
              min={1}
              max={type === 'subtract' ? maxSubtract : undefined}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={type === 'subtract' ? `Max: ${maxSubtract}` : 'Enter quantity'}
              disabled={isSubmitting}
              className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-100 dark:disabled:bg-neutral-700/50 disabled:cursor-not-allowed"
            />
            {type === 'subtract' && qty > maxSubtract && (
              <p className="text-[10px] text-error-500 mt-1 font-medium">Cannot remove more than current stock ({maxSubtract})</p>
            )}
            {!isQuantityValid && quantity && (
              <p className="text-[10px] text-error-500 mt-1 font-medium">Please enter a valid positive number</p>
            )}
          </div>

          {/* Reason (mandatory) */}
          <div>
            <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">Reason *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Physical count mismatch, damaged items, expired disposal…"
              disabled={isSubmitting}
              className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none disabled:bg-neutral-100 dark:disabled:bg-neutral-700/50 disabled:cursor-not-allowed"
            />
            {reason.trim().length === 0 && quantity && (
              <p className="text-[10px] text-warning-500 mt-1 font-medium">Reason is required for audit trail</p>
            )}
          </div>

          {/* Preview */}
          {qty > 0 && reason.trim() && (
            <div className={`p-3 rounded-lg border ${type === 'add' ? 'bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800' : 'bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-800'}`}>
              <p className={`text-xs font-medium ${type === 'add' ? 'text-success-700 dark:text-success-400' : 'text-error-700 dark:text-error-400'}`}>Adjustment Preview</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-secondary-600 dark:text-neutral-300">
                <span>{maxSubtract}</span>
                <span className="text-secondary-400">{type === 'add' ? '+' : '−'}</span>
                <span>{qty}</span>
                <span className="text-secondary-400">=</span>
                <span className="font-bold text-secondary-800 dark:text-white">{newQty} units</span>
              </div>
              {newQty < 0 && (
                <p className="text-[10px] text-error-500 mt-1.5 font-bold">⚠ Warning: Result is negative</p>
              )}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors disabled:bg-neutral-100 dark:disabled:bg-neutral-700/50 disabled:cursor-not-allowed">Cancel</button>
          <button onClick={handleSubmit} disabled={!isValid} className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-1 ${isValid ? (type === 'add' ? 'bg-success-500 hover:bg-success-600' : 'bg-error-500 hover:bg-error-600') : 'bg-neutral-300 dark:bg-neutral-600 cursor-not-allowed'}`}>
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m6.36 1.64l-.71.71M21 12h-1m-1.64 6.36l-.71-.71M12 21v-1m-6.36-1.64l.71-.71M3 12h1m1.64-6.36l.71.71" /></svg>
                Processing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" /></svg>
                Confirm Adjustment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdjustStockModal;
