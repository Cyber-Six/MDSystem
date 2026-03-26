import React from 'react';
import { getExpiryStatus } from '../../inventory-seed-data';

const ExpiringItemsModal = ({ isOpen, onClose, items, batches, onSelectItem }) => {
  if (!isOpen) return null;

  // Get all expiring and expired batches
  const expiringSoon = batches.filter((b) => {
    if (!b.expiryDate) return false;
    const days = Math.ceil((new Date(b.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
    return days > 0 && days <= 60;
  });

  const expiredBatches = batches.filter((b) => b.expiryDate && new Date(b.expiryDate) < new Date());
  const allBatches = [...expiredBatches, ...expiringSoon].sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-lg max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-lg font-bold text-secondary-800 dark:text-white">
            All Expiring Items <span className="text-secondary-400 dark:text-neutral-500 text-sm">({allBatches.length})</span>
          </h2>
          <button
            onClick={onClose}
            className="text-secondary-400 hover:text-secondary-600 dark:hover:text-neutral-400 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {allBatches.length === 0 ? (
            <div className="p-6 text-center text-secondary-400 dark:text-neutral-500">
              No batches expiring soon
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
              {allBatches.map((batch) => {
                const st = getExpiryStatus(batch.expiryDate);
                const item = items.find((i) => String(i.id) === String(batch.medicalItemId));
                const daysUntil = batch.expiryDate 
                  ? Math.ceil((new Date(batch.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
                  : null;

                return (
                  <button
                    key={`${batch.medicalItemId}-${batch.id}`}
                    onClick={() => {
                      if (item) {
                        onSelectItem(item);
                        onClose();
                      }
                    }}
                    className="w-full text-left px-6 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-secondary-800 dark:text-white m-0">
                        {item?.item_name || 'Unknown'}
                      </p>
                      <p className="text-xs text-secondary-400 dark:text-neutral-500 m-0">
                        Batch: {batch.batchNumber} · Location: {batch.location}
                      </p>
                      <p className="text-xs text-secondary-400 dark:text-neutral-500 m-0">
                        Expiry: {new Date(batch.expiryDate).toLocaleDateString()} 
                        {daysUntil !== null && (
                          <span className={daysUntil < 0 ? 'text-error-600 dark:text-error-400' : 'text-warning-600 dark:text-warning-400'}>
                            {' '}({daysUntil < 0 ? `${Math.abs(daysUntil)} days ago` : `${daysUntil} days left`})
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium text-secondary-800 dark:text-white m-0">
                          {batch.currentQuantity} units
                        </p>
                        <p className="text-xs text-secondary-400 dark:text-neutral-500 m-0">
                          {item?.category === 'medicine' ? 'Medicine' : 'Supply'}
                        </p>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${st.color} whitespace-nowrap`}>
                        {st.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-700/30 flex justify-between items-center">
          <p className="text-xs text-secondary-500 dark:text-neutral-400">
            {allBatches.length} batches total
            {expiredBatches.length > 0 && `, ${expiredBatches.length} already expired`}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-secondary-800 dark:text-white bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpiringItemsModal;
