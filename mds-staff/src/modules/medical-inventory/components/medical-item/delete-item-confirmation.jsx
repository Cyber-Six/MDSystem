import React, { useState } from 'react';

/**
 * Delete Item Confirmation Modal
 */
const DeleteItemConfirmation = ({ item, onClose, onConfirm }) => {
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await onConfirm(item.id);
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (!item) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-sm w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-error-50 to-error-50 dark:from-neutral-800 dark:to-neutral-800 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-error-900 dark:text-error-400">Delete Item</h2>
            <p className="text-[11px] text-error-700 dark:text-error-400/70 leading-none mt-0.5">This action cannot be undone</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
            <svg className="w-4 h-4 text-secondary-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <p className="text-sm text-secondary-700 dark:text-neutral-300">
            Are you sure you want to delete <span className="font-bold text-secondary-900 dark:text-white">{item.item_name}</span>?
          </p>
          <p className="text-xs text-secondary-500 dark:text-neutral-400">
            Item code: <span className="font-mono text-secondary-600 dark:text-neutral-300">{item.item_code}</span>
          </p>

          {deleteError && (
            <div className="px-3 py-2 bg-error-50 dark:bg-error-900/30 border border-error-200 dark:border-error-800 text-error-700 dark:text-error-400 text-xs rounded-lg">
              {deleteError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={deleting} className="px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm font-medium text-white bg-error-500 hover:bg-error-600 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
            {deleting && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>}
            {deleting ? 'Deleting...' : 'Delete Item'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteItemConfirmation;
