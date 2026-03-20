import React, { useState, useMemo } from 'react';
import { getExpiryStatus } from '../../inventory-seed-data';

/**
 * Dispense Modal — FEFO allocation preview + confirm dispense.
 * Shows which batches will be consumed and how many from each.
 * Handles multiple items in a single request.
 */
const DispenseModal = ({ request, items, batches, onClose, onConfirm }) => {
  const requestItems = request.items || [];
  const [manualQties, setManualQties] = useState(() => {
    const initial = {};
    requestItems.forEach((item, idx) => {
      const isStudent = item.quantity === null || item.quantity === undefined;
      initial[idx] = isStudent ? '' : String(item.quantity ?? '');
    });
    return initial;
  });
  const [notes, setNotes] = useState('');
  // Track selected batch for each item (when multiple batches available)
  const [selectedBatches, setSelectedBatches] = useState(() => {
    const initial = {};
    requestItems.forEach((item, idx) => {
      initial[idx] = null; // null = auto-select FIFO
    });
    return initial;
  });

  // Helper to format date safely
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
      return date.toLocaleDateString();
    } catch (err) {
      return '—';
    }
  };

  // Build allocation for all items
  const allocation = useMemo(() => {
    const allAllocations = [];
    console.log('🔧 Building allocation from:', { requestItemsCount: requestItems.length, manualQties, selectedBatches });
    
    requestItems.forEach((reqItem, itemIdx) => {
      const qty = parseInt(manualQties[itemIdx]) || 0;
      if (qty <= 0) {
        console.log(`  Item ${itemIdx}: qty=${qty} (skipped)`);
        return;
      }
      
      console.log(`  Item ${itemIdx} (${reqItem.itemName}): requesting ${qty} units`);
      
      // Get batches for this specific item
      let itemBatches = batches
        .filter((b) => {
          const available = Number(b.availableQuantity ?? b.currentQuantity ?? 0);
          const sameItem = reqItem?.itemId
            ? String(b.medicalItemId) === String(reqItem.itemId)
            : false;
          return sameItem && available > 0;
        })
        .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
      
      console.log(`    Found ${itemBatches.length} available batches`);
      
      // If a specific batch is selected, use only that batch
      const selectedBatchId = selectedBatches[itemIdx];
      if (selectedBatchId) {
        const selectedBatch = itemBatches.find(b => b.id === selectedBatchId);
        if (selectedBatch) {
          itemBatches = [selectedBatch];
          console.log(`    Using selected batch ${selectedBatchId}`);
        }
      }
      
      // FEFO allocation for this item
      let remaining = qty;
      for (const b of itemBatches) {
        if (remaining <= 0) break;
        const available = b.availableQuantity || b.currentQuantity || 0;
        const take = Math.min(remaining, available);
        console.log(`    Batch ${b.id}: available=${available}, taking=${take}`);
        allAllocations.push({
          ...b,
          itemIdx,
          itemId: reqItem.itemId,
          itemName: reqItem.itemName,
          allocate: take,
          remainAfter: available - take,
        });
        remaining -= take;
      }
      console.log(`    Item ${itemIdx} remaining after allocation: ${remaining}`);
    });
    
    const totalAllocated = allAllocations.reduce((s, a) => s + a.allocate, 0);
    console.log('✅ Total allocation built:', { totalAllocations: allAllocations.length, totalAllocated });
    return allAllocations;
  }, [batches, manualQties, requestItems, selectedBatches]);

  // Validate all items are fully allocated
  const allQtiesValid = requestItems.every((item, idx) => {
    const qty = parseInt(manualQties[idx]) || 0;
    if (qty <= 0) return false;
    const itemAllocations = allocation.filter(a => a.itemIdx === idx);
    const allocated = itemAllocations.reduce((s, a) => s + a.allocate, 0);
    return allocated >= qty;
  });

  // ✅ PART 1: Frontend validation - check if any batch has insufficient stock
  const stockWarnings = allocation
    .filter(a => {
      const available = Number(a.availableQuantity ?? a.currentQuantity ?? 0);
      return a.allocate > available;
    })
    .map(a => {
      const available = Number(a.availableQuantity ?? a.currentQuantity ?? 0);
      return `Batch ${a.batchNumber}: only ${available} unit${available !== 1 ? 's' : ''} available, but requesting ${a.allocate} units`;
    });
  
  const isValid = allQtiesValid && allocation.length > 0 && stockWarnings.length === 0;

  const handleSubmit = () => {
    if (!isValid) return;
    const totalAllocated = allocation.reduce((s, a) => s + a.allocate, 0);
    console.log('📋 Submission details:', {
      itemCount: requestItems.length,
      quantities: manualQties,
      allocationCount: allocation.length,
      totalAllocated,
      allocation: allocation.map(a => ({ id: a.id, itemIdx: a.itemIdx, allocate: a.allocate }))
    });
    onConfirm({ request, quantity: Object.values(manualQties).reduce((s, q) => s + (parseInt(q) || 0), 0), allocation, notes });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary-50 to-accent-50 dark:from-neutral-800 dark:to-neutral-800 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 z-10">
          <h2 className="text-sm font-bold text-secondary-900 dark:text-white">Dispense Medicine</h2>
          <p className="text-[11px] text-secondary-500 dark:text-neutral-400 leading-none m-0 mt-1">FEFO allocation preview — {requestItems.length} item{requestItems.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="p-4 space-y-3">
          {/* Patient info */}
          <div className="p-2 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg">
            <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider m-0">Patient</p>
            <p className="text-xs font-medium text-secondary-800 dark:text-white leading-none m-0">{request.patientName}</p>
            {request.patientId && <p className="text-[10px] text-secondary-400 dark:text-neutral-500 leading-none m-0">{request.patientId}</p>}
          </div>

          {/* Requested by info */}
          <div className="flex items-center gap-2 text-xs text-secondary-500 dark:text-neutral-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Requested by {request.patientType} patient on {formatDate(request.created_at ?? request.createdAt ?? request.requestDate)}
          </div>

          {/* Items and Quantities */}
          <div className="space-y-3 border-t border-neutral-200 dark:border-neutral-700 pt-3">
            <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Items to Dispense *</p>
            {requestItems.map((reqItem, idx) => {
              const isStudent = reqItem.quantity === null || reqItem.quantity === undefined;
              const qty = parseInt(manualQties[idx]) || 0;
              const itemAllocations = allocation.filter(a => a.itemIdx === idx);
              const allocated = itemAllocations.reduce((s, a) => s + a.allocate, 0);
              const isFullyAllocated = allocated >= qty && qty > 0;
              const totalAvailable = batches
                .filter(b => String(b.medicalItemId) === String(reqItem.itemId))
                .reduce((s, b) => s + (b.availableQuantity || b.currentQuantity || 0), 0);
              
              // Get available batches for this item (sorted FIFO)
              const availableBatchesForItem = batches
                .filter(b => {
                  const available = Number(b.availableQuantity ?? b.currentQuantity ?? 0);
                  return String(b.medicalItemId) === String(reqItem.itemId) && available > 0;
                })
                .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
              
              const hasMultipleBatches = availableBatchesForItem.length > 1;
              const selectedBatchId = selectedBatches[idx];
              const selectedBatchObj = selectedBatchId 
                ? availableBatchesForItem.find(b => b.id === selectedBatchId)
                : availableBatchesForItem[0]; // Default to FIFO (first/oldest)
              
              return (
                <div key={idx} className="p-3 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg border border-neutral-200 dark:border-neutral-600">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider m-0">Item {idx + 1}</p>
                      <p className="text-xs font-medium text-secondary-800 dark:text-white m-0">{reqItem.itemName || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider m-0">Available</p>
                      <p className="text-xs font-medium text-secondary-800 dark:text-white m-0">{totalAvailable} units</p>
                    </div>
                  </div>
                  
                  {/* Batch Selector (if multiple batches available) */}
                  {hasMultipleBatches && (
                    <div className="mb-2">
                      <label className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                        Select Batch (Default: FIFO)
                      </label>
                      <select
                        value={selectedBatchId || 'fifo'}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedBatches({
                            ...selectedBatches,
                            [idx]: value === 'fifo' ? null : Number(value)
                          });
                        }}
                        className="w-full px-3 py-2 text-sm border border-primary-300 dark:border-primary-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="fifo">FIFO (Oldest first)</option>
                        {availableBatchesForItem.map((batch) => {
                          const available = batch.availableQuantity || batch.currentQuantity || 0;
                          const expStatus = getExpiryStatus(batch.expiryDate);
                          const expBadge = expStatus === 'expired' ? ' [EXPIRED]' : expStatus === 'critical' ? ' [CRITICAL]' : '';
                          return (
                            <option key={batch.id} value={batch.id}>
                              Batch {batch.batchNumber} — Exp: {new Date(batch.expiryDate).toLocaleDateString()} ({available} units){expBadge}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                  
                  <label className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                    Quantity {isStudent && <span className="text-warning-500">(Not specified)</span>}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={totalAvailable}
                    value={manualQties[idx]}
                    onChange={(e) => setManualQties({ ...manualQties, [idx]: e.target.value })}
                    placeholder={`Max: ${totalAvailable}`}
                    className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${isStudent ? 'border-warning-400 dark:border-warning-600' : 'border-neutral-300 dark:border-neutral-600'}`}
                  />
                  {qty > totalAvailable && (
                    <p className="text-[10px] text-error-500 mt-1">Insufficient stock. Only {totalAvailable} available.</p>
                  )}
                  {qty > 0 && !isFullyAllocated && (
                    <p className="text-[10px] text-error-500 mt-1">Not enough stock for requested quantity.</p>
                  )}
                  {qty > 0 && isFullyAllocated && (
                    <p className="text-[10px] text-success-600 dark:text-success-400 mt-1">✓ Fully allocated ({allocated} units)</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* ✅ PART 1: Stock Validation Warning */}
          {stockWarnings.length > 0 && (
            <div className="px-3 py-2 bg-error-50 dark:bg-error-900/30 border border-error-200 dark:border-error-800 rounded-lg">
              <div className="flex gap-2">
                <svg className="w-4 h-4 text-error-600 dark:text-error-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-xs text-error-700 dark:text-error-400">
                  <p className="font-medium mb-1">⚠️ Stock is too low to dispense requested quantity:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {stockWarnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

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
          {allocation.length > 0 && (
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
                {allQtiesValid && (
                  <span className="text-success-600 dark:text-success-400 font-medium flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Fully allocated
                  </span>
                )}
                {!allQtiesValid && (
                  <span className="text-error-500 font-medium">
                    Not all items are fully allocated
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
