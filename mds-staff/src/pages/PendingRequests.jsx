import React, { useState } from 'react';
import InitialRecordList from '../modules/pending-requests/components/initial-record-list';
import RecordUpdateList from '../modules/pending-requests/components/review-sections/record-update/record-update-list';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'RevisionSubmitted', label: 'Request Submitted' },
  { value: 'Revision', label: 'Revision Requested' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Expired', label: 'Expired' },
  { value: 'Cancelled', label: 'Cancelled' },
];

/**
 * Pending Requests Page
 * Staff can view and manage pending requests with filters
 */
const PendingRequests = () => {
  const [filterType, setFilterType] = useState('Initial Record');
  const [filterStatus, setFilterStatus] = useState('all');

  return (
    <div className="space-y-2">
      {/* Filters */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-2.5">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="all">All Types</option>
              <option value="Initial Record">Initial Record</option>
              <option value="Record Update">Record Update</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Initial Record Submissions — powered by the real backend */}
      {filterType === 'Initial Record' && (
        <InitialRecordList
          externalStatusFilter={filterStatus}
          showStatusFilter={false}
        />
      )}

      {/* Record Update Requests — powered by the real backend */}
      {filterType === 'Record Update' && (
        <RecordUpdateList
          externalStatusFilter={filterStatus}
          showStatusFilter={false}
        />
      )}

      {/* All Types: render both backend-backed patient-record request lists */}
      {filterType === 'all' && (
        <>
          <InitialRecordList
            externalStatusFilter={filterStatus}
            showStatusFilter={false}
          />
          <RecordUpdateList
            externalStatusFilter={filterStatus}
            showStatusFilter={false}
          />
        </>
      )}
    </div>
  );
};

export default PendingRequests;
