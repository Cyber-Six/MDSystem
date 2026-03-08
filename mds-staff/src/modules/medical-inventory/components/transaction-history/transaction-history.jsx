import React, { useState, useMemo } from 'react';

/**
 * Transaction History — full audit log of all inventory transactions.
 */
const TransactionHistory = ({ transactions }) => {
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('All');

  const actionTypes = ['All', 'receive', 'issue', 'adjust', 'transfer'];

  const ACTION_BADGES = {
    receive: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
    issue: 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400',
    adjust: 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
    transfer: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  };

  const ACTION_ICONS = {
    receive: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
    ),
    issue: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
    ),
    adjust: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
    ),
    transfer: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
    ),
  };

  const filtered = useMemo(() => {
    return (transactions || []).filter((t) => {
      if (filterAction !== 'All' && t.action !== filterAction) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          String(t.id).toLowerCase().includes(q) ||
          (t.batchNumber || '').toLowerCase().includes(q) ||
          (t.issuedByName || '').toLowerCase().includes(q) ||
          (t.itemName || '').toLowerCase().includes(q) ||
          (t.notes && t.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [transactions, search, filterAction]);

  return (
    <div className="space-y-2">
      {/* Filters bar */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search batch, user, item, notes…" className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
          </div>

          {/* Action filter */}
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="px-2 py-1.5 text-xs border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500">
            {actionTypes.map((a) => (
              <option key={a} value={a}>{a === 'All' ? 'All Actions' : a.charAt(0).toUpperCase() + a.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Count */}
      <p className="text-[10px] text-secondary-500 dark:text-neutral-400">{filtered.length} transaction{filtered.length !== 1 ? 's' : ''}</p>

      {/* Table */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b-2 border-neutral-200 dark:border-neutral-600">
              <tr className="bg-neutral-50 dark:bg-neutral-700/50">
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Date</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Action</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Item</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Batch</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider text-right">Qty</th>

                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Performed By</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <svg className="mx-auto w-8 h-8 text-secondary-300 dark:text-neutral-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    <p className="text-sm text-secondary-400 dark:text-neutral-500">No transactions match your filters</p>
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const badge = ACTION_BADGES[t.action] || 'bg-neutral-100 text-neutral-700';
                  const icon = ACTION_ICONS[t.action] || null;
                  return (
                    <tr key={t.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors">
                      <td className="px-3 py-1.5 text-xs text-secondary-600 dark:text-neutral-300 whitespace-nowrap">
                        <span>{new Date(t.issuedAt).toLocaleDateString()}</span>
                        <span className="text-[10px] text-secondary-400 dark:text-neutral-500 ml-1">{new Date(t.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${badge}`}>
                          {icon}
                          {t.action}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-xs text-secondary-700 dark:text-neutral-300">{t.itemName || '—'}</td>
                      <td className="px-3 py-1.5 text-xs font-mono text-secondary-600 dark:text-neutral-400">{t.batchNumber || '—'}</td>
                      <td className="px-3 py-1.5 text-xs font-medium text-secondary-800 dark:text-white text-right">{t.quantity > 0 ? `+${t.quantity}` : t.quantity}</td>
                      <td className="px-3 py-1.5 text-xs text-secondary-600 dark:text-neutral-300">{t.issuedByName || '—'}</td>
                      <td className="px-3 py-1.5 text-xs text-secondary-500 dark:text-neutral-400 max-w-[180px] truncate" title={t.notes}>{t.notes || '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TransactionHistory;
