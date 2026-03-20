import React, { useState, useEffect, useMemo } from 'react';

/**
 * Add Medicine to Request Modal
 * Allows staff to select a medicine to add to an existing pending medicine request
 * Features:
 * - Medicine selector dropdown (filtered to available herbs/medicines)
 * - Quantity input
 * - Validation (prevents adding duplicate medicines)
 * - Submit/Cancel actions
 */
const AddMedicineToRequestModal = ({ request, items, batchData, onConfirm, onCancel }) => {
  const [selectedMedicineId, setSelectedMedicineId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!request) return null;

  // Get list of medicines/herbs that have available stock
  const availableMedicines = useMemo(() => {
    if (!items || !batchData) return [];
    
    return items.filter(item => {
      // Only show medicines/herbs with available stock
      const isMedicineOrHerb = (item.category || '').toLowerCase().includes('medicine') || 
                                (item.category || '').toLowerCase().includes('herb');
      if (!isMedicineOrHerb) return false;
      
      // Check if it has batches with available quantity
      const itemBatches = batchData.filter(b => b.medicalItemId === item.id);
      return itemBatches.some(b => (b.availableQuantity ?? 0) > 0);
    });
  }, [items, batchData]);

  // Get already-added medicines in this request to prevent duplicates
  const alreadyAddedMedicines = useMemo(() => {
    return (request.items || []).map(item => item.medicineId);
  }, [request.items]);

  const handleSubmit = async () => {
    setError('');

    // Validate selection
    if (!selectedMedicineId) {
      setError('Please select a medicine to add');
      return;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      setError('Quantity must be at least 1');
      return;
    }

    // Check if medicine already exists in request
    if (alreadyAddedMedicines.includes(parseInt(selectedMedicineId, 10))) {
      setError('This medicine is already in the request. Edit the existing item instead.');
      return;
    }

    // Check available stock
    const selectedItem = items.find(i => i.id === parseInt(selectedMedicineId, 10));
    const itemBatches = batchData.filter(b => b.medicalItemId === selectedItem.id);
    const totalAvailable = itemBatches.reduce((sum, b) => sum + (b.availableQuantity ?? 0), 0);

    if (qty > totalAvailable) {
      setError(`Only ${totalAvailable} unit(s) available for ${selectedItem.item_name}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(request, {
        medicineId: parseInt(selectedMedicineId, 10),
        quantity: qty
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMedicine = items?.find(i => i.id === parseInt(selectedMedicineId, 10));
  const selectedBatches = selectedMedicine 
    ? batchData.filter(b => b.medicalItemId === selectedMedicine.id)
    : [];
  const availableQty = selectedBatches.reduce((sum, b) => sum + (b.availableQuantity ?? 0), 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-2xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-primary-700 dark:text-primary-400">Add Medicine to Request</h2>
        </div>

        {/* Content */}
        <div className="space-y-4 mb-5">
          {/* Request Info */}
          <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-3">
            <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Request</p>
            <div className="space-y-1">
              <div className="flex justify-between items-start gap-2">
                <span className="text-[10px] text-secondary-600 dark:text-neutral-400">ID:</span>
                <span className="text-xs font-mono font-medium text-secondary-900 dark:text-white">#{request.id}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-[10px] text-secondary-600 dark:text-neutral-400">Current Items:</span>
                <span className="text-xs font-medium text-secondary-900 dark:text-white">
                  {request.items?.length || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Medicine Selection */}
          <div>
            <label className="text-xs font-medium text-secondary-600 dark:text-neutral-400 uppercase tracking-wider block mb-2">
              Select Medicine <span className="text-error-500">*</span>
            </label>
            <select
              value={selectedMedicineId}
              onChange={(e) => {
                setSelectedMedicineId(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2 text-xs border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">-- Choose a medicine --</option>
              {availableMedicines.map((med) => {
                const isBanned = alreadyAddedMedicines.includes(med.id);
                return (
                  <option key={med.id} value={med.id} disabled={isBanned}>
                    {med.item_name} {isBanned ? '(already in request)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Stock Info */}
          {selectedMedicine && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-900/50">
              <p className="text-[10px] text-secondary-600 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
                Stock Available
              </p>
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                {availableQty} unit(s) available
              </p>
              <p className="text-[10px] text-secondary-500 dark:text-neutral-400 mt-1">
                {selectedBatches.length} batch(es)
              </p>
            </div>
          )}

          {/* Quantity Input */}
          <div>
            <label className="text-xs font-medium text-secondary-600 dark:text-neutral-400 uppercase tracking-wider block mb-2">
              Quantity <span className="text-error-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max={availableQty || 1}
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2 text-xs border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            {selectedMedicine && (
              <p className="text-[10px] text-secondary-500 dark:text-neutral-400 mt-1">
                Max: {availableQty} unit(s)
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-900/50 rounded-lg p-3">
              <p className="text-xs text-error-700 dark:text-error-400">{error}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedMedicineId}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Adding...' : 'Add Medicine'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddMedicineToRequestModal;
