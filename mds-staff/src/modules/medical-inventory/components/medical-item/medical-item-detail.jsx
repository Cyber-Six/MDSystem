import React, { useState } from 'react';
import { getExpiryStatus, CATEGORY_COLORS } from '../../inventory-seed-data';
import { getDisplayLocation } from '../../medical-inventory-service';
import TransactionHistory from '../transaction-history/transaction-history';

// Helper to format date for display (remove time portion)
const formatDateDisplay = (dateValue) => {
  if (!dateValue) return '—';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (err) {
    return '—';
  }
};

/**
 * Medical Item Detail — batch table (FEFO sorted) + transaction history.
 * Matches the appointment-detail-modal layout but as a full page.
 */
const MedicalItemDetail = ({ item, loading, transactions, onBack, onAddSupply, onSplit, onAdjust, onEditItem, onDeleteItem }) => {
  const [tab, setTab] = useState('batches');

  // Sort batches FEFO: earliest expiry first, null last, then by receivedAt
  const sortedBatches = [...(item.batches || [])].sort((a, b) => {
    if (!a.expiryDate && !b.expiryDate) return new Date(a.receivedAt) - new Date(b.receivedAt);
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;
    return new Date(a.expiryDate) - new Date(b.expiryDate);
  });

  return (
    <div className="space-y-2">
      {/* Merged Header + Stock Summary Card */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
        {/* Header row */}
        <div className="px-3 py-2.5 flex items-center gap-3">
          <button onClick={onBack} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md transition-colors shrink-0">
            <svg className="w-4 h-4 text-secondary-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          {loading ? (
            <div className="flex-1 space-y-1 animate-pulse">
              <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-48" />
              <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-72" />
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-secondary-800 dark:text-white truncate m-0">{item.item_name}</h2>
                <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded capitalize shrink-0 ${CATEGORY_COLORS[item.category?.toLowerCase()] || ''}`}>{item.category}</span>
              </div>
              <p className="text-[10px] text-secondary-400 dark:text-neutral-500 leading-none m-0">{item.item_code} · {item.description || ''}</p>
            </div>
          )}
          <button onClick={onAddSupply} className="px-3 py-1.5 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-md transition-colors flex items-center gap-1 shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Supply
          </button>
          <button onClick={() => onEditItem(item)} className="px-3 py-1.5 text-xs font-medium text-secondary-700 dark:text-neutral-300 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-md transition-colors flex items-center gap-1 shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            Edit
          </button>
          <button onClick={() => onDeleteItem(item)} className="px-3 py-1.5 text-xs font-medium text-error-700 dark:text-error-400 bg-error-100 dark:bg-error-900/30 hover:bg-error-200 dark:hover:bg-error-900/50 rounded-md transition-colors flex items-center gap-1 shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Delete
          </button>
        </div>

        {/* Separator */}
        <div className="border-t border-neutral-200 dark:border-neutral-700" />

        {/* Stock Summary Strip */}
        <div className="px-3 py-2.5">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div>
              <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Total Stock</p>
              <p className="text-lg font-bold text-secondary-800 dark:text-white leading-tight">{item.totalStock}</p>
            </div>
            <div>
              <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Casal</p>
              <p className="text-sm font-semibold text-secondary-700 dark:text-neutral-200 leading-tight">{item.casalStock}</p>
            </div>
            <div>
              <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Arlegui</p>
              <p className="text-sm font-semibold text-secondary-700 dark:text-neutral-200 leading-tight">{item.arlegui}</p>
            </div>
            <div>
              <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Quezon City</p>
              <p className="text-sm font-semibold text-secondary-700 dark:text-neutral-200 leading-tight">{item.quezonCity}</p>
            </div>
            <div>
              <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Reorder Level</p>
              <p className="text-sm font-semibold text-secondary-700 dark:text-neutral-200 leading-tight">{item.reorder_level}</p>
            </div>
            <div>
              <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Status</p>
              {item.isLowStock
                ? <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400">Low Stock</span>
                : <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400">Adequate</span>
              }
            </div>
          </div>
        </div>
      </div>

      {/* Tab: Batches */}
      <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-700/50 p-0.5 rounded-lg w-fit">
        <button onClick={() => setTab('batches')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === 'batches' ? 'bg-primary-500 text-white shadow-sm' : 'text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'}`}>
          Batches ({sortedBatches.length})
        </button>
        <button onClick={() => setTab('history')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === 'history' ? 'bg-primary-500 text-white shadow-sm' : 'text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'}`}>
          History ({(transactions || []).length})
        </button>
      </div>

      {/* Batch Table */}
      {tab === 'batches' && (
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-700/50 border-b-2 border-neutral-200 dark:border-neutral-600">
                <tr>
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider w-5">
                    <svg className="w-3 h-3 text-accent-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2L3 7l7 5 7-5-7-5zM3 12l7 5 7-5" /></svg>
                  </th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Batch #</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Location</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Expiry</th>
                  {item.category?.toLowerCase() === 'medicine' ? (
                    <>
                      <th className="px-3 py-1.5 text-center text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Dosage</th>
                      <th className="px-3 py-1.5 text-center text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Quantity</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-1.5 text-center text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Initial</th>
                      <th className="px-3 py-1.5 text-center text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Current</th>
                      <th className="px-3 py-1.5 text-center text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Used %</th>
                    </>
                  )}
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Received</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Supplier</th>
                  <th className="px-3 py-1.5 text-center text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {sortedBatches.length === 0 && (
                  <tr><td colSpan={item.category?.toLowerCase() === 'medicine' ? 9 : 10} className="px-4 py-6 text-center text-xs text-secondary-400 dark:text-neutral-500">No batches for this item. Add supply to get started.</td></tr>
                )}
                {sortedBatches.map((batch, idx) => {
                  const st = getExpiryStatus(batch.expiryDate);
                  const isMedicineBatch = item.category?.toLowerCase() === 'medicine';
                  const usedPct = !isMedicineBatch && batch.initialQuantity > 0 ? Math.round(((batch.initialQuantity - batch.currentQuantity) / batch.initialQuantity) * 100) : 0;
                  return (
                    <tr key={`${batch.medicalItemId}-${batch.id}`} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50">
                      <td className="px-3 py-1.5">
                        {idx === 0 && (
                          <span className="inline-flex px-1 py-0.5 text-[8px] font-bold rounded bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400" title="First to be dispensed (FEFO)">FEFO</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-xs font-mono text-secondary-700 dark:text-neutral-300">{batch.batchNumber}</td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded ${batch.location === 'Casal' ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400' : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'}`}>{getDisplayLocation(batch.location)}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-secondary-700 dark:text-neutral-300">{formatDateDisplay(batch.expiryDate)}</span>
                          <span className={`inline-flex px-1 py-0.5 text-[10px] font-medium rounded ${st.color}`}>{st.label}</span>
                        </div>
                      </td>
                      {isMedicineBatch ? (
                        <>
                          <td className="px-3 py-1.5 text-center text-xs font-medium text-secondary-800 dark:text-white">
                            {batch.dosageValue != null ? `${batch.dosageValue} ${batch.dosageUnit || ''}` : '—'}
                          </td>
                          <td className="px-3 py-1.5 text-center text-xs font-bold text-secondary-800 dark:text-white">{batch.currentQuantity ?? '0'} units</td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-1.5 text-center text-xs text-secondary-500 dark:text-neutral-400">{batch.initialQuantity ?? '—'}</td>
                          <td className="px-3 py-1.5 text-center text-xs font-medium text-secondary-800 dark:text-white">{batch.currentQuantity ?? '—'}</td>
                          <td className="px-3 py-1.5 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <div className="w-12 h-1.5 bg-neutral-200 dark:bg-neutral-600 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${usedPct >= 80 ? 'bg-error-500' : usedPct >= 50 ? 'bg-warning-500' : 'bg-success-500'}`} style={{ width: `${usedPct}%` }}></div>
                              </div>
                              <span className="text-[10px] text-secondary-400 dark:text-neutral-500">{usedPct}%</span>
                            </div>
                          </td>
                        </>
                      )}
                      <td className="px-3 py-1.5 text-xs text-secondary-500 dark:text-neutral-400">{batch.receivedAt ? new Date(batch.receivedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                      <td className="px-3 py-1.5 text-xs text-secondary-500 dark:text-neutral-400">{batch.supplierName || '—'}</td>
                      <td className="px-3 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => onSplit(batch)} className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline font-medium" title="Split / Transfer to other clinic">Split</button>
                          <span className="text-neutral-300 dark:text-neutral-600">·</span>
                          <button onClick={() => onAdjust(batch)} className="text-[10px] text-warning-600 dark:text-warning-400 hover:underline font-medium" title="Adjust stock quantity">Adjust</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <TransactionHistory transactions={transactions} />
      )}

    </div>
  );
};

export default MedicalItemDetail;
