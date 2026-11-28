import React, { useId, useState } from 'react';
import { AlertCircle, ArrowRight, ChevronLeft, ChevronRight, FilePenLine, FilePlus2, Inbox, LoaderCircle, RefreshCw } from 'lucide-react';
import PatientTypeBadge from './patient-type-badge';
import { STATUS_OPTIONS } from './request-list-utils';
import './requests.css';

const dateLabel = (value) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
};

function StatusBadge({ status }) {
  const label = STATUS_OPTIONS.find((option) => option.value === status)?.label || status;
  return <span className="request-status-badge" data-status={status}><span aria-hidden="true" />{label}</span>;
}

const PAGE_SIZE = 10;

/** Shared presentation only; each caller retains its existing data and review flow. */
export default function RequestListPanel({ kind, tickets, loading, error, filters, onRefresh, onReview, resetKey, searchQuery }) {
  const [pagination, setPagination] = useState({ key: resetKey, page: 1 });
  const headingId = useId();
  const isUpdate = kind === 'update';
  const isCombined = kind === 'all';
  const Icon = isUpdate ? FilePenLine : FilePlus2;
  const title = isCombined ? 'All patient requests' : isUpdate ? 'Record update requests' : 'Initial record submissions';
  const totalPages = Math.max(1, Math.ceil(tickets.length / PAGE_SIZE));
  if (pagination.key !== resetKey || pagination.page > totalPages) {
    setPagination({ key: resetKey, page: pagination.key !== resetKey ? 1 : totalPages });
  }
  const page = Math.min(pagination.key === resetKey ? pagination.page : 1, totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const pagedTickets = tickets.slice(start, start + PAGE_SIZE);

  return (
    <section className="request-panel" aria-labelledby={headingId}>
      <div className="request-panel-heading">
        <span className="request-section-icon" data-kind={kind}><Icon size={20} aria-hidden="true" /></span>
        <div className="request-panel-title">
          <div className="request-title-line">
            <h2 id={headingId}>{title}</h2>
            {!loading && !error && <span className="request-count">{tickets.length} loaded</span>}
          </div>
          <p>{isUpdate ? 'Changes to existing medical and dental records.' : isCombined ? 'Initial submissions and updates in one queue.' : 'First-time patient record submissions.'}</p>
        </div>
        <button type="button" className="request-refresh" onClick={onRefresh} disabled={loading}
          aria-label={`Refresh ${title.toLowerCase()}`}>
          <RefreshCw size={16} className={loading ? 'request-spinning' : ''} aria-hidden="true" />
          <span>{loading ? 'Refreshing' : 'Refresh'}</span>
        </button>
      </div>
      <div className="request-local-filters">{filters}</div>

      {error ? (
        <div className="request-feedback request-error" role="alert">
          <AlertCircle size={28} aria-hidden="true" />
          <h3>Unable to load requests</h3><p>{error}</p>
          <button type="button" className="request-refresh" onClick={onRefresh} disabled={loading}>Try again</button>
        </div>
      ) : loading ? (
        <div className="request-feedback" role="status">
          <LoaderCircle size={28} className="request-spinning" aria-hidden="true" />
          <p>{isUpdate ? 'Loading requests…' : 'Loading submissions…'}</p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="request-feedback" role="status">
          <span className="request-empty-icon"><Inbox size={28} aria-hidden="true" /></span>
          <h3>{searchQuery.trim() ? 'No matching requests' : isUpdate ? 'No update requests found' : 'No submissions found'}</h3>
          <p>{searchQuery.trim() ? 'Try another patient name or ticket ID.' : 'Try a different filter or refresh to check for new submissions.'}</p>
        </div>
      ) : (
        <>
          <table className="request-table" role="table" aria-labelledby={headingId}>
            <thead role="rowgroup"><tr role="row">
              {['Patient', 'Ticket ID', ...(isCombined ? ['Request type'] : []), ...(isUpdate || isCombined ? ['Scope'] : []), 'Submitted', ...(isUpdate || isCombined ? ['Expires'] : []), 'Status', 'Action'].map((label) => (
                <th key={label} scope="col" role="columnheader" className={label === 'Action' ? 'request-action-heading' : ''}>{label}</th>
              ))}
            </tr></thead>
            <tbody role="rowgroup">
              {pagedTickets.map((ticket) => {
                const name = `${ticket.first_name || ''} ${ticket.last_name || ''}`.trim();
                const expiresAt = ticket.created_at ? new Date(new Date(ticket.created_at).getTime() + 7 * 86400000) : null;
                return <tr key={ticket.id} role="row">
                  <td className="request-patient-cell" role="cell">
                    <div className="request-patient">
                      <span className="request-avatar" aria-hidden="true">{[ticket.first_name, ticket.last_name].filter(Boolean).map((part) => part.trim().charAt(0)).join('').toUpperCase() || '—'}</span>
                      <div><span className="request-patient-name">{name || `Patient ID ${ticket.patientId}`}</span><PatientTypeBadge profileType={ticket.profile_type} /></div>
                    </div>
                  </td>
                  <td data-label="Ticket ID" role="cell"><span className="request-ticket-id">#{ticket.id}</span></td>
                  {isCombined && <td data-label="Request type" role="cell"><span className="request-scope">{ticket.requestType === 'initial' ? 'Initial record' : 'Record update'}</span></td>}
                  {(isUpdate || isCombined) && <td data-label="Scope" role="cell"><span className="request-scope" data-scope={ticket.scope}>{ticket.scope || '—'}</span></td>}
                  <td data-label="Submitted" role="cell">{dateLabel(ticket.created_at)}</td>
                  {(isUpdate || isCombined) && <td data-label="Expires" role="cell">{ticket.requestType === 'initial' ? '—' : dateLabel(expiresAt)}</td>}
                  <td data-label="Status" role="cell"><StatusBadge status={ticket._displayStatus || ticket.status} /></td>
                  <td className="request-action-cell" role="cell">
                    <button type="button" className="request-review" onClick={() => onReview(ticket)}
                      aria-label={`Review ticket #${ticket.id}${name ? ` for ${name}` : ''}`}>
                      Review<ArrowRight size={15} aria-hidden="true" />
                    </button>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
          <footer className="request-list-footer">
            <p role="status">Showing {start + 1}–{Math.min(start + PAGE_SIZE, tickets.length)} of {tickets.length} loaded {tickets.length === 1 ? 'request' : 'requests'}</p>
            {totalPages > 1 && <nav className="request-pagination" aria-label={`${title} pages`}>
              <button type="button" onClick={() => setPagination({ key: resetKey, page: page - 1 })} disabled={page === 1} aria-label="Previous page"><ChevronLeft size={17} aria-hidden="true" /></button>
              <span>Page {page} of {totalPages}</span>
              <button type="button" onClick={() => setPagination({ key: resetKey, page: page + 1 })} disabled={page === totalPages} aria-label="Next page"><ChevronRight size={17} aria-hidden="true" /></button>
            </nav>}
          </footer>
        </>
      )}
    </section>
  );
}
