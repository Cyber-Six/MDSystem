import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePermissions } from '../../../context/permissions-context';
import { useStaffNotifications } from '../../notification/notification-context';
import { ALL_BRANCHES, BRANCH, TICKET_STATUS, getStatusUpdateTickets } from '../initial-record-service';
import { enrichWithInitialFlag } from './ticket-type-helper';
import RecordReviewModal from './record-review-modal';
import RequestListPanel from './request-list-panel';
import { matchesRequestSearch, normalizeStatuses, STATUS_OPTIONS } from './request-list-utils';
import { formatBranchLabel } from '../../../utils/branch-utils';

const EXPIRY_DAYS = 7;
const isAgeExpired = (ticket) => ticket.created_at
  && Date.now() - new Date(ticket.created_at).getTime() >= EXPIRY_DAYS * 86400000;

export default function CombinedRequestList({ statusFilter, searchQuery }) {
  const { subscribe } = useStaffNotifications();
  const { branch: permittedBranch, allowedBranches } = usePermissions();
  const [branch, setBranch] = useState(() => permittedBranch || BRANCH.BOTH);
  const [scope, setScope] = useState('All');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const selectedStatuses = useMemo(() => normalizeStatuses(statusFilter), [statusFilter]);
  const statuses = useMemo(() => [...new Set(selectedStatuses.flatMap((status) =>
    status === TICKET_STATUS.EXPIRED ? [TICKET_STATUS.PENDING] : [status]))], [selectedStatuses]);

  useEffect(() => { if (permittedBranch) setBranch(permittedBranch); }, [permittedBranch]);

  const refresh = useCallback(async (options = {}) => {
    setLoading(true);
    setError('');
    try {
      const result = await getStatusUpdateTickets(statuses, branch, 0, 20, options);
      const enriched = await enrichWithInitialFlag(result);
      const combined = enriched.flatMap((ticket) => {
        const isInitial = Boolean(ticket.is_initial);
        const expired = !isInitial && isAgeExpired(ticket);
        const displayStatus = expired ? TICKET_STATUS.EXPIRED : ticket.status;
        if (expired && !selectedStatuses.includes(TICKET_STATUS.EXPIRED) && selectedStatuses.includes(TICKET_STATUS.PENDING)) return [];
        if (!selectedStatuses.includes(displayStatus)) return [];
        return [{ ...ticket, requestType: isInitial ? 'initial' : 'update', _displayStatus: displayStatus }];
      });
      setTickets(combined);
    } catch (fetchError) {
      setError(fetchError.message || 'Failed to load requests.');
    } finally {
      setLoading(false);
    }
  }, [branch, selectedStatuses, statuses]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => subscribe('updateTicket', () => refresh({ force: true })), [subscribe, refresh]);

  const visibleTickets = tickets.filter((ticket) =>
    (scope === 'All' || ticket.scope === scope) && matchesRequestSearch(ticket, searchQuery));

  return <>
    <RequestListPanel kind="all" tickets={visibleTickets} loading={loading} error={error}
      searchQuery={searchQuery} resetKey={JSON.stringify([branch, scope, statusFilter, searchQuery])}
      onRefresh={() => refresh({ force: true })} onReview={setSelectedTicket}
      filters={<>
        <label className="request-field"><span>Branch</span>
          <select aria-label="Branch" value={branch} disabled={allowedBranches().length === 1}
            onChange={(event) => setBranch(event.target.value)}>
            {ALL_BRANCHES.filter((value) => allowedBranches().includes(value)).map((value) =>
              <option key={value} value={value}>{value === BRANCH.BOTH ? 'All branches' : formatBranchLabel(value)}</option>)}
          </select>
        </label>
        <label className="request-field"><span>Scope</span>
          <select aria-label="Scope" value={scope} onChange={(event) => setScope(event.target.value)}>
            <option value="All">All scopes</option><option value="Medical">Medical</option>
            <option value="Dental">Dental</option><option value="Both">Both</option>
          </select>
        </label>
      </>}
    />
    {selectedTicket && <RecordReviewModal key={`${selectedTicket.requestType}:${selectedTicket.id}`}
      ticket={{ ...selectedTicket, is_initial: selectedTicket.requestType === 'initial' }}
      onClose={() => setSelectedTicket(null)}
      onAction={() => { setTickets((current) => current.filter((ticket) => ticket.id !== selectedTicket.id)); setSelectedTicket(null); }} />}
  </>;
}
