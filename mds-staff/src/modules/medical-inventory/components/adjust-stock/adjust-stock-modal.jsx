import React, { useState } from 'react';

/**
 * Adjust Stock Modal — manual stock correction (add / subtract) with mandatory reason.
 */
const AdjustStockModal = ({ batch, onClose, onAdjust }) => {
  const [type, setType] = useState('add');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const qty = parseInt(quantity) || 0;
  const maxSubtract = batch.currentQuantity;
  const isValid = qty > 0 && reason.trim().length > 0 && (type === 'add' || qty <= maxSubtract);
  const newQty = type === 'add' ? batch.currentQuantity + qty : batch.currentQuantity - qty;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onAdjust({ batchId: batch.id, type, quantity: qty, reason, newQuantity: newQty });
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
          <button onClick={onClose} className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
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
              <p className="text-xs font-bold text-secondary-800 dark:text-white">{batch.currentQuantity}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Correction Type */}
          <div>
            <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-2">Correction Type *</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setType('add')} className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${type === 'add' ? 'border-success-500 bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400' : 'border-neutral-300 dark:border-neutral-600 text-secondary-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Stock
              </button>
              <button type="button" onClick={() => setType('subtract')} className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${type === 'subtract' ? 'border-error-500 bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400' : 'border-neutral-300 dark:border-neutral-600 text-secondary-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                Remove Stock
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">Quantity *</label>
            <input type="number" min={1} max={type === 'subtract' ? maxSubtract : undefined} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={type === 'subtract' ? `Max: ${maxSubtract}` : 'Enter quantity'} className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            {type === 'subtract' && qty > maxSubtract && (
              <p className="text-[10px] text-error-500 mt-1">Cannot remove more than current stock ({maxSubtract})</p>
            )}
          </div>

          {/* Reason (mandatory) */}
          <div>
            <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">Reason *</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. Physical count mismatch, damaged items, expired disposal…" className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none" />
            {reason.trim().length === 0 && quantity && (
              <p className="text-[10px] text-warning-500 mt-1">Reason is required for audit trail</p>
            )}
          </div>

          {/* Preview */}
          {qty > 0 && reason.trim() && (
            <div className={`p-3 rounded-lg border ${type === 'add' ? 'bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800' : 'bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-800'}`}>
              <p className={`text-xs font-medium ${type === 'add' ? 'text-success-700 dark:text-success-400' : 'text-error-700 dark:text-error-400'}`}>Adjustment Preview</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-secondary-600 dark:text-neutral-300">
                <span>{batch.currentQuantity}</span>
                <span className="text-secondary-400">{type === 'add' ? '+' : '−'}</span>
                <span>{qty}</span>
                <span className="text-secondary-400">=</span>
                <span className="font-bold text-secondary-800 dark:text-white">{newQty} units</span>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={!isValid || isSubmitting} className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-1.5 ${!isValid || isSubmitting ? 'bg-neutral-300 dark:bg-neutral-600 cursor-not-allowed' : (type === 'add' ? 'bg-success-500 hover:bg-success-600' : 'bg-error-500 hover:bg-error-600')}`}>
            {isSubmitting ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
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
