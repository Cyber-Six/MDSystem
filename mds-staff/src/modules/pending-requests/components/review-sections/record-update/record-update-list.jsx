import RequestListPanel from '../../request-list-panel';
import { matchesRequestSearch, STATUS_OPTIONS } from '../../request-list-utils';
import { formatBranchLabel } from '../../../../../utils/branch-utils';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePermissions } from '../../../../../context/permissions-context';
import { useStaffNotifications } from '../../../../notification/notification-context';
import {
  BRANCH,
  ALL_BRANCHES,
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

const EXPIRY_DAYS = 7;

/** Returns true when a Pending ticket has exceeded the 7-day validity window. */
const isExpiredByAge = (ticket) => {
  if (!ticket.created_at) return false;
  const ageMs = Date.now() - new Date(ticket.created_at).getTime();
  return ageMs >= EXPIRY_DAYS * 24 * 60 * 60 * 1000;
};

const RecordUpdateList = ({
  staffRole = 'both',
  externalStatusFilter = null,
  showStatusFilter = true,
  searchQuery = '',
}) => {
  const { subscribe } = useStaffNotifications();
  const { branch: permBranch, allowedBranches } = usePermissions();
  // ── Filter state ──────────────────────────────────────────────────────────
  // Default to the staff member's permission branch; fall back to Manila.
  const [branch, setBranch] = useState(() => permBranch || BRANCH.MANILA);
  const [scopeFilter, setScopeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState(TICKET_STATUS.PENDING);

  // Sync branch when permissions load
  useEffect(() => {
    if (permBranch) setBranch(permBranch);
  }, [permBranch]);

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);

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

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchTickets = useCallback(async (options = {}) => {
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
      const result = await getStatusUpdateTickets(queryStatuses, branch, 0, 20, options);

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

  // Live-sync pending list when a new patient update ticket is submitted.
  useEffect(() => {
    const unsubscribe = subscribe('updateTicket', () => {
      fetchTickets({ force: true });
    });

    return () => unsubscribe();
  }, [subscribe, fetchTickets]);

  // ── After approve / revision ───────────────────────────────────────────────

  const handleAction = (updatedTicket) => {
    setTickets((prev) => prev.filter((ticket) => ticket.id !== updatedTicket.id));
  };
  const visibleTickets = tickets.filter((ticket) =>
    (scopeFilter === 'All' || ticket.scope === scopeFilter) && matchesRequestSearch(ticket, searchQuery));

  return (
    <>
      <RequestListPanel kind="update" tickets={visibleTickets} loading={loading} error={error}
        searchQuery={searchQuery} resetKey={JSON.stringify([branch, effectiveStatusFilter, scopeFilter, searchQuery])}
        onRefresh={() => fetchTickets({ force: true })} onReview={setSelectedTicket}
        filters={<>
          <label className="request-field"><span>Branch</span>
            <select aria-label="Branch" value={branch} onChange={(event) => setBranch(event.target.value)} disabled={allowedBranches().length === 1}>
              {ALL_BRANCHES.filter((value) => allowedBranches().includes(value)).map((value) => (
                <option key={value} value={value}>{formatBranchLabel(value)}</option>
              ))}
            </select>
          </label>
          <label className="request-field"><span>Scope</span>
            <select aria-label="Scope" value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)}>
              <option value="All">All scopes</option><option value="Medical">Medical</option>
              <option value="Dental">Dental</option><option value="Both">Both</option>
            </select>
          </label>
          {showStatusFilter && <label className="request-field"><span>Status</span>
            <select aria-label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {STATUS_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>}
        </>}
      />
      {selectedTicket && <InitialRecordDetailModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)}
        onAction={(updated) => { handleAction(updated); setSelectedTicket(null); }} staffRole={staffRole} />}
    </>
  );
};

export default RecordUpdateList;
