import React, { useState, useMemo, useEffect } from 'react';
import { STATUS_BADGES } from '../../inventory-seed-data';

const APPROVAL_EXPIRY_DAYS = 7;

// Read approval timestamp from localStorage (written by parent on approval)
const getApprovalAgeDays = (requestId) => {
  try {
    const raw = localStorage.getItem(`mds_inv_approved_${requestId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const approvedAt = parsed?.approvedAt;
    if (!approvedAt) return null;
    return (Date.now() - approvedAt) / (24 * 60 * 60 * 1000);
  } catch { return null; }
};

/**
 * Dispense Queue — shows pending doctor / student medicine requests.
 * Key feature: "QTY PENDING" badge when quantity is null (student self-request).
 * @param {Array} requests - Medicine requests
 * @param {Array} items - Medical items
 * @param {Array} batches - Medicine batches
 * @param {Array} allowedLocations - List of locations the user has access to
 * @param {Function} onDispense - Dispense handler
 * @param {Function} onApprove - Approve handler
 * @param {Function} onReject - Reject handler
 * @param {Function} onCancel - Cancel approved request handler
 * @param {string|number} focusPatientId - Patient ID to focus on
 * @param {Function} onClearFocus - Clear focus handler
 */
const DispenseQueue = ({ requests, items, batches, allowedLocations = [], onDispense, onApprove, onReject, onCancel, focusPatientId, onClearFocus }) => {
  const [search, setSearch] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedPurpose, setSelectedPurpose] = useState(null);
  const [selectedNotes, setSelectedNotes] = useState(null);
  const [cancelConfirmReq, setCancelConfirmReq] = useState(null);

  // Set default filter location when allowedLocations changes
  useEffect(() => {
    if (allowedLocations.length > 0 && !filterLocation) {
      setFilterLocation(allowedLocations[0]);
    }
  }, [allowedLocations, filterLocation]);

  // Helper to format date safely
  const formatDate = (dateValue) => {
    if (!dateValue) return '—';
    try {
      let date;
      if (typeof dateValue === 'number') {
        date = new Date(dateValue * 1000);
      } else if (typeof dateValue === 'string') {
        const trimmed = dateValue.trim();
        if (/^\d+$/.test(trimmed)) {
          const numeric = Number(trimmed);
          date = new Date(trimmed.length >= 13 ? numeric : numeric * 1000);
        } else {
          date = new Date(trimmed);
        }
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

  const batchMap = useMemo(() => {
    const m = {};
    (batches || []).forEach((b) => (m[b.id] = b));
    return m;
  }, [batches]);

  const filtered = useMemo(() => {
    return (requests || []).filter((r) => {
      // When a specific patient is focused, show all their requests across all locations/statuses
      if (focusPatientId) {
        return String(r.patientId) === String(focusPatientId);
      }

      if (filterStatus !== 'All' && r.status !== filterStatus) return false;

      // Use the request's location field directly from the backend
      // The MedicineRequestLog table stores location when the request is created
      const reqLocation = r.location || null;

      // Filter by selected location tab
      if (reqLocation !== filterLocation) return false;
      
      // Search
      if (search) {
        const q = search.toLowerCase();
        const itemId = r.items?.[0]?.itemId;
        const medItemId = r.items?.[0]?.medicineId;
        
        let item = itemMap[itemId];
        if (!item && medItemId) {
          // For patient requests, look up by medicineId
          item = itemMap[medItemId];
        }
        
        const name = item ? item.item_name.toLowerCase() : (r.items?.[0]?.itemName || '').toLowerCase();
        return (
          r.patientName.toLowerCase().includes(q) ||
          String(r.id).toLowerCase().includes(q) ||
          name.includes(q)
        );
      }
      return true;
    });
  }, [requests, search, filterLocation, filterStatus, itemMap, focusPatientId]);
  const statusOptions = ['All', 'Pending', 'Approved', 'Completed', 'Rejected', 'Cancelled'];
  const locations = allowedLocations;

  const getLocationDisplay = (loc) => {
    const map = { Casal: 'Casal', Arlegui: 'Arlegui', QuezonCity: 'Quezon City' };
    return map[loc] || loc;
  };

  return (
    <div className="space-y-2">
      {/* Focused patient banner */}
      {focusPatientId && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 text-xs">
          <span className="text-primary-700 dark:text-primary-300 font-medium">
            Showing all requests for Patient ID: <span className="font-bold">{focusPatientId}</span>
            {' '}({filtered.length} found across all locations)
          </span>
          <button
            onClick={onClearFocus}
            className="ml-3 flex-shrink-0 px-2 py-1 rounded text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* Location Tabs */}
      <div className={`flex gap-1 border-b border-neutral-200 dark:border-neutral-700 ${focusPatientId ? 'opacity-40 pointer-events-none' : ''}`}>
        {locations.map((loc) => (
          <button
            key={loc}
            onClick={() => setFilterLocation(loc)}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
              filterLocation === loc
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'
            }`}
          >
            {getLocationDisplay(loc)}
          </button>
        ))}
      </div>

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
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Item</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Qty</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Purpose</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Date</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Status</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Notes</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Approved By</th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center">
                    <svg className="mx-auto w-8 h-8 text-secondary-300 dark:text-neutral-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    <p className="text-sm text-secondary-400 dark:text-neutral-500">No requests match your filters</p>
                  </td>
                </tr>
              ) : (
                filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((req) => {
                  // Handle both staff requests (itemId) and patient requests (medicineId)
                  let item = itemMap[req.items?.[0]?.itemId];
                  if (!item && req.items?.[0]?.medicineId) {
                    item = itemMap[req.items?.[0]?.medicineId];
                  }
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
                        {req.items?.map((reqItem, idx) => {
                          let itemName = reqItem.itemName || '—';
                          // Try to look up correct item name
                          const itemData = itemMap[reqItem.itemId] || itemMap[reqItem.medicineId];
                          if (itemData) {
                            itemName = itemData.item_name;
                          }
                          return (
                            <div key={idx} className="text-xs">{itemName}</div>
                          );
                        }) || '—'}
                      </td>
                      <td className="px-3 py-1.5">
                        {req.items && req.items.length > 0 ? (
                          <div className="space-y-1">
                            {req.items.map((reqItem, idx) => (
                              <div key={idx} className="text-xs font-medium text-secondary-800 dark:text-white">
                                {reqItem.quantity || <span className="text-warning-600 dark:text-warning-400">pending</span>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400">QTY PENDING</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        {req.purpose && req.purpose.length > 30 ? (
                          <button
                            onClick={() => setSelectedPurpose(req.purpose)}
                            className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 truncate max-w-[160px] hover:underline"
                            title={req.purpose}
                          >
                            {req.purpose.substring(0, 30)}...
                          </button>
                        ) : (
                          <span className="text-xs text-secondary-600 dark:text-neutral-400">{req.purpose || '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-secondary-500 dark:text-neutral-400">
                        {formatDate(req.created_at ?? req.createdAt ?? req.requestDate)}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded ${badge}`}>{req.status}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        {req.notes && req.notes.length > 0 ? (
                          req.notes.length > 20 ? (
                            <button
                              onClick={() => setSelectedNotes(req.notes)}
                              className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline truncate max-w-[120px] text-left transition-colors"
                              title={req.notes}
                            >
                              {req.notes.substring(0, 20)}...
                            </button>
                          ) : (
                            <span className="text-xs text-secondary-600 dark:text-neutral-400">{req.notes}</span>
                          )
                        ) : (
                          <span className="text-xs text-secondary-400 dark:text-neutral-500">—</span>
                        )}
                      </td>
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
                        {req.status === 'Approved' && (() => {
                          const ageDays = getApprovalAgeDays(req.id);
                          const daysLeft = ageDays != null ? Math.max(0, APPROVAL_EXPIRY_DAYS - ageDays) : null;
                          const expiringSoon = daysLeft != null && daysLeft <= 1;
                          return (
                            <div className="inline-flex flex-col items-end gap-1">
                              {expiringSoon && (
                                <span className="text-[10px] font-medium text-error-600 dark:text-error-400">
                                  ⚠ Expires in {daysLeft < 1 ? '<1' : Math.ceil(daysLeft)} day{daysLeft >= 1 ? '' : ''}
                                </span>
                              )}
                              <div className="inline-flex items-center gap-1">
                                <button onClick={() => onDispense(req)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                  Dispense
                                </button>
                                <button onClick={() => setCancelConfirmReq(req)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-white bg-neutral-500 hover:bg-neutral-600 rounded-lg transition-colors" title="Cancel this reservation">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                        {req.status === 'Completed' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-success-700 dark:text-success-400 bg-success-100 dark:bg-success-900/30 rounded-lg">Completed</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {Math.ceil(filtered.length / itemsPerPage) > 1 && (
          <div className="mt-4 px-4 py-3 flex items-center justify-center gap-2 border-t border-neutral-200 dark:border-neutral-700">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-xs font-medium border border-neutral-300 dark:border-neutral-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: Math.ceil(filtered.length / itemsPerPage) }, (_, i) => (
              <button
                key={i + 1}
                onClick={() => setCurrentPage(i + 1)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  currentPage === i + 1
                    ? 'bg-primary-500 text-white'
                    : 'border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-700'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filtered.length / itemsPerPage), prev + 1))}
              disabled={currentPage === Math.ceil(filtered.length / itemsPerPage)}
              className="px-3 py-1.5 text-xs font-medium border border-neutral-300 dark:border-neutral-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Purpose Modal */}
      {selectedPurpose && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">Medical Condition / Purpose</h3>
              <button
                onClick={() => setSelectedPurpose(null)}
                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-neutral-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-4 mb-4 max-h-[300px] overflow-y-auto">
              <p className="text-sm text-secondary-700 dark:text-neutral-300 whitespace-pre-wrap break-words">
                {selectedPurpose}
              </p>
            </div>
            <button
              onClick={() => setSelectedPurpose(null)}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Staff Notes Modal */}
      {selectedNotes && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">Staff Notes</h3>
              <button
                onClick={() => setSelectedNotes(null)}
                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-neutral-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-4 mb-4 max-h-[300px] overflow-y-auto">
              <p className="text-sm text-secondary-700 dark:text-neutral-300 whitespace-pre-wrap break-words">
                {selectedNotes}
              </p>
            </div>
            <button
              onClick={() => setSelectedNotes(null)}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelConfirmReq && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-warning-600 dark:text-warning-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-secondary-900 dark:text-white">Cancel Reserved Stock?</h3>
            </div>
            <p className="text-sm text-secondary-600 dark:text-neutral-300 mb-2">
              This will cancel request <span className="font-medium">#{cancelConfirmReq.id}</span> for <span className="font-medium">{cancelConfirmReq.patientName}</span>.
            </p>
            <p className="text-xs text-secondary-500 dark:text-neutral-400 mb-5">
              The reserved stock will be released back to the available pool for other patients.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCancelConfirmReq(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg transition-colors"
              >
                Keep
              </button>
              <button
                onClick={() => {
                  onCancel?.(cancelConfirmReq);
                  setCancelConfirmReq(null);
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-warning-500 hover:bg-warning-600 rounded-lg transition-colors"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DispenseQueue;
