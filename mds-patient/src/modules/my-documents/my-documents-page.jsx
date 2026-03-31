import React, { useState, useEffect, useCallback } from 'react';
import { getMyDocuments, downloadMyDocument } from '../../services/documents-service';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(null);
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

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

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
