import RequestListPanel from '../../request-list-panel';
import { matchesRequestSearch, normalizeStatuses, STATUS_OPTIONS } from '../../request-list-utils';
import { formatBranchLabel } from '../../../../../utils/branch-utils';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePermissions } from '../../../../../context/permissions-context';
import { useStaffNotifications } from '../../../../notification/notification-context';
import useRequestRefresh from '../../use-request-refresh';
import { BRANCH, ALL_BRANCHES, TICKET_STATUS, getStatusUpdateTickets } from '../../../initial-record-service';
import { enrichWithInitialFlag } from '../../ticket-type-helper';
import RecordReviewModal from '../../record-review-modal';

const EXPIRY_DAYS = 7;
const isExpiredByAge = (ticket) => ticket.created_at
  && Date.now() - new Date(ticket.created_at).getTime() >= EXPIRY_DAYS * 86400000;

const RecordUpdateList = ({ staffRole = 'both', externalStatusFilter = null, showStatusFilter = true, searchQuery = '' }) => {
  const { subscribe } = useStaffNotifications();
  const { branch: permBranch, allowedBranches } = usePermissions();
  const [branch, setBranch] = useState(() => permBranch || BRANCH.BOTH);
  const [scopeFilter, setScopeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState(TICKET_STATUS.PENDING);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const effectiveStatusFilter = externalStatusFilter ?? statusFilter;
  const selectedStatuses = useMemo(() => normalizeStatuses(effectiveStatusFilter), [effectiveStatusFilter]);
  const queryStatuses = useMemo(() => [...new Set(selectedStatuses.flatMap((status) =>
    status === TICKET_STATUS.EXPIRED ? [TICKET_STATUS.PENDING] : [status]))], [selectedStatuses]);

  useEffect(() => { if (permBranch) setBranch(permBranch); }, [permBranch]);

  const fetchTickets = useCallback(async (options = {}) => {
    if (!options.silent) setLoading(true);
    setError('');
    try {
      const result = await getStatusUpdateTickets(queryStatuses, branch, 0, 20, options);
      const updateOnly = (await enrichWithInitialFlag(result)).filter((ticket) => !ticket.is_initial);
      const processed = updateOnly.map((ticket) => isExpiredByAge(ticket)
        ? { ...ticket, _displayStatus: TICKET_STATUS.EXPIRED } : ticket)
        .filter((ticket) => selectedStatuses.includes(ticket._displayStatus || ticket.status));
      setTickets(processed);
    } catch (fetchError) {
      if (!options.retried && fetchError.message === 'Staff session changed. Reload requests.') return fetchTickets({ force: true, retried: true });
      setError(fetchError.message || 'Failed to load update requests.');
    } finally {
      setLoading(false);
    }
  }, [branch, queryStatuses, selectedStatuses]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => subscribe('updateTicket', () => fetchTickets({ force: true })), [subscribe, fetchTickets]);
  useRequestRefresh(fetchTickets);
  const handleAction = (updatedTicket) => setTickets((current) => current.filter((ticket) => ticket.id !== updatedTicket.id));
  const visibleTickets = tickets.filter((ticket) =>
    (scopeFilter === 'All' || ticket.scope === scopeFilter) && matchesRequestSearch(ticket, searchQuery));

  return <>
    <RequestListPanel kind="update" tickets={visibleTickets} loading={loading} error={error}
      searchQuery={searchQuery} resetKey={JSON.stringify([branch, effectiveStatusFilter, scopeFilter, searchQuery])}
      onRefresh={() => fetchTickets({ force: true })} onReview={setSelectedTicket}
      filters={<>
        <label className="request-field"><span>Branch</span>
          <select aria-label="Branch" value={branch} onChange={(event) => setBranch(event.target.value)} disabled={allowedBranches().length === 1}>
            {ALL_BRANCHES.filter((value) => allowedBranches().includes(value)).map((value) =>
              <option key={value} value={value}>{value === BRANCH.BOTH ? 'All branches' : formatBranchLabel(value)}</option>)}
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
    {selectedTicket && <RecordReviewModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)}
      onAction={(updated) => { handleAction(updated); setSelectedTicket(null); }} staffRole={staffRole} />}
  </>;
};

export default RecordUpdateList;
