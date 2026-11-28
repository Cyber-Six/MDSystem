import React, { useState } from 'react';
import { ClipboardList, FilePlus2, Files, FilePenLine, Search, X } from 'lucide-react';
import InitialRecordList from '../modules/pending-requests/components/initial-record-list';
import RecordUpdateList from '../modules/pending-requests/components/review-sections/record-update/record-update-list';
import CombinedRequestList from '../modules/pending-requests/components/combined-request-list';
import { STATUS_OPTIONS } from '../modules/pending-requests/components/request-list-utils';

const REQUEST_TYPES = [
  { value: 'all', label: 'All requests', icon: Files },
  { value: 'Initial Record', label: 'Initial records', icon: FilePlus2 },
  { value: 'Record Update', label: 'Record updates', icon: FilePenLine },
];

const PendingRequests = () => {
  const [filterType, setFilterType] = useState('Initial Record');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const listProps = { externalStatusFilter: filterStatus, showStatusFilter: false, searchQuery };

  return (
    <div className="request-workspace">
      <header className="request-page-heading">
        <span className="request-page-icon"><ClipboardList size={24} aria-hidden="true" /></span>
        <div>
          <p className="request-eyebrow">Patient records</p>
          <h1>Pending requests</h1>
          <p className="request-description">Review initial submissions and patient record updates.</p>
        </div>
      </header>
      <div className="request-toolbar">
        <div className="request-type-switch" role="group" aria-label="Request type">
          {REQUEST_TYPES.map(({ value, label, icon }) => {
            const Icon = icon;
            return (
              <button key={value} type="button" aria-pressed={filterType === value} onClick={() => setFilterType(value)}>
                <Icon size={17} aria-hidden="true" />{label}
              </button>
            );
          })}
        </div>
        <div className="request-global-filters">
          <label className="request-field request-search-field">
            <span>Search loaded requests</span>
            <span className="request-search-input">
              <Search size={18} aria-hidden="true" />
              <input type="search" aria-label="Search loaded requests" placeholder="Name, email, or identifier" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
            </span>
          </label>
          <label className="request-field request-status-field">
            <span>Status</span>
            <select aria-label="Status" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {(searchQuery || filterStatus !== 'all') && (
            <button type="button" className="request-reset" onClick={() => { setSearchQuery(''); setFilterStatus('all'); }}>
              <X size={16} aria-hidden="true" />Clear filters
            </button>
          )}
        </div>
      </div>
      {filterType === 'all' && <CombinedRequestList statusFilter={filterStatus} searchQuery={searchQuery} />}
      {filterType === 'Initial Record' && <InitialRecordList {...listProps} />}
      {filterType === 'Record Update' && <RecordUpdateList {...listProps} />}
    </div>
  );
};

export default PendingRequests;
