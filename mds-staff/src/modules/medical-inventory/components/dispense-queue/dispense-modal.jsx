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
      // Check if this specific item has an approved quantity
      const approvedQty = request.approvedQuantities?.[idx];
      if (approvedQty !== undefined && approvedQty !== null) {
        initial[idx] = String(approvedQty);
      } else {
        // Fall back to original request quantity
        const isStudent = item.quantity === null || item.quantity === undefined;
        initial[idx] = isStudent ? '' : String(item.quantity ?? '');
      }
    });
    return initial;
  });
  const [manualBatchSelection, setManualBatchSelection] = useState(() => {
    const initial = {};
    // Pre-select approved batch if available per item
    requestItems.forEach((item, idx) => {
      const approvedBatchId = request.approvedBatchIds?.[idx];
      if (approvedBatchId !== undefined && approvedBatchId !== null) {
        initial[idx] = String(approvedBatchId);
      }
    });
    return initial;
  }); // Track manually selected batches per item idx
  const [notes, setNotes] = useState('');

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
    
    requestItems.forEach((reqItem, itemIdx) => {
      const qty = parseInt(manualQties[itemIdx]) || 0;
      if (qty <= 0) return;
      
      // Get batches for this specific item, filtered by request location
      let itemBatches = batches
        .filter((b) => {
          const available = Number(b.availableQuantity ?? b.currentQuantity ?? 0);
          const sameItem = reqItem?.itemId
            ? String(b.medicalItemId) === String(reqItem.itemId)
            : false;
          const sameLocation = request?.location
            ? b.location === request.location
            : true;
          
          return sameItem && available > 0 && sameLocation;
        })
        .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
      
      // If a batch was manually selected for this item, prioritize it
      const selectedBatchId = manualBatchSelection[itemIdx];
      if (selectedBatchId) {
        const selectedBatch = itemBatches.find(b => String(b.id) === String(selectedBatchId));
        if (selectedBatch) {
          // Put selected batch first in the order
          itemBatches = [selectedBatch, ...itemBatches.filter(b => String(b.id) !== String(selectedBatchId))];
        }
      }
      
      // FEFO allocation for this item
      let remaining = qty;
      for (const b of itemBatches) {
        if (remaining <= 0) break;
        const available = b.availableQuantity || b.currentQuantity || 0;
        const take = Math.min(remaining, available);
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
    });
    
    return allAllocations;
  }, [batches, manualQties, requestItems, request, manualBatchSelection]);

  // Validate all items are fully allocated
  const allQtiesValid = requestItems.every((item, idx) => {
    const qty = parseInt(manualQties[idx]) || 0;
    if (qty <= 0) return false;
    const itemAllocations = allocation.filter(a => a.itemIdx === idx);
    const allocated = itemAllocations.reduce((s, a) => s + a.allocate, 0);
    return allocated >= qty;
  });
  
  const isValid = allQtiesValid && allocation.length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    onConfirm({ request, quantity: Object.values(manualQties).reduce((s, q) => s + (parseInt(q) || 0), 0), allocation, notes });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-primary-500 dark:bg-primary-600 px-4 py-3 z-10">
          <h2 className="text-sm font-bold text-white">Dispense Medicine</h2>
        </div>

        <div className="p-4 space-y-4">
          {/* Patient info - compact */}
          <div className="text-sm">
            <p>
              <span className="font-medium text-neutral-900 dark:text-white">{request.patientName}</span>
              {request.patientId && <span className="text-[11px] text-neutral-600 dark:text-neutral-300"> (ID: {request.patientId})</span>}
            </p>
          </div>

          {/* Items */}
          <div className="space-y-3 border-t border-neutral-200 dark:border-neutral-700 pt-3">
            <p className="text-xs font-medium text-neutral-900 dark:text-white uppercase">Items</p>
            {requestItems.map((reqItem, idx) => {
              const isStudent = reqItem.quantity === null || reqItem.quantity === undefined;
              const qty = parseInt(manualQties[idx]) || 0;
              const itemAllocations = allocation.filter(a => a.itemIdx === idx);
              const allocated = itemAllocations.reduce((s, a) => s + a.allocate, 0);
              const isFullyAllocated = allocated >= qty && qty > 0;
              const totalAvailable = batches
                .filter(b => {
                  const sameItem = String(b.medicalItemId) === String(reqItem.itemId);
                  const sameLocation = request?.location ? b.location === request.location : true;
                  return sameItem && sameLocation;
                })
                .reduce((s, b) => s + (b.availableQuantity || b.currentQuantity || 0), 0);
              
              return (
                <div key={idx} className="bg-neutral-50 dark:bg-neutral-700/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-neutral-900 dark:text-white">
                        {reqItem.itemName || '—'}
                      </p>
                      <p className="text-[11px] text-neutral-600 dark:text-neutral-300">
                        {totalAvailable} available
                      </p>
                    </div>
                    {request.approvedQuantities?.[idx] && (
                      <span className="text-[10px] px-2 py-1 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 rounded font-medium">
                        ✓ Approved
                      </span>
                    )}
                  </div>

                  {/* Qty input */}
                  <input
                    type="number"
                    min={1}
                    max={totalAvailable}
                    value={manualQties[idx]}
                    onChange={(e) => {
                      if (!request.approvedQuantities?.[idx]) {
                        setManualQties({ ...manualQties, [idx]: e.target.value });
                      }
                    }}
                    readOnly={request.approvedQuantities?.[idx] !== undefined && request.approvedQuantities?.[idx] !== null}
                    placeholder={`Max: ${totalAvailable}`}
                    className={`w-full px-2 py-1.5 text-sm rounded border text-neutral-900 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400 ${
                      request.approvedQuantities?.[idx]
                        ? 'bg-success-50 dark:bg-success-900/10 border-success-300 dark:border-success-600 cursor-not-allowed'
                        : isStudent
                        ? 'border-warning-300 dark:border-warning-600 bg-white dark:bg-neutral-700'
                        : 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700'
                    }`}
                  />

                  {/* Batch select - compact */}
                  {qty > 0 && (
                    <select
                      value={manualBatchSelection[idx] || ''}
                      onChange={(e) => {
                        if (!request.approvedBatchIds?.[idx]) {
                          setManualBatchSelection({ ...manualBatchSelection, [idx]: e.target.value });
                        }
                      }}
                      disabled={request.approvedBatchIds?.[idx] !== undefined && request.approvedBatchIds?.[idx] !== null}
                      className={`w-full px-2 py-1.5 text-sm rounded border text-neutral-900 dark:text-white ${
                        request.approvedBatchIds?.[idx]
                          ? 'bg-success-50 dark:bg-success-900/10 border-success-300 dark:border-success-600 cursor-not-allowed opacity-75'
                          : 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700'
                      }`}
                    >
                      <option value="">Auto (FEFO)</option>
                      {batches
                        .filter((b) => {
                          const available = Number(b.availableQuantity ?? b.currentQuantity ?? 0);
                          const sameItem = String(b.medicalItemId) === String(reqItem.itemId);
                          const sameLocation = request?.location ? b.location === request.location : true;
                          return sameItem && available > 0 && sameLocation;
                        })
                        .map((batch) => (
                          <option key={batch.id} value={batch.id}>
                            {batch.batchNumber} (Exp: {formatDate(batch.expiryDate)})
                          </option>
                        ))}
                    </select>
                  )}

                  {/* Status */}
                  {qty > 0 && isFullyAllocated ? (
                    <p className="text-[11px] text-success-600 dark:text-success-400 font-medium">
                      ✓ Fully allocated
                    </p>
                  ) : qty > 0 && !isFullyAllocated ? (
                    <p className="text-[11px] text-error-600 dark:text-error-400">
                      ✗ Not enough stock
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Notes - simple */}
          <div className="border-t border-neutral-200 dark:border-neutral-700 pt-3">
            <label className="text-xs font-medium text-neutral-900 dark:text-white uppercase block mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes…"
              rows={2}
              className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Footer - simple */}
        <div className="sticky bottom-0 bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-sm font-medium text-neutral-900 dark:text-white bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className={`flex-1 px-3 py-2 text-sm font-medium text-white rounded transition-colors ${
              isValid
                ? 'bg-primary-500 hover:bg-primary-600'
                : 'bg-neutral-300 dark:bg-neutral-600 cursor-not-allowed'
            }`}
          >
            Complete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DispenseModal;
