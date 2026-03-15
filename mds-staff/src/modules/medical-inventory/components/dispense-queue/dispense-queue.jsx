import React, { useState, useMemo } from 'react';
import { STATUS_BADGES } from '../../inventory-seed-data';

/**
 * Dispense Queue — shows pending doctor / student medicine requests.
 * Key feature: "QTY PENDING" badge when quantity is null (student self-request).
 */
const DispenseQueue = ({ requests, items, onDispense, onApprove, onReject }) => {
  const [search, setSearch] = useState('');
  const [filterClinic, setFilterClinic] = useState('All');
  const [filterStatus, setFilterStatus] = useState('Pending');

  // Helper to format date safely
  const formatDate = (dateValue) => {
    if (!dateValue) return '—';
    try {
      let date;
      if (typeof dateValue === 'number') {
        date = new Date(dateValue * 1000);
      } else if (typeof dateValue === 'string') {
        date = new Date(dateValue);
      } else {
        date = dateValue;
      }
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleDateString();
    } catch (err) {
      return '—';
    }
  };

  const itemMap = useMemo(() => {
    const m = {};
    (items || []).forEach((i) => (m[i.id] = i));
    return m;
  }, [items]);

  const filtered = useMemo(() => {
    return (requests || []).filter((r) => {
      if (filterStatus !== 'All' && r.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        const itemId = r.items?.[0]?.itemId;
        const item = itemMap[itemId];
        const name = item ? item.item_name.toLowerCase() : (r.items?.[0]?.itemName || '').toLowerCase();
        return (
          r.patientName.toLowerCase().includes(q) ||
          String(r.id).toLowerCase().includes(q) ||
          name.includes(q)
        );
      }
      return true;
    });
  }, [requests, search, filterClinic, filterStatus, itemMap]);

  const statusOptions = ['All', 'Pending', 'Approved', 'Rejected', 'Cancelled'];

  return (
    <div className="space-y-2">
      {/* Filters bar */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient or item…" className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
          </div>

          {/* Status filter */}
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2 py-1.5 text-xs border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500">
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s === 'All' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Count */}
      <p className="text-[10px] text-secondary-500 dark:text-neutral-400">{filtered.length} request{filtered.length !== 1 ? 's' : ''} found</p>

      {/* Table */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b-2 border-neutral-200 dark:border-neutral-600">
              <tr className="bg-neutral-50 dark:bg-neutral-700/50">
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">ID</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Patient</th>
                <th className="px-3 py-1.5 text[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Item</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Qty</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Purpose</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Type</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Date</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Status</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Transaction ID</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Notes</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Approved By</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center">
                    <svg className="mx-auto w-8 h-8 text-secondary-300 dark:text-neutral-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    <p className="text-sm text-secondary-400 dark:text-neutral-500">No requests match your filters</p>
                  </td>
                </tr>
              ) : (
                filtered.map((req) => {
                  const item = itemMap[req.items?.[0]?.itemId];
                  const badge = STATUS_BADGES[req.status] || 'bg-neutral-100 text-neutral-700';
                  const isStudentReq = req.items?.[0]?.quantity === null;
                  return (
                    <tr key={req.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors">
                      <td className="px-3 py-1.5 text-xs font-mono text-secondary-600 dark:text-neutral-300">#{req.id}</td>
                      <td className="px-3 py-1.5">
                        <p className="text-xs font-medium text-secondary-800 dark:text-white leading-none m-0">{req.patientName}</p>
                        {req.patientId && <p className="text-[10px] text-secondary-400 dark:text-neutral-500 leading-none m-0">ID: {req.patientId}</p>}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-secondary-700 dark:text-neutral-300">
                        {req.items?.map((item, idx) => (
                          <div key={idx} className="text-xs">{item.itemName || '—'}{item.quantity && ` (qty: ${item.quantity})`}</div>
                        )) || '—'}
                      </td>
                      <td className="px-3 py-1.5">
                        {req.items?.length > 0 ? (
                          <span className="text-xs font-medium text-secondary-800 dark:text-white">{req.items?.reduce((sum, i) => sum + (i.quantity || 0), 0)}</span>
                        ) : (
                          <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400">QTY PENDING</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-secondary-600 dark:text-neutral-400 max-w-[160px] truncate" title={req.purpose}>{req.purpose || '—'}</td>
                      <td className="px-3 py-1.5">
                        <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-neutral-100 dark:bg-neutral-700 text-secondary-600 dark:text-neutral-300">{req.patientType}</span>
                      </td>
                      <td className="px-3 py-1.5 text-xs text-secondary-500 dark:text-neutral-400">
                        {formatDate(req.created_at)}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded ${badge}`}>{req.status}</span>
                      </td>
                      <td className="px-3 py-1.5 text-xs text-secondary-600 dark:text-neutral-400">{req.transactionId ? `#${req.transactionId}` : '—'}</td>
                      <td className="px-3 py-1.5 text-xs text-secondary-600 dark:text-neutral-400 max-w-[120px] truncate" title={req.notes}>{req.notes || '—'}</td>
                      <td className="px-3 py-1.5 text-xs text-secondary-600 dark:text-neutral-400">{req.approved_by ? `Staff #${req.approved_by}` : '—'}</td>
                      <td className="px-3 py-1.5 text-right">
                        {req.status === 'Pending' && (
                          <div className="inline-flex items-center gap-1">
                            <button onClick={() => onApprove?.(req)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              Approve
                            </button>
                            <button onClick={() => onReject?.(req)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              Reject
                            </button>
                          </div>
                        )}
                        {(req.status === 'InProgress' || req.status === 'Approved') && (
                          <button onClick={() => onDispense(req)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Dispense
                          </button>
                        )}
                      </td>
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

export default DispenseQueue;
