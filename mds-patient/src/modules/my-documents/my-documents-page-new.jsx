import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getMyDocuments, 
  downloadMyDocument,
  getRequestedDocuments,
  uploadRequestedDocument,
} from '../../services/documents-service';
import { axiosRequest } from '../../packages-core-adapter';
import DocumentNotificationModal from './document-notification-modal';

const TYPE_LABELS = {
  prescription: 'Prescription',
  'medical-certificate': 'Medical Certificate',
  'diagnosis-report': 'Diagnosis Report',
  'staff-report': 'Staff Report',
};

const TYPE_STYLES = {
  prescription: 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border-primary-200 dark:border-primary-800',
  'medical-certificate': 'bg-accent-100 dark:bg-accent-900/20 text-accent-700 dark:text-accent-400 border-accent-200 dark:border-accent-800',
  'diagnosis-report': 'bg-success-100 dark:bg-success-900/20 text-success-700 dark:text-success-400 border-success-200 dark:border-success-800',
};

const STATUS_STYLES = {
  Requested: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
  Pending: 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
  Recorded: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
  Rejected: 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400',
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.Requested;
  const label = status === 'Recorded' ? 'Approved' : status;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: '2-digit',
  });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function MyDocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [requestedDocs, setRequestedDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [submitting, setSubmitting] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({});
  const [filter, setFilter] = useState('requested');
  const [stagedFiles, setStagedFiles] = useState({});
  const actionLocksRef = useRef(new Set());
  
  // Notification state
  const [dismissedNotifications, setDismissedNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('dismissedDocumentNotifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [notificationDocument, setNotificationDocument] = useState(null);

  // Persist dismissed notifications
  useEffect(() => {
    localStorage.setItem('dismissedDocumentNotifications', JSON.stringify(dismissedNotifications));
  }, [dismissedNotifications]);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const docs = await getMyDocuments();
      setDocuments(docs);
    } catch (err) {
      setError(err.message || 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRequestedDocuments = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const docs = await getRequestedDocuments();
      setRequestedDocs(docs);
      
      // Check for notification-worthy documents
      const notificationWorthy = docs.filter((d) => {
        const status = d.submission?.status?.toLowerCase();
        return status === 'recorded' || status === 'rejected';
      });
      
      // Sort by date (newest first)
      const sortedByDate = notificationWorthy.sort((a, b) => {
        const dateA = a.submission?.submittedAt || a.created_at;
        const dateB = b.submission?.submittedAt || b.created_at;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
      
      // Show only the most recent undismissed notification
      const mostRecent = sortedByDate.find(
        (d) => !dismissedNotifications.includes(d.id)
      );
      
      setNotificationDocument(mostRecent || null);
    } catch (err) {
      console.error('Failed to load requested documents:', err);
    } finally {
      setLoadingRequests(false);
    }
  }, [dismissedNotifications]);

  useEffect(() => {
    loadDocuments();
    loadRequestedDocuments();
  }, [loadDocuments, loadRequestedDocuments]);

  const uploadFileToStaging = async (file) => {
    const body = new FormData();
    body.append('file', file);

    const response = await axiosRequest.post('/media/stage', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (!response.data?.fileId) {
      throw new Error('File upload failed - no fileId returned');
    }

    return response.data.fileId;
  };

  const handleFileSelect = async (documentId, file) => {
    if (!file) return;

    setUploading(documentId);
    setError('');
    setUploadProgress(prev => ({ ...prev, [documentId]: 0 }));

    try {
      setUploadProgress(prev => ({ ...prev, [documentId]: 50 }));
      const fileUUID = await uploadFileToStaging(file);
      setUploadProgress(prev => ({ ...prev, [documentId]: 100 }));

      setStagedFiles(prev => ({
        ...prev,
        [documentId]: { file, fileId: fileUUID },
      }));

      setTimeout(() => {
        setUploadProgress(prev => {
          const next = { ...prev };
          delete next[documentId];
          return next;
        });
      }, 500);
    } catch (err) {
      setError(err.message || 'Failed to upload file.');
      setUploadProgress(prev => {
        const next = { ...prev };
        delete next[documentId];
        return next;
      });
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async (documentId) => {
    const staged = stagedFiles[documentId];
    if (!staged?.fileId) {
      setError('No file selected. Please select a file first.');
      return;
    }

    setSubmitting(documentId);
    setError('');

    try {
      await uploadRequestedDocument(documentId, staged.fileId);

      setStagedFiles(prev => {
        const next = { ...prev };
        delete next[documentId];
        return next;
      });

      await Promise.all([loadDocuments(), loadRequestedDocuments()]);
    } catch (err) {
      setError(err.message || 'Failed to submit document.');
    } finally {
      setSubmitting(null);
    }
  };

  const handleCancelStaged = (documentId) => {
    setStagedFiles(prev => {
      const next = { ...prev };
      delete next[documentId];
      return next;
    });
  };

  const handleDownload = async (doc) => {
    const lockKey = `doc:${doc.id}`;
    if (actionLocksRef.current.has(lockKey)) return;
    actionLocksRef.current.add(lockKey);
    setDownloading(doc.id);
    try {
      const blob = await downloadMyDocument(doc, { mode: 'download' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.templateType || 'document'}_${formatDate(doc.createdAt).replace(/\s/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download document.');
    } finally {
      setDownloading(null);
      actionLocksRef.current.delete(lockKey);
    }
  };

  const handleView = async (doc) => {
    const lockKey = `doc:${doc.id}`;
    if (actionLocksRef.current.has(lockKey)) return;
    actionLocksRef.current.add(lockKey);
    setDownloading(doc.id);
    try {
      const blob = await downloadMyDocument(doc, { mode: 'view' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      setError('Failed to open document.');
    } finally {
      setDownloading(null);
      actionLocksRef.current.delete(lockKey);
    }
  };

  const dismissNotification = () => {
    if (notificationDocument) {
      setDismissedNotifications(prev => [...prev, notificationDocument.id]);
      setNotificationDocument(null);
    }
  };

  const getFilteredRequestedDocs = () => {
    if (filter === 'requested') {
      return requestedDocs.filter(d => d.submission?.status === 'Requested');
    }
    if (filter === 'pending') {
      return requestedDocs.filter(d => d.submission?.status === 'Pending');
    }
    if (filter === 'recorded') {
      return requestedDocs.filter(d => 
        d.submission?.status === 'Recorded' || d.submission?.status === 'Rejected'
      );
    }
    return requestedDocs;
  };

  const filteredRequested = getFilteredRequestedDocs();
  const requestedCount = requestedDocs.filter(d => d.submission?.status === 'Requested').length;
  const pendingCount = requestedDocs.filter(d => d.submission?.status === 'Pending').length;
  const recordedCount = requestedDocs.filter(d => 
    d.submission?.status === 'Recorded' || d.submission?.status === 'Rejected'
  ).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">My Documents</h1>
          <p className="text-sm text-secondary-500 dark:text-neutral-400 mt-1">
            Manage document requests and view your records
          </p>
        </div>
        <button
          onClick={() => { loadDocuments(); loadRequestedDocuments(); }}
          disabled={loading || loadingRequests}
          className="px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2"
        >
          <svg className={`w-4 h-4 ${(loading || loadingRequests) ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg">
          <p className="text-sm text-error-700 dark:text-error-400 mb-0">{error}</p>
        </div>
      )}

      {/* Document Requests Section */}
      {requestedDocs.length > 0 && (
        <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-sm overflow-hidden">
          {/* Tab Navigation */}
          <div className="border-b border-neutral-200 dark:border-neutral-700">
            <div className="px-6 py-0 flex items-center gap-0">
              <button
                onClick={() => setFilter('requested')}
                className={`relative px-4 py-3.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  filter === 'requested'
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-secondary-600 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  Requested
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold rounded-full bg-neutral-100 dark:bg-neutral-700 text-secondary-700 dark:text-neutral-300">
                    {requestedCount}
                  </span>
                </span>
                {filter === 'requested' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400" />
                )}
              </button>

              <button
                onClick={() => setFilter('pending')}
                className={`relative px-4 py-3.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  filter === 'pending'
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-secondary-600 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  Pending
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold rounded-full bg-neutral-100 dark:bg-neutral-700 text-secondary-700 dark:text-neutral-300">
                    {pendingCount}
                  </span>
                </span>
                {filter === 'pending' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400" />
                )}
              </button>

              <button
                onClick={() => setFilter('recorded')}
                className={`relative px-4 py-3.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  filter === 'recorded'
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-secondary-600 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  Recorded
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold rounded-full bg-neutral-100 dark:bg-neutral-700 text-secondary-700 dark:text-neutral-300">
                    {recordedCount}
                  </span>
                </span>
                {filter === 'recorded' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400" />
                )}
              </button>
            </div>
          </div>

          {/* Documents List */}
          <div className="p-6">
            {loadingRequests ? (
              <div className="py-12 text-center">
                <svg className="w-8 h-8 mx-auto text-primary-500 animate-spin mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-sm text-secondary-500 dark:text-neutral-400">Loading documents...</p>
              </div>
            ) : filteredRequested.length === 0 ? (
              <div className="py-12 text-center">
                <svg className="w-12 h-12 mx-auto text-neutral-300 dark:text-neutral-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm font-medium text-secondary-700 dark:text-neutral-300">
                  {filter === 'requested' && 'No requested documents'}
                  {filter === 'pending' && 'No pending documents'}
                  {filter === 'recorded' && 'No recorded documents'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
              {filteredRequested.map((doc) => {
                const progress = uploadProgress[doc.id];
                const isUploading = uploading === doc.id;
                const isSubmitting = submitting === doc.id;
                const stagedFile = stagedFiles[doc.id];
                const status = doc.submission?.status || 'Requested';
                const canUpload = status === 'Requested';
                const needsReview = status === 'Pending';
                const isApproved = status === 'Recorded';
                const isRejected = status === 'Rejected';

                return (
                  <div
                    key={doc.id}
                    className={`border-2 rounded-xl p-4 transition-all ${
                      isApproved ? 'border-success-300 dark:border-success-700/50 bg-success-50/30 dark:bg-success-900/10' :
                      isRejected ? 'border-error-300 dark:border-error-700/50 bg-error-50/30 dark:bg-error-900/10' :
                      needsReview ? 'border-warning-300 dark:border-warning-700/50 bg-warning-50/30 dark:bg-warning-900/10' :
                      'border-primary-300 dark:border-primary-700/50 bg-primary-50/30 dark:bg-primary-900/10'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isApproved ? 'bg-success-100 dark:bg-success-900/30' :
                          isRejected ? 'bg-error-100 dark:bg-error-900/30' :
                          needsReview ? 'bg-warning-100 dark:bg-warning-900/30' :
                          'bg-primary-100 dark:bg-primary-900/30'
                        }`}>
                          <svg className={`w-5 h-5 ${
                            isApproved ? 'text-success-600 dark:text-success-400' :
                            isRejected ? 'text-error-600 dark:text-error-400' :
                            needsReview ? 'text-warning-600 dark:text-warning-400' :
                            'text-primary-600 dark:text-primary-400'
                          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isApproved ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            ) : isRejected ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            )}
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-secondary-900 dark:text-white mb-1">
                            {doc.label}
                          </h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            {doc.submission?.recordedBy && (
                              <span className="text-xs text-secondary-500 dark:text-neutral-400">
                                Requested by: {doc.submission.recordedBy.name}
                              </span>
                            )}
                            {doc.submission?.submittedAt && (
                              <span className="text-xs text-secondary-400 dark:text-neutral-500">
                                • Submitted: {formatDate(doc.submission.submittedAt)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <StatusBadge status={status} />
                    </div>

                    {/* Notes from Staff */}
                    {doc.submission?.notes && (
                      <div className={`mb-3 p-3 rounded-lg border ${
                        isApproved ? 'bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800' :
                        isRejected ? 'bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-800' :
                        status === 'Requested' ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800' :
                        'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                      }`}>
                        <p className={`text-[10px] uppercase tracking-wider font-medium mb-1.5 ${
                          isApproved ? 'text-success-600 dark:text-success-400' :
                          isRejected ? 'text-error-600 dark:text-error-400' :
                          status === 'Requested' ? 'text-primary-600 dark:text-primary-400' :
                          'text-secondary-600 dark:text-neutral-400'
                        }`}>
                          {status === 'Requested' ? '📋 Request Note' :
                           isApproved ? '✓ Approval Note' :
                           isRejected ? '✗ Rejection Reason' :
                           'Note'}
                        </p>
                        <p className="text-xs text-secondary-700 dark:text-neutral-300 whitespace-pre-wrap">
                          {doc.submission.notes}
                        </p>
                      </div>
                    )}

                    {/* Status-specific Messages */}
                    {needsReview && !doc.submission?.notes && (
                      <div className="mb-3 p-3 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg">
                        <p className="text-xs text-warning-700 dark:text-warning-300 flex items-center gap-2 mb-0">
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Under review. You'll be notified once approved.</span>
                        </p>
                      </div>
                    )}

                    {isApproved && !doc.submission?.notes && (
                      <div className="mb-3 p-3 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg">
                        <p className="text-xs text-success-700 dark:text-success-300 flex items-center gap-2 mb-0">
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Document approved. No further action needed.</span>
                        </p>
                      </div>
                    )}

                    {/* Upload Area */}
                    {canUpload && (
                      <div className="mt-3">
                        {stagedFile ? (
                          <div className="p-4 border-2 border-success-300 dark:border-success-700 bg-success-50 dark:bg-success-900/10 rounded-lg">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-10 h-10 rounded-lg bg-success-100 dark:bg-success-900/30 flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-success-800 dark:text-success-200 truncate">
                                  {stagedFile.file.name}
                                </p>
                                <p className="text-xs text-success-600 dark:text-success-400">
                                  {(stagedFile.file.size / 1024).toFixed(1)} KB • Ready to submit
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSubmit(doc.id)}
                                disabled={isSubmitting}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-success-600 hover:bg-success-700 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                              >
                                {isSubmitting ? (
                                  <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    Submitting...
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Submit Document
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleCancelStaged(doc.id)}
                                disabled={isSubmitting}
                                className="px-4 py-2.5 text-sm font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg transition-colors disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <input
                              type="file"
                              id={`file-upload-${doc.id}`}
                              accept="image/*,application/pdf"
                              onChange={(e) => handleFileSelect(doc.id, e.target.files[0])}
                              disabled={isUploading}
                              className="hidden"
                            />
                            <label
                              htmlFor={`file-upload-${doc.id}`}
                              className={`block w-full px-4 py-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all ${
                                isUploading
                                  ? 'border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700/30 cursor-not-allowed'
                                  : 'border-primary-300 dark:border-primary-700 bg-white dark:bg-neutral-900/50 hover:bg-primary-50 dark:hover:bg-primary-900/10 hover:border-primary-400 dark:hover:border-primary-600'
                              }`}
                            >
                              {isUploading ? (
                                <div className="space-y-2">
                                  <svg className="w-10 h-10 mx-auto text-primary-500 dark:text-primary-400 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                  </svg>
                                  <p className="text-sm font-medium text-primary-600 dark:text-primary-400">
                                    Uploading... {progress || 0}%
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <svg className="w-10 h-10 mx-auto text-primary-500 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                  </svg>
                                  <p className="text-sm font-medium text-primary-600 dark:text-primary-400">
                                    Click to upload document
                                  </p>
                                  <p className="text-xs text-secondary-500 dark:text-neutral-400">
                                    PDF or image files • Max 10MB
                                  </p>
                                </div>
                              )}
                            </label>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Issued Documents Section */}
      {documents.length > 0 && (
        <div className="mt-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-success-100 dark:bg-success-900/30">
              <svg className="w-5 h-5 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-secondary-900 dark:text-white">Issued Documents</h2>
              <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-0.5">
                Documents issued by your healthcare provider
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-sm p-6">
            {loading ? (
              <div className="py-8 text-center">
                <svg className="w-8 h-8 mx-auto text-primary-500 animate-spin mb-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <p className="text-sm text-secondary-500 dark:text-neutral-400">Loading documents...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map(doc => (
                  <div
                    key={doc.id}
                    className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 flex items-center gap-4 hover:border-primary-300 dark:hover:border-primary-700 transition-all hover:shadow-sm"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${TYPE_STYLES[doc.templateType] || 'bg-neutral-100 dark:bg-neutral-700 text-secondary-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-600'}`}>
                          {TYPE_LABELS[doc.templateType] || doc.templateType}
                        </span>
                        {doc.description && (
                          <span className="text-xs text-secondary-400 dark:text-neutral-500 truncate">{doc.description}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-secondary-500 dark:text-neutral-400 flex-wrap">
                        <span>Issued: {formatDateTime(doc.createdAt)}</span>
                        {doc.issuedBy?.name && <span>• By: {doc.issuedBy.name}</span>}
                        {doc.expiredAt && <span className="text-warning-600 dark:text-warning-400">• Expires: {formatDate(doc.expiredAt)}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleView(doc)}
                        disabled={downloading === doc.id}
                        className="px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded-lg transition-colors disabled:opacity-50"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDownload(doc)}
                        disabled={downloading === doc.id}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        {downloading === doc.id ? (
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        )}
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notification Modal */}
      <DocumentNotificationModal
        document={notificationDocument}
        onDismiss={dismissNotification}
      />
    </div>
  );
}
