import React, { useState, useEffect, useCallback } from 'react';
import { 
  getMyDocuments, 
  downloadMyDocument,
  getRequestedDocuments,
  uploadRequestedDocument,
} from '../../services/documents-service';
import { axiosRequest } from '../../packages-core-adapter';

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
    <span className={`inline-flex items-center px-2 py-1 rounded text-[11px] font-medium ${style}`}>
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
  const [uploadProgress, setUploadProgress] = useState({});
  const [filter, setFilter] = useState('all');

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
    } catch (err) {
      console.error('Failed to load requested documents:', err);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

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
      // Stage the file first
      setUploadProgress(prev => ({ ...prev, [documentId]: 30 }));
      const fileUUID = await uploadFileToStaging(file);

      // Submit the document request with the staged file
      setUploadProgress(prev => ({ ...prev, [documentId]: 60 }));
      await uploadRequestedDocument(documentId, fileUUID);

      setUploadProgress(prev => ({ ...prev, [documentId]: 100 }));

      // Reload both lists
      await Promise.all([loadDocuments(), loadRequestedDocuments()]);

      // Clear progress after a brief delay
      setTimeout(() => {
        setUploadProgress(prev => {
          const next = { ...prev };
          delete next[documentId];
          return next;
        });
      }, 1000);
    } catch (err) {
      setError(err.message || 'Failed to upload document.');
      setUploadProgress(prev => {
        const next = { ...prev };
        delete next[documentId];
        return next;
      });
    } finally {
      setUploading(null);
    }
  };

  const handleDownload = async (doc) => {
    setDownloading(doc.id);
    try {
      const blob = await downloadMyDocument(doc.id);
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
    }
  };

  const handleView = async (doc) => {
    setDownloading(doc.id);
    try {
      const blob = await downloadMyDocument(doc.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      setError('Failed to open document.');
    } finally {
      setDownloading(null);
    }
  };

  const uniqueTypes = [...new Set(documents.map(d => d.templateType))];
  const filtered = filter === 'all' ? documents : documents.filter(d => d.templateType === filter);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Requested Documents Section */}
      {requestedDocs.length > 0 && (
        <div className="bg-warning-50 dark:bg-warning-900/10 border-2 border-warning-200 dark:border-warning-800 rounded-xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-warning-600 dark:text-warning-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-warning-900 dark:text-warning-200 mb-1">
                📋 Documents Requested ({requestedDocs.length})
              </h2>
              <p className="text-sm text-warning-700 dark:text-warning-300">
                Your healthcare provider has requested the following documents. Please upload them as soon as possible.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {requestedDocs.map((doc) => {
              const progress = uploadProgress[doc.id];
              const isUploading = uploading === doc.id;
              const status = doc.submission?.status || 'Requested';
              const canUpload = status === 'Requested';
              const needsReview = status === 'Pending';
              const isApproved = status === 'Recorded';
              const isRejected = status === 'Rejected';

              return (
                <div
                  key={doc.id}
                  className={`bg-white dark:bg-neutral-800 border rounded-lg p-4 ${
                    isApproved ? 'border-success-200 dark:border-success-800' :
                    isRejected ? 'border-error-200 dark:border-error-800' :
                    needsReview ? 'border-warning-200 dark:border-warning-600' :
                    'border-warning-200 dark:border-neutral-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`w-9 h-9 rounded flex items-center justify-center flex-shrink-0 ${
                        isApproved ? 'bg-success-100 dark:bg-success-900/20' :
                        isRejected ? 'bg-error-100 dark:bg-error-900/20' :
                        needsReview ? 'bg-warning-100 dark:bg-warning-900/20' :
                        'bg-warning-100 dark:bg-warning-900/20'
                      }`}>
                        <svg className={`w-4 h-4 ${
                          isApproved ? 'text-success-600 dark:text-success-400' :
                          isRejected ? 'text-error-600 dark:text-error-400' :
                          needsReview ? 'text-warning-600 dark:text-warning-400' :
                          'text-warning-600 dark:text-warning-400'
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
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-secondary-900 dark:text-white mb-1">
                          {doc.label}
                        </h3>
                        {doc.submission?.recordedBy && (
                          <p className="text-xs text-secondary-500 dark:text-neutral-400">
                            Requested by: {doc.submission.recordedBy.name}
                          </p>
                        )}
                        {doc.submission?.submittedAt && needsReview && (
                          <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-0.5">
                            Submitted: {formatDate(doc.submission.submittedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={status} />
                  </div>

                  {/* Notes - show when staff added notes (for any status) */}
                  {doc.submission?.notes && (
                    <div className={`mb-3 p-3 rounded border text-xs ${
                      status === 'Requested' ? 'bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800' :
                      isApproved ? 'bg-success-50 dark:bg-success-900/10 border-success-200 dark:border-success-800' :
                      isRejected ? 'bg-error-50 dark:bg-error-900/10 border-error-200 dark:border-error-800' :
                      'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                    }`}>
                      <p className={`font-medium mb-1 ${
                        status === 'Requested' ? 'text-primary-700 dark:text-primary-400' :
                        isApproved ? 'text-success-700 dark:text-success-400' : 
                        isRejected ? 'text-error-700 dark:text-error-400' :
                        'text-secondary-700 dark:text-neutral-400'
                      }`}>
                        {status === 'Requested' ? '📋 Why this document is needed:' :
                         isApproved ? '✓ Review Note:' : 
                         isRejected ? '✗ Rejection Reason:' :
                         'Note:'}
                      </p>
                      <p className={`${
                        status === 'Requested' ? 'text-secondary-700 dark:text-neutral-300' :
                        isApproved ? 'text-success-600 dark:text-success-300' : 
                        isRejected ? 'text-error-600 dark:text-error-300' :
                        'text-secondary-700 dark:text-neutral-300'
                      }`}>
                        {doc.submission.notes}
                      </p>
                    </div>
                  )}

                  {/* Status Messages - only show if no notes */}
                  {needsReview && !doc.submission?.notes && (
                    <div className="mb-3 p-2 bg-warning-50 dark:bg-warning-900/10 border border-warning-200 dark:border-warning-700 rounded text-xs text-warning-700 dark:text-warning-300">
                      ⏳ Your document is being reviewed by staff. You'll be notified once it's approved or rejected.
                    </div>
                  )}
                  {isApproved && !doc.submission?.notes && (
                    <div className="mb-3 p-2 bg-success-50 dark:bg-success-900/10 border border-success-200 dark:border-success-700 rounded text-xs text-success-700 dark:text-success-300">
                      ✓ This document has been approved by staff. No further action needed.
                    </div>
                  )}
                  {isRejected && !doc.submission?.notes && (
                    <div className="mb-3 p-2 bg-error-50 dark:bg-error-900/10 border border-error-200 dark:border-error-700 rounded text-xs text-error-700 dark:text-error-300">
                      ✗ This document was rejected. Please contact your healthcare provider for more information.
                    </div>
                  )}

                  {/* Upload Area - only show if status is Requested */}
                  {canUpload && (
                    <div className="relative">
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
                        className={`block w-full px-4 py-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                          isUploading
                            ? 'border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700/30 cursor-not-allowed'
                            : 'border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/10 hover:bg-primary-100 dark:hover:bg-primary-900/20 hover:border-primary-400 dark:hover:border-primary-600'
                        }`}
                      >
                        {isUploading ? (
                          <div className="space-y-2">
                            <svg className="w-8 h-8 mx-auto text-primary-500 dark:text-primary-400 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            <p className="text-sm font-medium text-primary-700 dark:text-primary-400">
                              Uploading... {progress || 0}%
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <svg className="w-8 h-8 mx-auto text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <p className="text-sm font-medium text-primary-700 dark:text-primary-400">
                              Click to upload or drag file here
                            </p>
                            <p className="text-xs text-secondary-500 dark:text-neutral-400">
                              PDF or image files accepted
                            </p>
                          </div>
                        )}
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">My Documents</h1>
          <p className="text-sm text-secondary-500 dark:text-neutral-400 mt-1">
            View and download your medical documents
          </p>
        </div>
        <button
          onClick={loadDocuments}
          disabled={loading}
          className="px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Filter chips */}
      {uniqueTypes.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 dark:bg-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
            }`}
          >
            All ({documents.length})
          </button>
          {uniqueTypes.map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === type
                  ? 'bg-primary-600 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
              }`}
            >
              {TYPE_LABELS[type] || type} ({documents.filter(d => d.templateType === type).length})
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg text-sm text-error-700 dark:text-error-400">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-neutral-100 dark:bg-neutral-700 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && documents.length === 0 && !error && (
        <div className="text-center py-16">
          <svg className="w-16 h-16 mx-auto text-secondary-300 dark:text-neutral-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-secondary-500 dark:text-neutral-400 text-sm">No documents found</p>
          <p className="text-secondary-400 dark:text-neutral-500 text-xs mt-1">Documents issued by your healthcare provider will appear here.</p>
        </div>
      )}

      {/* Document list */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(doc => (
            <div
              key={doc.id}
              className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 flex items-center gap-4 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${TYPE_STYLES[doc.templateType] || 'bg-neutral-100 dark:bg-neutral-700 text-secondary-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-600'}`}>
                    {TYPE_LABELS[doc.templateType] || doc.templateType}
                  </span>
                  {doc.description && (
                    <span className="text-xs text-secondary-400 dark:text-neutral-500 truncate">{doc.description}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-secondary-500 dark:text-neutral-400">
                  <span>Issued: {formatDateTime(doc.createdAt)}</span>
                  {doc.issuedBy?.name && <span>By: {doc.issuedBy.name}</span>}
                  {doc.expiredAt && <span className="text-warning-600 dark:text-warning-400">Expires: {formatDate(doc.expiredAt)}</span>}
                </div>
              </div>

              {/* Actions */}
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
  );
}
