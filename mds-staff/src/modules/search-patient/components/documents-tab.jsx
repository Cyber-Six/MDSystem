import React, { useState, useEffect, useCallback } from 'react';
import PatientSectionCard from './section-card';
import { getRequiredDocuments, requestDocument, approveDocument, rejectDocument, archiveDocument, viewDocumentFile } from '../../../services/document-service';

const STATUS_STYLES = {
  Recorded:  'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
  Pending:   'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
  Requested: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
  Rejected:  'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400',
  Archived:  'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400',
  Missing:   'bg-neutral-50 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500',
};

const STATUS_DOT = {
  Recorded:  'bg-success-500',
  Pending:   'bg-warning-500',
  Requested: 'bg-primary-500',
  Rejected:  'bg-error-500',
  Archived:  'bg-neutral-400',
  Missing:   'bg-neutral-300 dark:bg-neutral-600',
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.Missing;
  const dot = STATUS_DOT[status] || STATUS_DOT.Missing;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium leading-none ${style}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      {status}
    </span>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: '2-digit',
  });
}

export default function PatientDocumentsTab({ patient }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requesting, setRequesting] = useState(null);
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [filter, setFilter] = useState('Missing');
  const [notes, setNotes] = useState({});

  const patientId = patient?.id;

  const loadDocuments = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const docs = await getRequiredDocuments(patientId);
      setDocuments(docs);
    } catch (err) {
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleRequest = async (documentId) => {
    setRequesting(documentId);
    setError('');
    try {
      const noteText = notes[documentId] || null;
      await requestDocument(documentId, patientId, noteText);
      setNotes(prev => ({ ...prev, [documentId]: '' }));
      await loadDocuments();
    } catch (err) {
      setError(err.message || 'Failed to request document');
    } finally {
      setRequesting(null);
    }
  };

  const handleApprove = async (documentId) => {
    setApproving(documentId);
    setError('');
    try {
      const noteText = notes[documentId] || null;
      await approveDocument(documentId, patientId, noteText);
      setNotes(prev => ({ ...prev, [documentId]: '' }));
      await loadDocuments();
    } catch (err) {
      setError(err.message || 'Failed to approve document');
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (documentId) => {
    if (!confirm('Are you sure you want to reject this document?')) {
      return;
    }
    setRejecting(documentId);
    setError('');
    try {
      const noteText = notes[documentId] || null;
      await rejectDocument(documentId, patientId, noteText);
      setNotes(prev => ({ ...prev, [documentId]: '' }));
      await loadDocuments();
    } catch (err) {
      setError(err.message || 'Failed to reject document');
    } finally {
      setRejecting(null);
    }
  };

  const handleArchive = async (documentId) => {
    if (!confirm('Archive this document? You can request a new one after archiving.')) {
      return;
    }
    setArchiving(documentId);
    setError('');
    try {
      const noteText = notes[documentId] || null;
      await archiveDocument(documentId, patientId, noteText);
      setNotes(prev => ({ ...prev, [documentId]: '' }));
      await loadDocuments();
    } catch (err) {
      setError(err.message || 'Failed to archive document');
    } finally {
      setArchiving(null);
    }
  };

  const handleViewFile = async (fileId) => {
    setViewing(fileId);
    try {
      const blob = await viewDocumentFile(fileId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      setError('Failed to open file');
    } finally {
      setViewing(null);
    }
  };

  const getDocStatus = (doc) => {
    // RULE: submission is the CURRENT active submission
    // Archived and Rejected items go into their respective arrays for history
    if (!doc.submission) return 'Missing';
    
    // SafeGuard: If somehow archived or rejected in submission (old data), treat as missing
    // New behavior: active submission should only be Requested, Pending, or Recorded
    if (doc.submission.status === 'Archived') return 'Missing';
    
    // Return the ONLY active state this document is in
    return doc.submission.status;
  };

  // For Archived/Rejected filters, show documents that have those submissions in history
  const getFilteredDocs = () => {
    if (filter === 'Archived') {
      // Show documents with archived submissions (historical approved versions)
      return documents.filter(d => 
        d.archivedSubmissions && d.archivedSubmissions.length > 0
      );
    }
    
    if (filter === 'Rejected') {
      // Show documents with rejected submissions (audit trail)
      // OR documents with current Rejected status
      return documents.filter(d => 
        d.submission?.status === 'Rejected' ||
        (d.rejectedSubmissions && d.rejectedSubmissions.length > 0)
      );
    }
    
    if (filter === 'Missing') {
      // Missing = no active submission OR current submission is Rejected
      // After rejection, document type becomes requestable again
      return documents.filter(d => 
        !d.submission || d.submission.status === 'Rejected'
      );
    }
    
    // For other filters, use the status (which ensures exclusive state membership)
    // Each document exists in ONLY ONE active state
    return documents.filter(d => getDocStatus(d) === filter);
  };

  // Deduplication: Ensure only ONE active submission per document type
  // This prevents duplicate requests from showing
  const statuses = ['Missing', 'Requested', 'Pending', 'Recorded', 'Rejected', 'Archived'];
  const filtered = getFilteredDocs();

  const submittedDocs = documents.filter(d => d.submission?.status === 'Recorded');
  const pendingDocs = documents.filter(d => d.submission?.status === 'Pending');
  // For rejected count, include both current rejected and historical rejected
  const rejectedDocs = documents.filter(d => 
    d.submission?.status === 'Rejected' ||
    (d.rejectedSubmissions && d.rejectedSubmissions.length > 0)
  );
  const requestedDocs = documents.filter(d => d.submission?.status === 'Requested');
  // Missing = no active submission (or current is Rejected - needs re-request)
  const missingDocs = documents.filter(d => 
    !d.submission || d.submission.status === 'Rejected'
  );

  if (!patientId) {
    return (
      <PatientSectionCard title="Required Documents">
        <div className="py-8 text-center">
          <p className="text-sm text-secondary-500 dark:text-neutral-400">No patient selected</p>
        </div>
      </PatientSectionCard>
    );
  }

  return (
    <PatientSectionCard
      title="Required Documents"
      right={
        <div className="flex items-center gap-2">
          <button
            onClick={loadDocuments}
            disabled={loading}
            className="p-1.5 text-secondary-400 dark:text-neutral-500 hover:text-secondary-600 dark:hover:text-neutral-300 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      }
    >
      {/* Summary Stats */}
      <div className="flex gap-4 mb-4 pb-3 border-b border-neutral-100 dark:border-neutral-700/60">
        <div className="text-center">
          <p className="text-lg font-bold text-success-600 dark:text-success-400">{submittedDocs.length}</p>
          <p className="text-[10px] text-secondary-400 dark:text-neutral-500 uppercase">Approved</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-warning-600 dark:text-warning-400">{pendingDocs.length}</p>
          <p className="text-[10px] text-secondary-400 dark:text-neutral-500 uppercase">Pending</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-error-600 dark:text-error-400">{rejectedDocs.length}</p>
          <p className="text-[10px] text-secondary-400 dark:text-neutral-500 uppercase">Rejected</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-primary-600 dark:text-primary-400">{requestedDocs.length}</p>
          <p className="text-[10px] text-secondary-400 dark:text-neutral-500 uppercase">Requested</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-neutral-400 dark:text-neutral-500">{missingDocs.length}</p>
          <p className="text-[10px] text-secondary-400 dark:text-neutral-500 uppercase">Missing</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 mb-3 overflow-x-auto">
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              filter === s
                ? 'bg-primary-500 dark:bg-primary-600 text-white'
                : 'text-secondary-400 dark:text-neutral-500 hover:text-secondary-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700/50'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-2 mb-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded text-xs text-error-700 dark:text-error-400">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-neutral-100 dark:bg-neutral-700 rounded animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && documents.length === 0 && !error && (
        <div className="py-8 text-center">
          <svg className="w-10 h-10 mx-auto text-secondary-300 dark:text-neutral-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm text-secondary-500 dark:text-neutral-400">No document types configured</p>
        </div>
      )}

      {/* Documents List */}
      {!loading && filtered.length > 0 && (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-700/60 -mx-3 -mb-3">
          {filter === 'Archived' ? (
            // Special rendering for Archived filter - show each submission as separate item
            documents
              .filter(doc => doc.archivedSubmissions && doc.archivedSubmissions.length > 0)
              .flatMap((doc) => {
                // IMPORTANT: Only show archivedSubmissions (never show current submission)
                // Current submission should NEVER have status='Archived'
                return doc.archivedSubmissions.map((archived, idx) => (
                  <div key={`${doc.id}-archived-${archived.id}`} className="px-3 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-700/30 transition-colors">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-secondary-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-secondary-800 dark:text-white truncate">
                            {doc.label} <span className="text-neutral-500 dark:text-neutral-400">({idx + 1})</span>
                          </p>
                        </div>
                      </div>
                      <StatusBadge status="Archived" />
                    </div>

                    {/* Submission Info */}
                    <div className="mt-2 ml-10 text-xs text-secondary-500 dark:text-neutral-400 space-y-1">
                      <div className="inline-block px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded text-[10px] font-medium mb-2">
                        📦 Archived {formatDate(archived.archivedAt)}
                      </div>
                      {archived.submittedAt && (
                        <div>Submitted: {formatDate(archived.submittedAt)}</div>
                      )}
                      {archived.notes && (
                        <div className="p-2 rounded border bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700">
                          <span className="font-medium text-neutral-600 dark:text-neutral-400">Note:</span>
                          <p className="mt-0.5 text-neutral-700 dark:text-neutral-300">{archived.notes}</p>
                        </div>
                      )}
                      {archived.file && (
                        <button
                          onClick={() => handleViewFile(archived.file)}
                          disabled={viewing === archived.file}
                          className="mt-2 px-2.5 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          {viewing === archived.file ? (
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                          View File
                        </button>
                      )}
                    </div>
                  </div>
                ));
              })
          ) : filter === 'Rejected' ? (
            // Special rendering for Rejected filter - show rejection history
            documents
              .filter(doc => 
                doc.submission?.status === 'Rejected' ||
                (doc.rejectedSubmissions && doc.rejectedSubmissions.length > 0)
              )
              .flatMap((doc) => {
                // Collect all rejected submissions (current + historical)
                const allRejected = [];
                if (doc.submission?.status === 'Rejected') {
                  allRejected.push({
                    ...doc.submission,
                    isCurrent: true,
                  });
                }
                if (doc.rejectedSubmissions) {
                  allRejected.push(...doc.rejectedSubmissions.map(r => ({ ...r, isCurrent: false })));
                }
                
                return allRejected.map((rejected, idx) => (
                  <div key={`${doc.id}-rejected-${rejected.id}`} className="px-3 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-700/30 transition-colors">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded bg-error-100 dark:bg-error-900/20 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-error-500 dark:text-error-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-secondary-800 dark:text-white truncate">
                            {doc.label}
                            {rejected.isCurrent && (
                              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400 rounded">
                                Current
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status="Rejected" />
                    </div>

                    {/* Rejection Info */}
                    <div className="mt-2 ml-10 text-xs text-secondary-500 dark:text-neutral-400 space-y-1">
                      <div className="inline-block px-2 py-0.5 bg-error-100 dark:bg-error-900/20 text-error-600 dark:text-error-400 rounded text-[10px] font-medium mb-2">
                        ✗ Rejected {formatDate(rejected.rejectedAt || rejected.submittedAt)}
                      </div>
                      {rejected.submittedAt && (
                        <div>Submitted: {formatDate(rejected.submittedAt)}</div>
                      )}
                      {rejected.notes && (
                        <div className="p-2 rounded border bg-error-50 dark:bg-error-900/10 border-error-200 dark:border-error-800">
                          <span className="font-medium text-error-600 dark:text-error-400">Rejection Reason:</span>
                          <p className="mt-0.5 text-error-700 dark:text-error-300">{rejected.notes}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        {rejected.file && (
                          <button
                            onClick={() => handleViewFile(rejected.file)}
                            disabled={viewing === rejected.file}
                            className="px-2.5 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            {viewing === rejected.file ? (
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                              </svg>
                            ) : (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                            View File
                          </button>
                        )}
                        {rejected.isCurrent && (
                          <button
                            onClick={() => handleRequest(doc.id)}
                            disabled={requesting === doc.id}
                            className="px-2.5 py-1 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            {requesting === doc.id ? (
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                              </svg>
                            ) : (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            )}
                            Request New
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ));
              })
          ) : (
            // Default rendering for other filters
            filtered.map((doc) => {
            const status = getDocStatus(doc);
            const isRequesting = requesting === doc.id;
            const isApproving = approving === doc.id;
            const isRejecting = rejecting === doc.id;
            const isArchiving = archiving === doc.id;
            const isViewing = viewing === doc.submission?.file;

            return (
              <div key={doc.id} className="px-3 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-700/30 transition-colors">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-secondary-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-secondary-800 dark:text-white truncate">
                        {doc.label}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={status} />
                </div>

                {/* Current Submission Info */}
                {doc.submission && filter !== 'Archived' && (
                  <div className="mt-2 ml-10 text-xs text-secondary-500 dark:text-neutral-400 space-y-1">
                    {/* Show archived badge if this submission is archived */}
                    {doc.submission.status === 'Archived' && (
                      <div className="inline-block px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded text-[10px] font-medium mb-2">
                        📦 Archived version
                      </div>
                    )}
                    {doc.submission.submittedAt && (
                      <div>Submitted: {formatDate(doc.submission.submittedAt)}</div>
                    )}
                    {doc.submission.notes && (
                      <div className={`p-2 rounded border ${
                        status === 'Requested' ? 'bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800' :
                        status === 'Recorded' ? 'bg-success-50 dark:bg-success-900/10 border-success-200 dark:border-success-800' :
                        status === 'Rejected' ? 'bg-error-50 dark:bg-error-900/10 border-error-200 dark:border-error-800' :
                        'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                      }`}>
                        <span className={`font-medium ${
                          status === 'Requested' ? 'text-primary-600 dark:text-primary-400' :
                          status === 'Recorded' ? 'text-success-600 dark:text-success-400' :
                          status === 'Rejected' ? 'text-error-600 dark:text-error-400' :
                          'text-secondary-600 dark:text-neutral-400'
                        }`}>Note:</span>
                        <p className="mt-0.5 text-secondary-700 dark:text-neutral-300">{doc.submission.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Archived Submissions List (show in Archived filter) */}
                {filter === 'Archived' && doc.archivedSubmissions && doc.archivedSubmissions.length > 0 && (
                  <div className="mt-2 ml-10 space-y-2">
                    {doc.archivedSubmissions.map((archived, idx) => (
                      <div key={archived.id} className="p-2 bg-neutral-50 dark:bg-neutral-800 rounded border border-neutral-200 dark:border-neutral-700">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                            📦 Version {doc.archivedSubmissions.length - idx}
                          </span>
                          <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                            Archived {formatDate(archived.archivedAt)}
                          </span>
                        </div>
                        {archived.submittedAt && (
                          <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                            Submitted: {formatDate(archived.submittedAt)}
                          </div>
                        )}
                        {archived.notes && (
                          <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                            {archived.notes}
                          </div>
                        )}
                        {archived.file && (
                          <button
                            onClick={() => handleViewFile(archived.file)}
                            disabled={isViewing}
                            className="mt-1 px-2 py-0.5 text-[10px] font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded transition-colors disabled:opacity-50"
                          >
                            View File
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions Row - Hide when viewing Archived or Rejected filter */}
                {filter !== 'Archived' && filter !== 'Rejected' && (
                  <div className="mt-2 ml-10 space-y-2">
                    {/* Missing or Rejected (in Missing filter): Show notes input and Request button */}
                    {(status === 'Missing' || (filter === 'Missing' && doc.submission?.status === 'Rejected')) && (
                    <div className="space-y-2">
                      {/* Show rejection info if this is a rejected document being re-requested */}
                      {doc.submission?.status === 'Rejected' && (
                        <div className="p-2 bg-error-50 dark:bg-error-900/10 border border-error-200 dark:border-error-800 rounded text-xs">
                          <p className="font-medium text-error-600 dark:text-error-400">⚠ Previously Rejected</p>
                          {doc.submission.notes && (
                            <p className="text-error-500 dark:text-error-300 mt-1">Reason: {doc.submission.notes}</p>
                          )}
                        </div>
                      )}
                      <input
                        type="text"
                        value={notes[doc.id] || ''}
                        onChange={(e) => setNotes(prev => ({ ...prev, [doc.id]: e.target.value }))}
                        placeholder="Add a note explaining why this document is needed (optional)..."
                        className="w-full px-2 py-1.5 text-xs border border-neutral-200 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                      <button
                        onClick={() => handleRequest(doc.id)}
                        disabled={isRequesting}
                        className="px-2.5 py-1 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        {isRequesting ? (
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        )}
                        {doc.submission?.status === 'Rejected' ? 'Request New Version' : 'Request'}
                      </button>
                    </div>
                  )}

                  {/* Requested: Show waiting message */}
                  {status === 'Requested' && (
                    <span className="text-xs text-primary-600 dark:text-primary-400 italic">
                      Waiting for patient to upload...
                    </span>
                  )}

                  {/* Pending: Show View File + notes + Approve/Reject buttons */}
                  {status === 'Pending' && (
                    <div className="space-y-2">
                      {/* View File Button */}
                      {doc.submission?.file && (
                        <button
                          onClick={() => handleViewFile(doc.submission.file)}
                          disabled={isViewing}
                          className="px-2.5 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          {isViewing ? (
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                          View File
                        </button>
                      )}

                      {/* Notes input */}
                      <input
                        type="text"
                        value={notes[doc.id] || ''}
                        onChange={(e) => setNotes(prev => ({ ...prev, [doc.id]: e.target.value }))}
                        placeholder="Add review notes (optional)..."
                        className="w-full px-2 py-1.5 text-xs border border-neutral-200 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        {/* Approve Button */}
                        <button
                          onClick={() => handleApprove(doc.id)}
                          disabled={isApproving || isRejecting}
                          className="px-2.5 py-1 text-xs font-medium text-white bg-success-500 hover:bg-success-600 rounded transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          {isApproving ? (
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          Approve
                        </button>

                        {/* Reject Button */}
                        <button
                          onClick={() => handleReject(doc.id)}
                          disabled={isApproving || isRejecting}
                          className="px-2.5 py-1 text-xs font-medium text-white bg-error-500 hover:bg-error-600 rounded transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          {isRejecting ? (
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Recorded: Show View File + Archive button */}
                  {status === 'Recorded' && doc.submission?.file && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewFile(doc.submission.file)}
                          disabled={isViewing}
                          className="px-2.5 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          {isViewing ? (
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                          View File
                        </button>
                      </div>

                      {/* Archive section */}
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={notes[doc.id] || ''}
                          onChange={(e) => setNotes(prev => ({ ...prev, [doc.id]: e.target.value }))}
                          placeholder="Add reason for archiving (optional)..."
                          className="w-full px-2 py-1.5 text-xs border border-neutral-200 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                        />
                        <button
                          onClick={() => handleArchive(doc.id)}
                          disabled={isArchiving}
                          className="px-2.5 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          {isArchiving ? (
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                          )}
                          Archive
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Rejected: Show View File + Request New Version */}
                  {status === 'Rejected' && (
                    <div className="space-y-2">
                      {/* View File Button */}
                      {doc.submission?.file && (
                        <button
                          onClick={() => handleViewFile(doc.submission.file)}
                          disabled={isViewing}
                          className="px-2.5 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          {isViewing ? (
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                          View Rejected File
                        </button>
                      )}

                      {/* Request New Version */}
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={notes[doc.id] || ''}
                          onChange={(e) => setNotes(prev => ({ ...prev, [doc.id]: e.target.value }))}
                          placeholder="Add a note for the new request (optional)..."
                          className="w-full px-2 py-1.5 text-xs border border-neutral-200 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                        <button
                          onClick={() => handleRequest(doc.id)}
                          disabled={isRequesting}
                          className="px-2.5 py-1 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          {isRequesting ? (
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          )}
                          Request New Version
                        </button>
                      </div>

                      {/* Show rejection history */}
                      {doc.rejectedSubmissions && doc.rejectedSubmissions.length > 0 && (
                        <div className="mt-2 p-2 bg-error-50 dark:bg-error-900/10 border border-error-200 dark:border-error-800 rounded">
                          <p className="text-[10px] font-medium text-error-700 dark:text-error-400 mb-1">
                            📋 Previous Rejections ({doc.rejectedSubmissions.length})
                          </p>
                          {doc.rejectedSubmissions.slice(0, 3).map((rejected, idx) => (
                            <div key={rejected.id} className="text-[10px] text-error-600 dark:text-error-300 mt-1">
                              <span className="font-medium">#{doc.rejectedSubmissions.length - idx}:</span>{' '}
                              {rejected.notes || 'No reason provided'}{' '}
                              <span className="text-error-400">({formatDate(rejected.rejectedAt || rejected.submittedAt)})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                )}
              </div>
            );
          })
          )}
        </div>
      )}

      {/* No results for filter */}
      {!loading && filtered.length === 0 && documents.length > 0 && (
        <div className="py-6 text-center">
          <p className="text-xs text-secondary-400 dark:text-neutral-500">No documents with status "{filter}"</p>
        </div>
      )}
    </PatientSectionCard>
  );
}
