import React, { useState, useMemo } from 'react';
import { getExpiryStatus } from '../../inventory-seed-data';

/**
 * Dispense Modal — FEFO allocation preview + confirm dispense.
 * Shows which batches will be consumed and how many from each.
 * For student (null quantity) requests, allows staff to set quantity first.
 */
const DispenseModal = ({ request, items, batches, onClose, onConfirm }) => {
  const reqItem = request.items?.[0];
  const item = (items || []).find((i) => i.id === reqItem?.itemId) || null;
  const isStudentReq = reqItem?.quantity === null || reqItem?.quantity === undefined;
  const [manualQty, setManualQty] = useState(isStudentReq ? '' : String(reqItem?.quantity ?? ''));
  const [notes, setNotes] = useState('');
  const qty = parseInt(manualQty) || 0;

  // Helper to format date safely
  const formatDate = (dateValue) => {
    if (!dateValue) return '—';
    try {
      let date;
      if (typeof dateValue === 'number') {
        date = new Date(dateValue * 1000);
      } else if (typeof dateValue === 'string') {
        date = new Date(dateValue);
      } else {
        date = dateValue;
      }
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleDateString();
    } catch (err) {
      return '—';
    }
  };

  /* FEFO batch allocation: sort by expiry ASC, then allocate qty */
  const clinicBatches = useMemo(() => {
    return batches
      .filter((b) => {
        const qty = b.availableQuantity || b.currentQuantity || 0;
        return b.medicalItemId === reqItem?.itemId && qty > 0;
      })
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  }, [batches, reqItem?.itemId]);

  const totalAvailable = clinicBatches.reduce((s, b) => s + (b.availableQuantity || b.currentQuantity || 0), 0);

  const allocation = useMemo(() => {
    if (qty <= 0) return [];
    let remaining = qty;
    const result = [];
    for (const b of clinicBatches) {
      if (remaining <= 0) break;
      const available = b.availableQuantity || b.currentQuantity || 0;
      const take = Math.min(remaining, available);
      result.push({ ...b, allocate: take, remainAfter: available - take });
      remaining -= take;
    }
    return result;
  }, [clinicBatches, qty]);

  const fullyAllocated = allocation.reduce((s, a) => s + a.allocate, 0) >= qty && qty > 0;
  const isValid = qty > 0 && fullyAllocated;

  const handleSubmit = () => {
    if (!isValid) return;
    onConfirm({ request, quantity: qty, allocation, notes });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary-50 to-accent-50 dark:from-neutral-800 dark:to-neutral-800 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 z-10">
          <h2 className="text-sm font-bold text-secondary-900 dark:text-white">Dispense Medicine</h2>
          <p className="text-[11px] text-secondary-500 dark:text-neutral-400 leading-none m-0 mt-1">FEFO allocation preview — {reqItem?.itemName || 'item'}</p>
        </div>

        <div className="p-4 space-y-3">
          {/* Patient + Item info */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="p-2 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg">
              <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider m-0">Patient</p>
              <p className="text-xs font-medium text-secondary-800 dark:text-white leading-none m-0">{request.patientName}</p>
              {request.patientId && <p className="text-[10px] text-secondary-400 dark:text-neutral-500 leading-none m-0">{request.patientId}</p>}
            </div>
            <div className="p-2 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg">
              <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider m-0">Item</p>
              <p className="text-xs font-medium text-secondary-800 dark:text-white leading-none m-0">{reqItem?.itemName || (item ? item.item_name : '—')}</p>
              <p className="text-[10px] text-secondary-400 dark:text-neutral-500 leading-none m-0">{item ? item.item_code : ''}</p>
            </div>
          </div>

          {/* Requested by info */}
          <div className="flex items-center gap-2 text-xs text-secondary-500 dark:text-neutral-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Requested by {request.patientType} patient on {formatDate(request.created_at)}
          </div>

          {/* Quantity input */}
          <div>
            <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
              Dispense Quantity *
              {isStudentReq && <span className="ml-1 text-warning-500">(Student request — qty not specified)</span>}
            </label>
            <input
              type="number"
              min={1}
              max={totalAvailable}
              value={manualQty}
              onChange={(e) => setManualQty(e.target.value)}
              placeholder={`Available: ${totalAvailable}`}
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${isStudentReq ? 'border-warning-400 dark:border-warning-600' : 'border-neutral-300 dark:border-neutral-600'}`}
            />
            {qty > totalAvailable && (
              <p className="text-[10px] text-error-500 mt-1">Insufficient stock. Only {totalAvailable} available.</p>
            )}
          </div>

          {/* Dispense Notes */}
          <div>
            <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
              Dispense Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional: Add instructions or notes (e.g., dosage instructions, special requirements)…"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
          </div>

          {/* FEFO Allocation Preview */}
          {qty > 0 && (
            <div>
              <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2">FEFO Allocation Preview</p>
              <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-neutral-50 dark:bg-neutral-700/50">
                      <th className="px-3 py-2 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Batch</th>
                      <th className="px-3 py-2 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Expiry</th>
                      <th className="px-3 py-2 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider text-right">Available</th>
                      <th className="px-3 py-2 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider text-right">Allocate</th>
                      <th className="px-3 py-2 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider text-right">Remain</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                    {allocation.map((a) => {
                      const expStatus = getExpiryStatus(a.expiryDate);
                      const expColor =
                        expStatus === 'expired'
                          ? 'text-error-600 dark:text-error-400'
                          : expStatus === 'critical'
                          ? 'text-warning-600 dark:text-warning-400'
                          : 'text-secondary-600 dark:text-neutral-300';
                      return (
                        <tr key={a.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50">
                          <td className="px-3 py-2 text-xs font-mono text-secondary-700 dark:text-neutral-300">{a.batchNumber}</td>
                          <td className={`px-3 py-2 text-xs ${expColor}`}>{formatDate(a.expiryDate)}</td>
                          <td className="px-3 py-2 text-xs text-right text-secondary-600 dark:text-neutral-400">{a.availableQuantity || a.currentQuantity || 0}</td>
                          <td className="px-3 py-2 text-xs text-right font-bold text-primary-600 dark:text-primary-400">{a.allocate}</td>
                          <td className="px-3 py-2 text-xs text-right text-secondary-500 dark:text-neutral-400">{a.remainAfter}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Allocation summary */}
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-secondary-500 dark:text-neutral-400">
                  Using {allocation.length} batch{allocation.length !== 1 ? 'es' : ''}
                </span>
                {!fullyAllocated && (
                  <span className="text-error-500 font-medium">
                    Cannot fully allocate — need {qty - allocation.reduce((s, a) => s + a.allocate, 0)} more
                  </span>
                )}
                {fullyAllocated && (
                  <span className="text-success-600 dark:text-success-400 font-medium flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Fully allocated
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={!isValid} className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-1 ${isValid ? 'bg-primary-500 hover:bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-600 cursor-not-allowed'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Confirm Dispense
          </button>
        </div>
      </div>
    </div>
  );
};

export default DispenseModal;
