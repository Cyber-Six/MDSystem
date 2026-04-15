import React, { useState, useEffect } from 'react';
import { ITEM_CATEGORY, getDisplayLocation } from '../../medical-inventory-service';

const DOSAGE_UNITS = ['mg', 'g', 'mcg', 'ml', 'L', 'IU'];
const SUPPLY_UNITS = ['pcs', 'box', 'pack', 'set', 'kit'];

// Helper to format date for display (remove time portion)
const formatDateDisplay = (dateValue) => {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (err) {
    return dateValue;
  }
};

// Helper to check if expiry date is in the past
const isExpiryDateInPast = (expiryDate) => {
  if (!expiryDate) return false;
  try {
    const expiry = new Date(expiryDate);
    const today = new Date();
    // Set time to midnight to compare dates only
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    return expiry < today;
  } catch (err) {
    return false;
  }
};

/**
 * Add Supply Modal — receive a new batch for an existing medical item.
 * Supports both medicine batches (with dosage) and supply batches (with units).
 * @param {string} itemId - Pre-selected item ID (optional)
 * @param {Array} items - List of medical items
 * @param {Array} allowedLocations - List of locations the user has access to
 * @param {Function} onClose - Close modal handler
 * @param {Function} onSave - Save handler
 */
const AddSupplyModal = ({ itemId, items, allowedLocations = [], onClose, onSave }) => {
  const [selectedItemId, setSelectedItemId] = useState(itemId || '');
  const [form, setForm] = useState({
    batchNumber: '',
    expiryDate: '',
    quantity: '',
    dosageValue: '',
    dosageUnit: 'mg',
    unit: 'pcs',
    location: '',
    supplierName: '',
    notes: '',
  });

  // Set default location when allowedLocations changes
  useEffect(() => {
    if (allowedLocations.length > 0 && !form.location) {
      setForm(f => ({ ...f, location: allowedLocations[0] }));
    }
  }, [allowedLocations, form.location]);
  const [saveAnother, setSaveAnother] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [touched, setTouched] = useState({});

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const touch = (k) => setTouched((t) => ({ ...t, [k]: true }));

  // Validation helper: check required fields
  const validateForm = () => {
    const errors = [];
    if (!selectedItemId) errors.push('Medical Item is required');
    if (!form.batchNumber.trim()) errors.push('Batch / Lot Number is required');
    if (!form.quantity) errors.push('Number of Units is required');
    if (isMedicine && !form.dosageValue) errors.push('Dosage Value is required');
    if (!form.location) errors.push('Clinic Location is required');
    if (isMedicine && !form.expiryDate) errors.push('Expiry Date is required for medicine');
    // New validation: check if expiry date is in the past
    if (form.expiryDate && isExpiryDateInPast(form.expiryDate)) {
      errors.push(`Expiry date must be a future date (${formatDateDisplay(form.expiryDate)} is in the past)`);
    }
    return errors;
  };

  // Helper to check if a field has validation error
  const hasFieldError = (field) => {
    if (!touched[field]) return false;
    if (field === 'batchNumber') return !form.batchNumber.trim();
    if (field === 'quantity') return !form.quantity;
    if (field === 'dosageValue') return !form.dosageValue;
    if (field === 'expiryDate') return isMedicine && !form.expiryDate;
    return false;
  };
  const selectedItem = items.find((i) => String(i.id) === String(selectedItemId));
  const isMedicine = selectedItem?.category?.toLowerCase() === ITEM_CATEGORY.MEDICINE.toLowerCase();

  const resetForm = () => {
    setForm({ batchNumber: '', expiryDate: '', quantity: '', dosageValue: '', dosageUnit: 'mg', unit: 'pcs', location: allowedLocations[0] || '', supplierName: '', notes: '' });
    setTouched({});
  };

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    
    // Mark all fields as touched to show validation errors
    setTouched({
      batchNumber: true,
      quantity: true,
      dosageValue: isMedicine,
      expiryDate: isMedicine,
    });
    
    // Validate all required fields
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setSubmitError(validationErrors.join(' • '));
      return;
    }
    
    const batch = {
      medicalItemId: Number(selectedItemId),
      batchNumber: form.batchNumber.trim(),
      expiryDate: form.expiryDate || null,
      quantity: parseInt(form.quantity),
      dosageValue: isMedicine ? parseInt(form.dosageValue) : null,
      dosageUnit: form.dosageUnit,
      unit: form.unit,
      location: form.location,
      supplierName: form.supplierName.trim(),
      notes: form.notes.trim(),
      receivedAt: new Date().toISOString().split('T')[0],
      isMedicine,
    };
    setSubmitting(true);
    setSubmitError('');
    try {
      await onSave(batch);
      if (saveAnother) resetForm();
    } catch (err) {
      setSubmitError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const noExpiry = !form.expiryDate;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary-50 to-accent-50 dark:from-neutral-800 dark:to-neutral-800 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-secondary-900 dark:text-white">Add Supply</h2>
            <p className="text-[11px] text-secondary-500 dark:text-neutral-400 leading-none mt-0.5">
              {selectedItem ? `Receiving batch for ${selectedItem.item_name} (${selectedItem.category})` : 'Record a new supply batch'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
            <svg className="w-4 h-4 text-secondary-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Item selector (if not pre-set) */}
          {!itemId && (
            <div>
              <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">Medical Item *</label>
              <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} required className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                <option value="">Select item...</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.item_code} — {i.item_name}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">Batch / Lot Number *</label>
              <input 
                type="text" 
                value={form.batchNumber} 
                onChange={(e) => set('batchNumber', e.target.value)}
                onBlur={() => touch('batchNumber')}
                placeholder="e.g. CAS-PAR-003" 
                required 
                className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                  hasFieldError('batchNumber')
                    ? 'border-error-500 dark:border-error-500 focus:ring-error-500'
                    : 'border-neutral-300 dark:border-neutral-600'
                }`}
              />
              {hasFieldError('batchNumber') && (
                <p className="mt-1 text-[10px] text-error-500 font-medium flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1" clipRule="evenodd" /></svg>
                  Batch number is required
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                {isMedicine ? 'Number of Units' : 'Quantity'} *
              </label>
              <input 
                type="number" 
                min={1} 
                value={form.quantity} 
                onChange={(e) => set('quantity', e.target.value)}
                onBlur={() => touch('quantity')}
                placeholder={isMedicine ? "e.g. 50" : "e.g. 100"} 
                required 
                className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                  hasFieldError('quantity')
                    ? 'border-error-500 dark:border-error-500 focus:ring-error-500'
                    : 'border-neutral-300 dark:border-neutral-600'
                }`}
              />
              {hasFieldError('quantity') && (
                <p className="mt-1 text-[10px] text-error-500 font-medium flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1" clipRule="evenodd" /></svg>
                  Quantity is required
                </p>
              )}
              {isMedicine && form.quantity && !hasFieldError('quantity') && (
                <p className="mt-1 text-[10px] text-secondary-500 dark:text-neutral-400">
                  {form.quantity} unit{form.quantity > 1 ? 's' : ''} will be created with individual IDs
                </p>
              )}
            </div>
          </div>

          {isMedicine ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">Dosage Value *</label>
                <input 
                  type="number" 
                  min={1} 
                  value={form.dosageValue} 
                  onChange={(e) => set('dosageValue', e.target.value)}
                  onBlur={() => touch('dosageValue')}
                  placeholder="e.g. 500" 
                  required 
                  className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                    hasFieldError('dosageValue')
                      ? 'border-error-500 dark:border-error-500 focus:ring-error-500'
                      : 'border-neutral-300 dark:border-neutral-600'
                  }`}
                />
                {hasFieldError('dosageValue') && (
                  <p className="mt-1 text-[10px] text-error-500 font-medium flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1" clipRule="evenodd" /></svg>
                    Dosage value is required
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">Dosage Unit *</label>
                <select value={form.dosageUnit} onChange={(e) => set('dosageUnit', e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  {DOSAGE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">Unit *</label>
                <select value={form.unit} onChange={(e) => set('unit', e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  {SUPPLY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                Expiry Date {isMedicine ? '*' : ''}
              </label>
              <input 
                type="date" 
                value={form.expiryDate} 
                onChange={(e) => set('expiryDate', e.target.value)}
                onBlur={() => touch('expiryDate')}
                required={isMedicine}
                className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                  hasFieldError('expiryDate') || (form.expiryDate && isExpiryDateInPast(form.expiryDate))
                    ? 'border-error-500 dark:border-error-500 focus:ring-error-500'
                    : 'border-neutral-300 dark:border-neutral-600'
                }`}
              />
              {hasFieldError('expiryDate') && (
                <p className="mt-1 text-[10px] text-error-500 font-medium flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1" clipRule="evenodd" /></svg>
                  Expiry date is required
                </p>
              )}
              {form.expiryDate && isExpiryDateInPast(form.expiryDate) && (
                <p className="mt-1 text-[10px] text-error-500 font-medium flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1" clipRule="evenodd" /></svg>
                  This item is already expired
                </p>
              )}
              {!isMedicine && noExpiry && !hasFieldError('expiryDate') && !isExpiryDateInPast(form.expiryDate) && (
                <p className="mt-1 text-[10px] text-warning-600 dark:text-warning-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" /></svg>
                  No expiry set
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">Clinic Location *</label>
              <select value={form.location} onChange={(e) => set('location', e.target.value)} required className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                <option value="">Select a location...</option>
                {allowedLocations.map((l) => <option key={l} value={l}>{getDisplayLocation(l)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">Supplier Name</label>
            <input type="text" value={form.supplierName} onChange={(e) => set('supplierName', e.target.value)} placeholder="e.g. PharmaCo Manila" className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
          </div>

          <div>
            <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Optional notes" className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none" />
          </div>

          {submitError && (
            <div className="px-3 py-2 bg-error-50 dark:bg-error-900/30 border border-error-200 dark:border-error-800 text-error-700 dark:text-error-400 text-xs rounded-lg">
              {submitError}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="sticky bottom-0 bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={saveAnother} onChange={(e) => setSaveAnother(e.target.checked)} className="rounded border-neutral-300 dark:border-neutral-600 text-primary-500 focus:ring-primary-500" />
            <span className="text-xs text-secondary-500 dark:text-neutral-400">Save & Add Another</span>
          </label>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50">Cancel</button>
            <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-success-500 hover:bg-success-600 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50">
              {submitting
                ? <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Saving...</>
                : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Receive Supply</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddSupplyModal;
