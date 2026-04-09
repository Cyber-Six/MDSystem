import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePermissions } from '../../../../../context/permissions-context';
import {
  BRANCH,
  TICKET_STATUS,
  getStatusUpdateTickets,
} from '../../../initial-record-service';
import { enrichWithInitialFlag } from '../../ticket-type-helper';
import InitialRecordDetailModal from '../../initial-record-detail-modal';

/**
 * RecordUpdateList
 *
 * Displays the record update requests submitted by patients.
 * Unlike InitialRecordList (which shows first-time submissions),
 * this component is dedicated to update requests from existing patients.
 *
 * Dropdowns:
 *  - Branch       : Manila | Quezon City | Both
 *  - Update Scope : All | Medical | Dental | Both  (client-side filter on ticket.scope)
 *  - Status       : Pending | Revision Submitted | Approved | Revision Requested | Expired | Cancelled
 *
 * 7-day expiry:
 *  Pending tickets older than 7 days are displayed with an "Expired" badge.
 *  When the "Expired" status filter is selected, only those age-expired
 *  Pending tickets are shown (backend-level expiry is handled server-side).
 */

const PAGE_SIZE = 10;
const EXPIRY_DAYS = 7;

/** Returns true when a Pending ticket has exceeded the 7-day validity window. */
const isExpiredByAge = (ticket) => {
  if (!ticket.created_at) return false;
  const ageMs = Date.now() - new Date(ticket.created_at).getTime();
  return ageMs >= EXPIRY_DAYS * 24 * 60 * 60 * 1000;
};

const STATUS_OPTIONS = [
  { value: TICKET_STATUS.PENDING,            label: 'Pending' },
  { value: TICKET_STATUS.REVISION_SUBMITTED, label: 'Revision Submitted' },
  { value: TICKET_STATUS.APPROVED,           label: 'Approved' },
  { value: TICKET_STATUS.REVISION,           label: 'Revision Requested' },
  { value: TICKET_STATUS.REJECTED,           label: 'Rejected' },
  { value: TICKET_STATUS.EXPIRED,            label: 'Expired' },
  { value: TICKET_STATUS.CANCELLED,          label: 'Cancelled' },
];

const statusBadgeClass = (status) => {
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

const statusLabel = (status) => {
  const found = STATUS_OPTIONS.find((o) => o.value === status);
  return found ? found.label : status;
};

const scopeBadgeClass = (scope) => {
  const map = {
    Medical: 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400',
    Dental:  'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
    Both:    'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
  };
  return map[scope] ?? 'bg-neutral-100 text-neutral-600';
};

const RecordUpdateList = ({
  staffRole = 'both',
  externalStatusFilter = null,
  showStatusFilter = true,
}) => {
  const { branch: permBranch, allowedBranches } = usePermissions();
  // ── Filter state ──────────────────────────────────────────────────────────
  // Default to the staff member's permission branch; fall back to Manila.
  const [branch, setBranch] = useState(() => permBranch || BRANCH.MANILA);
  const [scopeFilter, setScopeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState(TICKET_STATUS.PENDING);

  // Sync branch when permissions load
  useEffect(() => {
    if (permBranch) setBranch(permBranch);
  }, [permBranch]); // eslint-disable-line react-hooks/exhaustive-deps

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const effectiveStatusFilter = externalStatusFilter ?? statusFilter;
  const queryStatuses = useMemo(() => {
    if (effectiveStatusFilter === 'all') {
      return [
        TICKET_STATUS.PENDING,
        TICKET_STATUS.REVISION_SUBMITTED,
        TICKET_STATUS.APPROVED,
        TICKET_STATUS.REVISION,
        TICKET_STATUS.REJECTED,
        TICKET_STATUS.EXPIRED,
        TICKET_STATUS.CANCELLED,
      ];
    }

    if (effectiveStatusFilter === TICKET_STATUS.EXPIRED) {
      return [TICKET_STATUS.PENDING];
    }

    return [effectiveStatusFilter];
  }, [effectiveStatusFilter]);

  // Reset to page 1 whenever filters change
  useEffect(() => { setCurrentPage(1); }, [branch, effectiveStatusFilter, scopeFilter]);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      /**
       * "Expired" is a frontend-detected virtual status:
       * we fetch Pending tickets from the backend, then isolate those
       * that have exceeded the 7-day validity window.
       *
       * For all other statuses we query directly.
       */
      const result = await getStatusUpdateTickets(queryStatuses, branch);

      // Keep only update requests (is_initial === false); initial records are shown on the Initial Record tab.
      const updateOnly = (await enrichWithInitialFlag(result)).filter((t) => !t.is_initial);

      let processed;
      if (effectiveStatusFilter === TICKET_STATUS.EXPIRED) {
        // Show only Pending tickets that are past the validity window.
        processed = updateOnly
          .filter(isExpiredByAge)
          .map((t) => ({ ...t, _displayStatus: TICKET_STATUS.EXPIRED }));
      } else if (effectiveStatusFilter === TICKET_STATUS.PENDING) {
        // Hide age-expired tickets from the Pending view so they don't appear twice.
        processed = updateOnly.filter((t) => !isExpiredByAge(t));
      } else if (effectiveStatusFilter === 'all') {
        // In all-status view, keep non-expired Pending as Pending and render old Pending as Expired.
        processed = updateOnly.map((t) => (
          t.status === TICKET_STATUS.PENDING && isExpiredByAge(t)
            ? { ...t, _displayStatus: TICKET_STATUS.EXPIRED }
            : t
        ));
      } else {
        processed = updateOnly;
      }

      setTickets(processed);
    } catch (err) {
      setError(err.message || 'Failed to load update requests.');
    } finally {
      setLoading(false);
    }
  }, [branch, effectiveStatusFilter, queryStatuses]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // ── After approve / revision ───────────────────────────────────────────────

  const handleAction = (updatedTicket) => {
    setTickets((prev) => {
      const next = prev.filter((t) => t.id !== updatedTicket.id);
      // Clamp current page based on the post-removal visible count
      const nextVisible = scopeFilter === 'All' ? next : next.filter((t) => t.scope === scopeFilter);
      setCurrentPage((p) => Math.min(p, Math.max(1, Math.ceil(nextVisible.length / PAGE_SIZE))));
      return next;
    });
  };

  // ── Client-side scope filter ───────────────────────────────────────────────

  const visibleTickets =
    scopeFilter === 'All'
      ? tickets
      : tickets.filter((t) => t.scope === scopeFilter);

  // ── Pagination ─────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(visibleTickets.length / PAGE_SIZE));
  const pagedTickets = visibleTickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* ── Filters ── */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
        <div className="flex flex-wrap gap-2 items-center">

          {/* Branch */}
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
              <option value={BRANCH.MANILA}>Manila</option>
              {allowedBranches().includes(BRANCH.QUEZON_CITY) && (
                <option value={BRANCH.QUEZON_CITY}>Quezon City</option>
              )}
              {allowedBranches().includes(BRANCH.BOTH) && (
                <option value={BRANCH.BOTH}>Both</option>
              )}
            </select>
          </div>

          {/* Update Scope */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 shrink-0">
              Scope
            </label>
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
              className="px-3 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="All">All Scopes</option>
              <option value="Medical">Medical</option>
              <option value="Dental">Dental</option>
              <option value="Both">Both</option>
            </select>
          </div>

          {/* Status */}
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
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={fetchTickets}
            disabled={loading}
            className="ml-auto px-3 py-1 text-xs font-medium text-secondary-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* ── Error alert ── */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg">
          <svg
            className="w-4 h-4 text-error-600 dark:text-error-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-error-700 dark:text-error-400 mb-0">{error}</p>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">
            Record Update Requests&nbsp;
            <span className="text-secondary-400 dark:text-neutral-500">({visibleTickets.length})</span>
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <svg className="w-8 h-8 mx-auto text-primary-500 animate-spin mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-sm text-secondary-500 dark:text-neutral-400">Loading requests…</p>
          </div>
        ) : visibleTickets.length === 0 ? (
          <div className="p-8 text-center">
            <svg
              className="w-12 h-12 mx-auto text-secondary-300 dark:text-neutral-600 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p className="text-sm text-secondary-500 dark:text-neutral-400">No update requests found</p>
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
                      Scope
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">
                      Submitted
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">
                      Expires
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                  {pagedTickets.map((ticket) => {
                    const displayStatus = ticket._displayStatus ?? ticket.status;
                    const expiresAt = ticket.created_at
                      ? new Date(
                          new Date(ticket.created_at).getTime() +
                            EXPIRY_DAYS * 24 * 60 * 60 * 1000,
                        )
                      : null;

                    return (
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
                            : (
                              <span className="italic text-secondary-400 dark:text-neutral-500">
                                ID&nbsp;{ticket.patientId}
                              </span>
                            )}
                        </td>
                        <td className="px-4 py-3">
                          {ticket.scope && (
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${scopeBadgeClass(ticket.scope)}`}
                            >
                              {ticket.scope}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-secondary-500 dark:text-neutral-400">
                          {ticket.created_at
                            ? new Date(ticket.created_at).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-secondary-500 dark:text-neutral-400">
                          {expiresAt
                            ? expiresAt.toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${statusBadgeClass(displayStatus)}`}
                          >
                            {statusLabel(displayStatus)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTicket(ticket);
                            }}
                            className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })}
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

      {/* ── Detail modal ── */}
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

export default RecordUpdateList;
