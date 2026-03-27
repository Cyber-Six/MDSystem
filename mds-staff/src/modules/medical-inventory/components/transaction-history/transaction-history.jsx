import React, { useState, useMemo } from 'react';

/**
 * Transaction History — full audit log of all inventory transactions (global view).
 * Enhanced with better visual design, icons, and filtering.
 */
const TransactionHistory = ({ transactions }) => {
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('All');
  const [sortOrder, setSortOrder] = useState('newest');

  const actionTypes = ['All', 'receive', 'issue', 'adjust', 'transfer'];

  // Enhanced action configuration with icons and colors
  const ACTION_CONFIG = {
    receive: {
      badge: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      label: 'Received',
    },
    issue: {
      badge: 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      ),
      label: 'Dispensed',
    },
    adjust: {
      badge: 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      label: 'Adjusted',
    },
    transfer: {
      badge: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      label: 'Transferred',
    },
  };

  const filtered = useMemo(() => {
    let results = [...(transactions || [])];

    // Filter by action
    if (filterAction !== 'All') {
      results = results.filter((t) => t.action === filterAction);
    }

    // Filter by search
    if (search) {
      const q = search.toLowerCase();
      results = results.filter((t) =>
        String(t.id).toLowerCase().includes(q) ||
        (t.batchNumber || '').toLowerCase().includes(q) ||
        (t.issuedByName || '').toLowerCase().includes(q) ||
        (t.itemName || '').toLowerCase().includes(q) ||
        (t.patientName || '').toLowerCase().includes(q) ||
        (t.notes && t.notes.toLowerCase().includes(q))
      );
    }

    // Sort
    results.sort((a, b) => {
      const dateA = new Date(a.issuedAt);
      const dateB = new Date(b.issuedAt);
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return results;
  }, [transactions, search, filterAction, sortOrder]);

  const formatDateTime = (dateStr) => {
    try {
      const date = new Date(dateStr);
      const dateFormatted = date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
      const timeFormatted = date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
      return { date: dateFormatted, time: timeFormatted };
    } catch {
      return { date: '—', time: '' };
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Filters Bar */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID, batch, user, item, notes…"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* Action Filter */}
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-2 py-1.5 text-xs border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {actionTypes.map((a) => (
              <option key={a} value={a}>
                {a === 'All' ? 'All Actions' : a.charAt(0).toUpperCase() + a.slice(1)}
              </option>
            ))}
          </select>

          {/* Sort Order */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-2 py-1.5 text-xs border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Count indicator */}
      <p className="text-[10px] text-secondary-500 dark:text-neutral-400 px-1">
        {filtered.length} transaction{filtered.length !== 1 ? 's' : ''} {search && `matching "${search}"`}
      </p>

      {/* Table */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-neutral-200 dark:border-neutral-600">
              <tr className="bg-neutral-50 dark:bg-neutral-700/50">
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Date & Time</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Action</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Item</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Batch #</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider text-right">Qty</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">By / Recipient</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <svg className="mx-auto w-8 h-8 text-secondary-300 dark:text-neutral-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <p className="text-sm text-secondary-400 dark:text-neutral-500">
                      {search ? 'No transactions match your search' : 'No transactions recorded yet'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const config = ACTION_CONFIG[t.action] || { badge: '', icon: null, label: t.action };
                  const { date, time } = formatDateTime(t.issuedAt);
                  const qtyDisplay = t.quantity > 0 ? `+${t.quantity}` : t.quantity;
                  const issuedByAndRecipient = t.action === 'issue' ? `To: ${t.patientName || '—'} / By: ${t.issuedByName}` : `By: ${t.issuedByName || '—'}`;

                  return (
                    <tr key={t.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors">
                      <td className="px-3 py-1.5 text-xs text-secondary-600 dark:text-neutral-300 whitespace-nowrap">
                        <div className="text-[10px]">{date}</div>
                        <div className="text-[10px] text-secondary-400 dark:text-neutral-500 font-mono">{time}</div>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${config.badge}`}>
                          {config.icon}
                          {config.label}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-xs font-semibold text-secondary-700 dark:text-neutral-200">{t.itemName || '—'}</td>
                      <td className="px-3 py-1.5 text-xs font-mono text-secondary-600 dark:text-neutral-400">{t.batchNumber || '—'}</td>
                      <td className="px-3 py-1.5 text-xs font-bold text-secondary-800 dark:text-white text-right">
                        <span className={t.quantity > 0 ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'}>
                          {qtyDisplay}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-xs text-secondary-600 dark:text-neutral-300 max-w-[160px] truncate" title={issuedByAndRecipient}>
                        {issuedByAndRecipient}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-secondary-500 dark:text-neutral-400 max-w-[200px] truncate" title={t.notes || '—'}>
                        {t.notes || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend - shown only when viewing all actions */}
      {!search && filterAction === 'All' && transactions.length > 0 && (
        <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700 p-2.5">
          <p className="text-[10px] font-semibold text-secondary-600 dark:text-neutral-400 mb-1.5">Action Legend:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(ACTION_CONFIG).map(([key, config]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={`inline-flex p-1 rounded-md ${config.badge}`}>{config.icon}</div>
                <span className="text-[10px] text-secondary-600 dark:text-neutral-300">{config.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
