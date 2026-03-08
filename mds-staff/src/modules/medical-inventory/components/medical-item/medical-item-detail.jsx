import React, { useState } from 'react';
import { getExpiryStatus, CATEGORY_COLORS } from '../../inventory-seed-data';

/**
 * Medical Item Detail — batch table (FEFO sorted) + transaction history.
 * Matches the appointment-detail-modal layout but as a full page.
 */
const MedicalItemDetail = ({ item, transactions, onBack, onAddSupply, onSplit, onAdjust }) => {
  const [tab, setTab] = useState('batches');

  // Sort batches FEFO: earliest expiry first, null last, then by receivedAt
  const sortedBatches = [...(item.batches || [])].sort((a, b) => {
    if (!a.expiryDate && !b.expiryDate) return new Date(a.receivedAt) - new Date(b.receivedAt);
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;
    return new Date(a.expiryDate) - new Date(b.expiryDate);
  });

  const actionMap = {
    issue: 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400',
    receive: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
    adjust: 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
    transfer: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
  };

  return (
    <div className="space-y-2">
      {/* Merged Header + Stock Summary Card */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
        {/* Header row */}
        <div className="px-3 py-2.5 flex items-center gap-3">
          <button onClick={onBack} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md transition-colors shrink-0">
            <svg className="w-4 h-4 text-secondary-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-secondary-800 dark:text-white truncate m-0">{item.item_name}</h2>
                <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded capitalize shrink-0 ${CATEGORY_COLORS[item.category] || ''}`}>{item.category}</span>
              </div>
              <p className="text-[10px] text-secondary-400 dark:text-neutral-500 leading-none m-0">{item.item_code} · {item.subcategory || 'No subcategory'} · {item.description || ''}</p>
          </div>
          <button onClick={onAddSupply} className="px-3 py-1.5 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-md transition-colors flex items-center gap-1 shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Supply
          </button>
        </div>

        {/* Separator */}
        <div className="border-t border-neutral-200 dark:border-neutral-700" />

        {/* Stock Summary Strip */}
        <div className="px-3 py-2.5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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

      {/* Tabs: Batches | Transactions */}
      <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-700/50 p-0.5 rounded-lg w-fit">
        <button onClick={() => setTab('batches')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === 'batches' ? 'bg-primary-500 text-white shadow-sm' : 'text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'}`}>
          Batches ({sortedBatches.length})
        </button>
        <button onClick={() => setTab('transactions')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === 'transactions' ? 'bg-primary-500 text-white shadow-sm' : 'text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'}`}>
          Transactions ({transactions.length})
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
                  <th className="px-3 py-1.5 text-center text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Initial</th>
                  <th className="px-3 py-1.5 text-center text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Current</th>
                  <th className="px-3 py-1.5 text-center text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Used %</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Received</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Supplier</th>
                  <th className="px-3 py-1.5 text-center text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {sortedBatches.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-6 text-center text-xs text-secondary-400 dark:text-neutral-500">No batches for this item. Add supply to get started.</td></tr>
                )}
                {sortedBatches.map((batch, idx) => {
                  const st = getExpiryStatus(batch.expiryDate);
                  const usedPct = batch.initialQuantity > 0 ? Math.round(((batch.initialQuantity - batch.currentQuantity) / batch.initialQuantity) * 100) : 0;
                  return (
                    <tr key={batch.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50">
                      <td className="px-3 py-1.5">
                        {idx === 0 && (
                          <span className="inline-flex px-1 py-0.5 text-[8px] font-bold rounded bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400" title="First to be dispensed (FEFO)">FEFO</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-xs font-mono text-secondary-700 dark:text-neutral-300">{batch.batchNumber}</td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded ${batch.location === 'Casal' ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400' : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'}`}>{batch.location}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-secondary-700 dark:text-neutral-300">{batch.expiryDate || '—'}</span>
                          <span className={`inline-flex px-1 py-0.5 text-[10px] font-medium rounded ${st.color}`}>{st.label}</span>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-center text-xs text-secondary-500 dark:text-neutral-400">{batch.initialQuantity}</td>
                      <td className="px-3 py-1.5 text-center text-xs font-medium text-secondary-800 dark:text-white">{batch.currentQuantity}</td>
                      <td className="px-3 py-1.5 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          <div className="w-12 h-1.5 bg-neutral-200 dark:bg-neutral-600 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${usedPct >= 80 ? 'bg-error-500' : usedPct >= 50 ? 'bg-warning-500' : 'bg-success-500'}`} style={{ width: `${usedPct}%` }}></div>
                          </div>
                          <span className="text-[10px] text-secondary-400 dark:text-neutral-500">{usedPct}%</span>
                        </div>
                      </td>
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

      {/* Transaction History Tab */}
      {tab === 'transactions' && (
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-700/50 border-b-2 border-neutral-200 dark:border-neutral-600">
                <tr>
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Action</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Batch</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Qty</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Patient</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">By</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Notes</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {transactions.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-xs text-secondary-400 dark:text-neutral-500">No transactions recorded yet</td></tr>
                )}
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50">
                    <td className="px-3 py-1.5"><span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded capitalize ${actionMap[tx.action] || ''}`}>{tx.action}</span></td>
                    <td className="px-3 py-1.5 text-xs font-mono text-secondary-500 dark:text-neutral-400">{tx.batchNumber}</td>
                    <td className="px-3 py-1.5 text-xs font-medium text-secondary-800 dark:text-white">{tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}</td>
                    <td className="px-3 py-1.5 text-xs text-secondary-600 dark:text-neutral-300">{tx.patientName || '—'}</td>
                    <td className="px-3 py-1.5 text-xs text-secondary-500 dark:text-neutral-400">{tx.issuedByName}</td>
                    <td className="px-3 py-1.5 text-xs text-secondary-400 dark:text-neutral-500 max-w-[200px] truncate">{tx.notes}</td>
                    <td className="px-3 py-1.5 text-xs text-secondary-400 dark:text-neutral-500">{new Date(tx.issuedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalItemDetail;
