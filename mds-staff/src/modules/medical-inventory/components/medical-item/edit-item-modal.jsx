import React, { useState, useEffect } from 'react';
import { ALL_CATEGORIES } from '../../medical-inventory-service';

/**
 * Edit Medical Item Modal — updates an existing MedicalItems record.
 * Item code cannot be changed (primary identifier).
 */
const EditItemModal = ({ item, onClose, onSave }) => {
  const [form, setForm] = useState({
    item_name: '',
    category: 'Medicine',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [touched, setTouched] = useState({});

  useEffect(() => {
    if (item) {
      setForm({
        item_name: item.item_name || '',
        category: item.category || 'Medicine',
        description: item.description || '',
      });
    }
  }, [item]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const touch = (k) => setTouched((t) => ({ ...t, [k]: true }));

  const isComplete = form.item_name.trim();
  const hasError = (field) => touched[field] && !form[field]?.trim() && field !== 'description';

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    
    // Mark all fields as touched
    setTouched({ item_name: true });
    
    if (!isComplete) return;
    
    setSubmitting(true);
    setSubmitError('');
    try {
      await onSave(form);
    } catch (err) {
      const message = err.message || 'Failed to save. Please try again.';
      if (err.response?.status === 409 || message.includes('409')) {
        setSubmitError('This item name is already in use.');
      } else if (message.includes('duplicate') || message.includes('unique')) {
        setSubmitError('Duplicate field error. Please check your input.');
      } else {
        setSubmitError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!item) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary-50 to-accent-50 dark:from-neutral-800 dark:to-neutral-800 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-secondary-900 dark:text-white">Edit Medical Item</h2>
            <p className="text-[11px] text-secondary-500 dark:text-neutral-400 leading-none mt-0.5">{item.item_code}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
            <svg className="w-4 h-4 text-secondary-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">Item Code</label>
              <input type="text" value={item.item_code} disabled className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-neutral-100 dark:bg-neutral-700 text-secondary-500 dark:text-neutral-500 cursor-not-allowed opacity-60" />
              <p className="text-[10px] text-secondary-400 dark:text-neutral-500 mt-1">Cannot be changed</p>
            </div>
            <div>
              <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">Category *</label>
              <select value={form.category} onChange={(e) => set('category', e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
              Item Name <span className="text-error-500">*</span>
            </label>
            <input 
              type="text" 
              value={form.item_name} 
              onChange={(e) => set('item_name', e.target.value)}
              onBlur={() => touch('item_name')}
              placeholder="e.g. Paracetamol 500mg" 
              required 
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                hasError('item_name')
                  ? 'border-error-500 dark:border-error-500 focus:ring-error-500'
                  : 'border-neutral-300 dark:border-neutral-600'
              }`}
            />
            {hasError('item_name') && (
              <div className="flex items-center gap-1 mt-1.5">
                <svg className="w-3.5 h-3.5 text-error-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                <p className="text-[10px] text-error-500 font-medium">Item name is required</p>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} placeholder="Brief description" className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none" />
          </div>

          {!isComplete && Object.keys(touched).length > 0 && (
            <div className="px-3 py-2 bg-warning-50 dark:bg-warning-900/30 border border-warning-200 dark:border-warning-800 rounded-lg flex items-start gap-2">
              <svg className="w-4 h-4 text-warning-600 dark:text-warning-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              <div>
                <p className="text-xs font-medium text-warning-800 dark:text-warning-400">Incomplete Form</p>
                <p className="text-[11px] text-warning-700 dark:text-warning-300/80 mt-0.5">Please fill in all required fields marked with <span className="text-error-500 font-bold">*</span></p>
              </div>
            </div>
          )}

          {submitError && (
            <div className="px-3 py-2.5 bg-error-50 dark:bg-error-900/30 border-l-4 border-error-500 rounded-lg flex items-start gap-2">
              <svg className="w-4 h-4 text-error-600 dark:text-error-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
              <div>
                <p className="text-xs font-bold text-error-700 dark:text-error-400">Error</p>
                <p className="text-[11px] text-error-600 dark:text-error-300/90 mt-0.5">{submitError}</p>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="sticky bottom-0 bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || !isComplete} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${
            isComplete
              ? 'text-white bg-primary-500 hover:bg-primary-600'
              : 'text-neutral-400 dark:text-neutral-500 bg-neutral-200 dark:bg-neutral-700 cursor-not-allowed'
          }`}>
            {submitting && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>}
            {submitting ? 'Saving...' : isComplete ? 'Update Item' : 'Fill Required Fields'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditItemModal;
