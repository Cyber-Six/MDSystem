import React, { useId, useState } from 'react';
import {
  AlertCircle, Ban, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight,
  CircleAlert, Clock3, FilePenLine, FilePlus2, Inbox, LoaderCircle, RefreshCw,
  RotateCcw, XCircle,
} from 'lucide-react';
import PatientTypeBadge from './patient-type-badge';
import { STATUS_OPTIONS } from './request-list-utils';
import './requests.css';

const dateTimeLabel = (value) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
};

function StatusBadge({ status }) {
  const label = STATUS_OPTIONS.find((option) => option.value === status)?.label || status;
  const icons = {
    Pending: Clock3,
    RevisionSubmitted: RotateCcw,
    Approved: CheckCircle2,
    Revision: CircleAlert,
    Rejected: XCircle,
    Expired: CalendarClock,
    Cancelled: Ban,
  };
  const Icon = icons[status] || CircleAlert;
  return <span className="request-status-badge" data-status={status}>
    <Icon size={14} strokeWidth={2.2} aria-hidden="true" />{label}
  </span>;
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
      <div className="request-local-filters">
        <div className="request-filter-group">{filters}</div>
        {isCombined && <div className="request-type-legend" aria-label="Request type indicator legend">
          <span><i data-type="initial" aria-hidden="true" />Initial record</span>
          <span><i data-type="update" aria-hidden="true" />Record update</span>
        </div>}
      </div>

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
              {['Ticket ID', 'Patient', 'Submitted', 'Status'].map((label) => (
                <th key={label} scope="col" role="columnheader">{label}</th>
              ))}
            </tr></thead>
            <tbody role="rowgroup">
              {pagedTickets.map((ticket) => {
                const name = `${ticket.first_name || ''} ${ticket.last_name || ''}`.trim();
                const openReview = () => onReview(ticket);
                return <tr key={ticket.id} role="row" tabIndex={0}
                  aria-label={`Review ticket #${ticket.id}${name ? ` for ${name}` : ''}`}
                  onClick={openReview}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openReview();
                    }
                  }}
                  className={`request-clickable-row ${isCombined ? 'request-type-row' : ''}`}
                  data-request-type={ticket.requestType}>
                  <td data-label="Ticket ID" className="request-ticket-cell" role="cell">
                    <span className="request-ticket-id">#{ticket.id}</span>
                  </td>
                  <td className="request-patient-cell" role="cell">
                    <div className="request-patient">
                      <span className="request-avatar" aria-hidden="true">{[ticket.first_name, ticket.last_name].filter(Boolean).map((part) => part.trim().charAt(0)).join('').toUpperCase() || '—'}</span>
                      <div><span className="request-patient-name">{name || `Patient ID ${ticket.patientId}`}</span><PatientTypeBadge profileType={ticket.profile_type} /></div>
                    </div>
                  </td>
                  <td data-label="Submitted" role="cell" className="request-date-cell">{dateTimeLabel(ticket.created_at)}</td>
                  <td data-label="Status" role="cell"><StatusBadge status={ticket._displayStatus || ticket.status} /></td>
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
