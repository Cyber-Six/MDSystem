import React, { useState, useMemo } from 'react';

/**
 * Enhanced Transaction Display — Activity log for medical items
 * Shows all inventory movements (dispense, transfer, adjust, receive) with context
 */
const TransactionDisplay = ({ transactions }) => {
  const [filterAction, setFilterAction] = useState('All');
  const [sortOrder, setSortOrder] = useState('newest'); // newest or oldest
  const [search, setSearch] = useState('');



  // Action configuration with icons and colors
  const ACTION_CONFIG = {
    add: {
      label: 'ADD',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7" />
        </svg>
      ),
      badge: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 border border-success-200 dark:border-success-800',
      description: 'New supply added to stock',
    },
    adjust_add: {
      label: 'ADJUST +',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      badge: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border border-primary-200 dark:border-primary-800',
      description: 'Stock manually increased',
    },
    adjust_minus: {
      label: 'ADJUST −',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      ),
      badge: 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400 border border-warning-200 dark:border-warning-800',
      description: 'Stock manually decreased',
    },
    transfer: {
      label: 'SPLIT',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      badge: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border border-primary-200 dark:border-primary-800',
      description: 'Stock split to another location',
    },
  };

  // Filter and sort transactions
  const filtered = useMemo(() => {
    let results = [...(transactions || [])];

    // Filter by action
    if (filterAction !== 'All') {
      results = results.filter((t) => t.action === filterAction);
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      results = results.filter((t) =>
        (t.batchNumber || '').toLowerCase().includes(q) ||
        (t.issuedByName || '').toLowerCase().includes(q) ||
        (t.patientName || '').toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q)
      );
    }

    // Sort
    results.sort((a, b) => {
      const dateA = new Date(a.issuedAt);
      const dateB = new Date(b.issuedAt);
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return results;
  }, [transactions, filterAction, search, sortOrder]);

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

  const getActionDescription = (transaction) => {
    const config = ACTION_CONFIG[transaction.action] || {};
    let description = config.description || 'Unknown action';

    if (transaction.action === 'add') {
      description = `Added ${transaction.quantity} unit${transaction.quantity !== 1 ? 's' : ''} to stock`;
      if (transaction.notes) description += ` · ${transaction.notes}`;
    } else if (transaction.action === 'adjust_add') {
      description = `Increased by ${Math.abs(transaction.quantity)} unit${Math.abs(transaction.quantity) !== 1 ? 's' : ''}`;
      if (transaction.notes) description += ` · ${transaction.notes}`;
    } else if (transaction.action === 'adjust_minus') {
      description = `Decreased by ${Math.abs(transaction.quantity)} unit${Math.abs(transaction.quantity) !== 1 ? 's' : ''}`;
      if (transaction.notes) description += ` · ${transaction.notes}`;
    } else if (transaction.action === 'transfer') {
      description = transaction.notes || 'Stock split to another location';
    }

    return description;
  };

  const getQuantityDisplay = (transaction) => {
    if (!transaction.quantity) return '0';
    if (transaction.quantity > 0) {
      return `+${transaction.quantity}`;
    }
    return transaction.quantity.toString();
  };

  return (
    <div className="space-y-3">
      {/* Filters Bar */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search batch, staff, patient…"
              className="w-full pl-8 pr-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Action Filter */}
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-2 text-xs border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="All">All Actions</option>
            <option value="add">Add Supply</option>
            <option value="adjust_add">Adjust (Increase)</option>
            <option value="adjust_minus">Adjust (Decrease)</option>
            <option value="transfer">Split / Transfer</option>
          </select>

          {/* Sort Order */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-3 py-2 text-xs border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Transaction Count */}
      <div className="text-xs text-secondary-500 dark:text-neutral-400 px-1">
        {filtered.length} transaction{filtered.length !== 1 ? 's' : ''} {search && `matching "${search}"`}
      </div>

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 py-8 px-4 text-center">
          <svg className="mx-auto w-10 h-10 text-secondary-300 dark:text-neutral-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm font-medium text-secondary-600 dark:text-neutral-300 mb-1">No transactions found</p>
          <p className="text-xs text-secondary-400 dark:text-neutral-500">
            {search ? 'Try adjusting your search criteria' : 'No activity recorded yet for this item'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Transaction Cards */}
          {filtered.map((transaction) => {
            const config = ACTION_CONFIG[transaction.action] || ACTION_CONFIG.adjust;
            const { date, time } = formatDateTime(transaction.issuedAt);
            const qty = getQuantityDisplay(transaction);
            const description = getActionDescription(transaction);

            return (
              <div key={transaction.id} className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors">
                <div className="flex gap-3">
                  {/* Icon */}
                  <div className={`shrink-0 p-2 rounded-lg ${config.badge}`}>
                    {config.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Header: Action + Batch + Quantity */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${config.badge}`}>
                        {config.label}
                      </span>
                      <span className="text-[10px] text-secondary-500 dark:text-neutral-400 font-mono">
                        Batch: {transaction.batchNumber || '—'}
                      </span>
                      <span className={`text-xs font-bold ${transaction.quantity > 0 ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'}`}>
                        {qty} units
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-secondary-700 dark:text-neutral-200 mb-2 leading-snug">
                      {description}
                    </p>

                    {/* Meta: Staff, Date/Time, Notes (if any) */}
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="text-[10px]">
                        <span className="text-secondary-500 dark:text-neutral-400">By: </span>
                        <span className="text-secondary-700 dark:text-neutral-300 font-medium">
                          {transaction.issuedByName || '—'}
                        </span>
                      </div>
                      <div className="text-[10px]">
                        <span className="text-secondary-500 dark:text-neutral-400">
                          {date}
                        </span>
                        <span className="text-secondary-500 dark:text-neutral-400 mx-1">·</span>
                        <span className="text-secondary-500 dark:text-neutral-400 font-mono">
                          {time}
                        </span>
                      </div>

                      {transaction.notes && (
                        <div className="text-[10px] flex-1 min-w-0">
                          <span className="text-secondary-500 dark:text-neutral-400">Notes: </span>
                          <span className="text-secondary-600 dark:text-neutral-300 truncate" title={transaction.notes}>
                            {transaction.notes}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Transaction ID (subtle) */}
                  <div className="shrink-0 text-[10px] text-secondary-400 dark:text-neutral-500 text-right">
                    #{transaction.id}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      {!search && filterAction === 'All' && transactions.length > 0 && (
        <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700 p-2.5 mt-4">
          <p className="text-[10px] font-semibold text-secondary-600 dark:text-neutral-400 mb-1.5">Action Reference:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(ACTION_CONFIG).map(([key, config]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={`p-1 rounded-md ${config.badge}`}>{config.icon}</div>
                <span className="text-[10px] text-secondary-600 dark:text-neutral-300">{config.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionDisplay;
