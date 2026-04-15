import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePermissions } from '../../../context/permissions-context';
import {
  BRANCH,
  ALL_BRANCHES,
  TICKET_STATUS,
  getStatusUpdateTickets,
} from '../initial-record-service';
import { enrichWithInitialFlag } from './ticket-type-helper';
import InitialRecordDetailModal from './initial-record-detail-modal';

/**
 * InitialRecordList
 *
 * Fetches and displays all Update Tickets for the staff to manage.
 * Provides:
 *  • Branch selector   (Manila / QuezonCity / Both)
 *  • Status filter     (Pending, RevisionSubmitted, Approved, …)
 *  • Click-to-review modal (InitialRecordDetailModal)
 *
 * The component reflects the backend's UpdateTicket shape:
 *   { id, patientId, status, scope, created_at, first_name, last_name, branch }
 */

const PAGE_SIZE = 10;

const InitialRecordList = ({
  staffRole = 'both',
  externalStatusFilter = null,
  showStatusFilter = true,
}) => {
  const { branch: permBranch, allowedBranches } = usePermissions();
  const [branch, setBranch] = useState(() => permBranch || BRANCH.BOTH);
  const [statusFilter, setStatusFilter] = useState(TICKET_STATUS.PENDING);

  // Sync branch when permissions finish loading
  useEffect(() => {
    if (permBranch && permBranch !== 'Both' && branch === BRANCH.BOTH) {
      setBranch(permBranch);
    }
  }, [permBranch]); // eslint-disable-line react-hooks/exhaustive-deps
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const effectiveStatusFilter = externalStatusFilter ?? statusFilter;
  const queryStatuses = useMemo(
    () => (
      effectiveStatusFilter === 'all'
        ? [
            TICKET_STATUS.PENDING,
            TICKET_STATUS.REVISION_SUBMITTED,
            TICKET_STATUS.APPROVED,
            TICKET_STATUS.REVISION,
            TICKET_STATUS.REJECTED,
            TICKET_STATUS.EXPIRED,
            TICKET_STATUS.CANCELLED,
          ]
        : [effectiveStatusFilter]
    ),
    [effectiveStatusFilter],
  );

  // Reset to page 1 whenever filters change
  useEffect(() => { setCurrentPage(1); }, [branch, effectiveStatusFilter]);

  // ── Fetch ----------------------------------------------------------------

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getStatusUpdateTickets(queryStatuses, branch);
      const enriched = await enrichWithInitialFlag(result);
      setTickets(enriched.filter((t) => t.is_initial));
    } catch (err) {
      setError(err.message || 'Failed to load tickets.');
    } finally {
      setLoading(false);
    }
  }, [branch, queryStatuses]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // ── After approve / revision ─────────────────────────────────────────────

  const handleAction = (updatedTicket) => {
    setTickets((prev) => {
      const next = prev.filter((t) => t.id !== updatedTicket.id);
      // Clamp current page if it becomes empty after removal
      setCurrentPage((p) => Math.min(p, Math.max(1, Math.ceil(next.length / PAGE_SIZE))));
      return next;
    });
  };

  // ── Status badge helpers ─────────────────────────────────────────────────

  const statusBadge = (status) => {
    const map = {
      [TICKET_STATUS.PENDING]:            'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
      [TICKET_STATUS.REVISION_SUBMITTED]: 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400',
      [TICKET_STATUS.APPROVED]:           'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
      [TICKET_STATUS.REVISION]:           'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400',
      [TICKET_STATUS.REJECTED]:           'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400',
      [TICKET_STATUS.EXPIRED]:            'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400',
      [TICKET_STATUS.CANCELLED]:          'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400',
    };
    return map[status] ?? 'bg-neutral-100 text-neutral-600';
  };

  // ── Pagination ────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(tickets.length / PAGE_SIZE));
  const pagedTickets = tickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
        <div className="flex flex-wrap gap-2 items-center">

          {/* Branch selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 shrink-0">
              Branch
            </label>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              disabled={allowedBranches().length === 1}
              className="px-3 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {ALL_BRANCHES
                .filter((b) => allowedBranches().includes(b))
                .map((b) => (
                  <option key={b} value={b}>{b === 'QuezonCity' ? 'Quezon City' : b}</option>
                ))}
            </select>
          </div>

          {/* Status filter */}
          {showStatusFilter && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 shrink-0">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value={TICKET_STATUS.PENDING}>Pending</option>
                <option value={TICKET_STATUS.REVISION_SUBMITTED}>Revision Submitted</option>
                <option value={TICKET_STATUS.APPROVED}>Approved</option>
                <option value={TICKET_STATUS.REVISION}>Revision Requested</option>
                <option value={TICKET_STATUS.REJECTED}>Rejected</option>
                <option value={TICKET_STATUS.EXPIRED}>Expired</option>
                <option value={TICKET_STATUS.CANCELLED}>Cancelled</option>
              </select>
            </div>
          )}

          {/* Refresh button */}
          <button
            onClick={fetchTickets}
            disabled={loading}
            className="ml-auto px-3 py-1 text-xs font-medium text-secondary-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg">
          <svg className="w-4 h-4 text-error-600 dark:text-error-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-error-700 dark:text-error-400 mb-0">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">
            Initial Record Submissions&nbsp;
            <span className="text-secondary-400 dark:text-neutral-500">({tickets.length})</span>
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <svg className="w-8 h-8 mx-auto text-primary-500 animate-spin mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-sm text-secondary-500 dark:text-neutral-400">Loading submissions…</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 mx-auto text-secondary-300 dark:text-neutral-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p className="text-sm text-secondary-500 dark:text-neutral-400">No submissions found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-700/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">
                      Ticket ID
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">
                      Submitted
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                  {pagedTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50 cursor-pointer"
                    >
                      <td className="px-4 py-3 text-xs font-mono text-secondary-700 dark:text-neutral-300">
                        #{ticket.id}
                      </td>
                      <td className="px-4 py-3 text-xs text-secondary-700 dark:text-neutral-300">
                        {ticket.first_name || ticket.last_name
                          ? `${ticket.first_name ?? ''} ${ticket.last_name ?? ''}`.trim()
                          : <span className="italic text-secondary-400 dark:text-neutral-500">ID&nbsp;{ticket.patientId}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-secondary-500 dark:text-neutral-400">
                        {ticket.created_at
                          ? new Date(ticket.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${statusBadge(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedTicket(ticket); }}
                          className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-neutral-200 dark:border-neutral-700">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-md text-secondary-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous page"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-xs text-secondary-500 dark:text-neutral-400 min-w-[72px] text-center">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-md text-secondary-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next page"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail modal */}
      {selectedTicket && (
        <InitialRecordDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onAction={(updated) => {
            handleAction(updated);
            setSelectedTicket(null);
          }}
          staffRole={staffRole}
        />
      )}
    </div>
  );
};

export default InitialRecordList;
