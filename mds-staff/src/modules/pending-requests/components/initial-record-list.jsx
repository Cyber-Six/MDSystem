import RequestListPanel from './request-list-panel';
import { matchesRequestSearch, STATUS_OPTIONS } from './request-list-utils';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePermissions } from '../../../context/permissions-context';
import { useStaffNotifications } from '../../notification/notification-context';
import {
  BRANCH,
  ALL_BRANCHES,
  TICKET_STATUS,
  getStatusUpdateTickets,
} from '../initial-record-service';
import { enrichWithInitialFlag } from './ticket-type-helper';
import InitialRecordDetailModal from './initial-record-detail-modal';
import { formatBranchLabel } from '../../../utils/branch-utils';

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

const InitialRecordList = ({
  staffRole = 'both',
  externalStatusFilter = null,
  showStatusFilter = true,
  searchQuery = '',
}) => {
  const { subscribe } = useStaffNotifications();
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

  // ── Fetch ----------------------------------------------------------------

  const fetchTickets = useCallback(async (options = {}) => {
    setLoading(true);
    setError('');
    try {
      const result = await getStatusUpdateTickets(queryStatuses, branch, 0, 20, options);
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

  // Live-sync pending list when a patient submits an update ticket.
  // Initial-record tickets are filtered client-side via enrichWithInitialFlag.
  useEffect(() => {
    const unsubscribe = subscribe('updateTicket', () => {
      fetchTickets({ force: true });
    });

    return () => unsubscribe();
  }, [subscribe, fetchTickets]);

  // ── After approve / revision ─────────────────────────────────────────────

  const handleAction = (updatedTicket) => {
    setTickets((prev) => prev.filter((ticket) => ticket.id !== updatedTicket.id));
  };
  const visibleTickets = tickets.filter((ticket) => matchesRequestSearch(ticket, searchQuery));

  return (
    <>
      <RequestListPanel kind="initial" tickets={visibleTickets} loading={loading} error={error}
        searchQuery={searchQuery} resetKey={JSON.stringify([branch, effectiveStatusFilter, searchQuery])}
        onRefresh={() => fetchTickets({ force: true })} onReview={setSelectedTicket}
        filters={<>
          <label className="request-field"><span>Branch</span>
            <select aria-label="Branch" value={branch} onChange={(event) => setBranch(event.target.value)} disabled={allowedBranches().length === 1}>
              {ALL_BRANCHES.filter((value) => allowedBranches().includes(value)).map((value) => (
                <option key={value} value={value}>{formatBranchLabel(value)}</option>
              ))}
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

export default InitialRecordList;
