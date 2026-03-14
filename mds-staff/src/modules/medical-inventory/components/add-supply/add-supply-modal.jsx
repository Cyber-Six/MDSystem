import React, { useState } from 'react';
import { ITEM_CATEGORY, ALL_LOCATIONS, getDisplayLocation } from '../../medical-inventory-service';

const DOSAGE_UNITS = ['mg', 'g', 'mcg', 'ml', 'L', 'IU'];
const SUPPLY_UNITS = ['pcs', 'box', 'pack', 'set', 'kit'];

/**
 * Add Supply Modal — receive a new batch for an existing medical item.
 * Supports both medicine batches (with dosage) and supply batches (with units).
 */
const AddSupplyModal = ({ itemId, items, onClose, onSave }) => {
  const [selectedItemId, setSelectedItemId] = useState(itemId || '');
  const [form, setForm] = useState({
    batchNumber: '',
    expiryDate: '',
    quantity: '',
    dosageValue: '',
    dosageUnit: 'mg',
    unit: 'pcs',
    location: 'Casal',
    supplierName: '',
    notes: '',
  });
  const [saveAnother, setSaveAnother] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const selectedItem = items.find((i) => String(i.id) === String(selectedItemId));
  const isMedicine = selectedItem?.category?.toLowerCase() === ITEM_CATEGORY.MEDICINE.toLowerCase();

  const resetForm = () => {
    setForm({ batchNumber: '', expiryDate: '', quantity: '', dosageValue: '', dosageUnit: 'mg', unit: 'pcs', location: 'Casal', supplierName: '', notes: '' });
  };

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!selectedItemId || !form.batchNumber.trim()) return;
    if (!form.quantity) return;
    if (isMedicine && !form.dosageValue) return;
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
              <input type="text" value={form.batchNumber} onChange={(e) => set('batchNumber', e.target.value)} placeholder="e.g. CAS-PAR-003" required className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                {isMedicine ? 'Number of Units' : 'Quantity'} *
              </label>
              <input type="number" min={1} value={form.quantity} onChange={(e) => set('quantity', e.target.value)} placeholder={isMedicine ? "e.g. 50" : "e.g. 100"} required className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              {isMedicine && form.quantity && (
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
                <input type="number" min={1} value={form.dosageValue} onChange={(e) => set('dosageValue', e.target.value)} placeholder="e.g. 500" required className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
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
              <input type="date" value={form.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} required={isMedicine} className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              {!isMedicine && noExpiry && (
                <p className="mt-1 text-[10px] text-warning-600 dark:text-warning-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" /></svg>
                  No expiry set
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">Clinic Location *</label>
              <select value={form.location} onChange={(e) => set('location', e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                {ALL_LOCATIONS.map((l) => <option key={l} value={l}>{getDisplayLocation(l)}</option>)}
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
