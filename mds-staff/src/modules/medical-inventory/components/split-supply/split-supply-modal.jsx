import React, { useState } from 'react';
import { LOCATIONS } from '../../inventory-seed-data';

/**
 * Split Supply Modal — transfer stock from one batch to another clinic.
 * Accepts allBatches to compute merged total (siblings with same batch#/location/item).
 */
const SplitSupplyModal = ({ batch, allBatches, onClose, onSplit }) => {
  const otherClinics = LOCATIONS.filter((l) => l !== batch.location);
  const [toClinic, setToClinic] = useState(otherClinics[0] || '');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate merged total available (all siblings with same batchNumber+location+item)
  const totalAvailable = (allBatches || [])
    .filter((b) =>
      b.batchNumber === batch.batchNumber &&
      b.location === batch.location &&
      String(b.medicalItemId) === String(batch.medicalItemId)
    )
    .reduce((sum, b) => sum + (b.availableQuantity ?? b.currentQuantity ?? 0), 0);

  const qty = parseInt(quantity) || 0;
  const isValid = qty > 0 && qty <= totalAvailable && toClinic;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await onSplit({ sourceBatchId: batch.id, quantity: qty, toClinic, notes });
    } finally {
      setIsSubmitting(false);
    }
  };

  const pct = totalAvailable > 0 ? Math.round((qty / totalAvailable) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-secondary-900 dark:text-white">Split / Transfer Supply</h2>
            <p className="text-[11px] text-secondary-500 dark:text-neutral-400 leading-none mt-0.5">Transfer stock from {batch.location} to another clinic</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
            <svg className="w-4 h-4 text-secondary-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Source Info */}
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
              <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Available</p>
              <p className="text-xs font-bold text-secondary-800 dark:text-white">{totalAvailable} units</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">Destination Clinic *</label>
            <select value={toClinic} onChange={(e) => setToClinic(e.target.value)} disabled={isSubmitting} className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed">
              {otherClinics.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">Quantity to Transfer *</label>
            <input type="number" min={1} max={totalAvailable} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={`Max: ${totalAvailable}`} disabled={isSubmitting} className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed" />
            {/* Visual slider */}
            <input type="range" min={0} max={totalAvailable} value={qty} onChange={(e) => setQuantity(e.target.value)} disabled={isSubmitting} className="w-full mt-2 accent-primary-500 disabled:opacity-50 disabled:cursor-not-allowed" />
            <div className="flex justify-between text-[10px] text-secondary-400 dark:text-neutral-500">
              <span>0</span>
              <span>{qty > 0 ? `${qty} units (${pct}%)` : 'Select quantity'}</span>
              <span>{totalAvailable}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">Notes / Reason</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Reason for transfer" disabled={isSubmitting} className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed" />
          </div>

          {/* Preview */}
          {qty > 0 && (
            <div className="p-3 bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-800 rounded-lg">
              <p className="text-xs text-accent-700 dark:text-accent-400 font-medium">Transfer Preview</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-secondary-600 dark:text-neutral-300">
                <span className="font-medium">{batch.location}</span>
                <span className="text-secondary-400">→</span>
                <span className="font-medium">{toClinic}</span>
                <span className="ml-auto font-bold">{qty} units</span>
              </div>
              <p className="text-[10px] text-secondary-400 dark:text-neutral-500 mt-1">Remaining at {batch.location}: {batch.currentQuantity - qty}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
          <button onClick={handleSubmit} disabled={!isValid || isSubmitting} className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-1 ${isValid && !isSubmitting ? 'bg-accent-500 hover:bg-accent-600' : 'bg-neutral-300 dark:bg-neutral-600 cursor-not-allowed'}`}>
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Processing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                Confirm Split
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SplitSupplyModal;
