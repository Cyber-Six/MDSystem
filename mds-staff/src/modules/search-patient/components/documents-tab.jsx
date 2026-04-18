import React, { useState, useEffect, useCallback } from 'react';
import PatientSectionCard from './section-card';
import {
  getRequiredDocuments,
  getGeneratedDocuments,
  downloadGeneratedDocumentBlob,
  requestDocument,
  approveDocument,
  rejectDocument,
  archiveDocument,
  cancelDocument,
  viewDocumentFile,
} from '../../../services/document-service';
import ConfirmationModal from '../../../components/modals/ConfirmationModal';
import { useStaffNotifications } from '../../notification/notification-context';

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

function formatTemplateType(templateType) {
  if (!templateType) return 'Generated Document';
  return String(templateType)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

// Document Preview Modal Component
function DocumentPreviewModal({ isOpen, onClose, fileUrl, fileType, fileName }) {
  if (!isOpen) return null;

  // Detect file type from MIME or filename
  const isPdf = fileType === 'application/pdf' || fileName?.toLowerCase().endsWith('.pdf');
  const isImage = fileType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-neutral-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900">
          <h3 className="text-sm font-medium text-secondary-800 dark:text-white truncate">
            {fileName || 'Document Preview'}
          </h3>
          <div className="flex items-center gap-2">
            <a
              href={fileUrl}
              download={fileName}
              className="px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded transition-colors"
            >
              Download
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-auto max-h-[calc(90vh-60px)] bg-neutral-100 dark:bg-neutral-900">
          {isImage ? (
            <div className="flex items-center justify-center p-4 min-h-[400px]">
              <img
                src={fileUrl}
                alt="Document Preview"
                className="max-w-full max-h-[80vh] object-contain rounded shadow-lg"
              />
            </div>
          ) : isPdf ? (
            <iframe
              src={fileUrl}
              title="Document Preview"
              className="w-full h-[80vh] border-0"
            />
          ) : (
            // For unknown types, try iframe first (works for many formats)
            <iframe
              src={fileUrl}
              title="Document Preview"
              className="w-full h-[80vh] border-0"
              onError={(e) => {
                // If iframe fails, show download option
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          )}
          
          {/* Fallback download UI (hidden by default) */}
          {!isImage && !isPdf && (
            <div className="hidden flex-col items-center justify-center p-8 text-center h-[80vh]">
              <svg className="w-16 h-16 text-neutral-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                Preview not available for this file type
              </p>
              <a
                href={fileUrl}
                download={fileName}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
              >
                Download File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PatientDocumentsTab({ patient, canManageDocuments = true }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requesting, setRequesting] = useState(null);
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('non-generated');
  const [filter, setFilter] = useState(canManageDocuments ? 'Missing' : 'Recorded');
  const [notes, setNotes] = useState({});
  const [generatedDocuments, setGeneratedDocuments] = useState([]);
  const [generatedLoading, setGeneratedLoading] = useState(false);
  const [generatedError, setGeneratedError] = useState('');
  const [downloadingGeneratedId, setDownloadingGeneratedId] = useState(null);
  
  // Preview modal state
  const [previewModal, setPreviewModal] = useState({ isOpen: false, fileUrl: null, fileType: null, fileName: null });

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: null, // 'reject', 'archive', 'cancel'
    documentId: null,
    documentLabel: null,
  });

  const patientId = patient?.id;
  const { subscribe } = useStaffNotifications();

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

  const loadGenerated = useCallback(async () => {
    if (!patientId) {
      setGeneratedDocuments([]);
      setGeneratedLoading(false);
      return;
    }

    setGeneratedLoading(true);
    setGeneratedError('');
    try {
      const docs = await getGeneratedDocuments(patientId);
      setGeneratedDocuments(docs);
    } catch (err) {
      setGeneratedError(err.message || 'Failed to load generated documents');
    } finally {
      setGeneratedLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (activeSubTab !== 'generated') return;
    loadGenerated();
  }, [activeSubTab, loadGenerated]);

  useEffect(() => {
    if (!canManageDocuments && ['Missing', 'Requested', 'Pending'].includes(filter)) {
      setFilter('Recorded');
    }
  }, [canManageDocuments, filter]);

  // Subscribe to document:submitted notifications to auto-refresh this patient's documents
  useEffect(() => {
    if (!patientId) return;

    const unsubscribe = subscribe('document:submitted', (data) => {
      // Only refresh if the notification is for this specific patient
      if (data?.patientId && String(data.patientId) === String(patientId)) {
        console.log('Document submitted for this patient - refreshing documents', {
          notificationPatientId: data.patientId,
          currentPatientId: patientId,
          documentLabel: data?.label
        });
        loadDocuments();
      }
    });

    return unsubscribe;
  }, [subscribe, patientId, loadDocuments]);

  const handleRequest = async (documentId) => {
    if (!canManageDocuments) return;
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
    if (!canManageDocuments) return;
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

  const handleReject = async (documentId, documentLabel) => {
    if (!canManageDocuments) return;
    setConfirmModal({
      isOpen: true,
      type: 'reject',
      documentId,
      documentLabel,
    });
  };

  const confirmReject = async (reason) => {
    if (!canManageDocuments) return;
    const documentId = confirmModal.documentId;
    setConfirmModal({ isOpen: false, type: null, documentId: null, documentLabel: null });
    setRejecting(documentId);
    setError('');
    try {
      await rejectDocument(documentId, patientId, reason || null);
      setNotes(prev => ({ ...prev, [documentId]: '' }));
      await loadDocuments();
    } catch (err) {
      setError(err.message || 'Failed to reject document');
    } finally {
      setRejecting(null);
    }
  };

  const handleArchive = async (documentId, documentLabel) => {
    if (!canManageDocuments) return;
    setConfirmModal({
      isOpen: true,
      type: 'archive',
      documentId,
      documentLabel,
    });
  };

  const confirmArchive = async (archiveNotes) => {
    if (!canManageDocuments) return;
    const documentId = confirmModal.documentId;
    setConfirmModal({ isOpen: false, type: null, documentId: null, documentLabel: null });
    setArchiving(documentId);
    setError('');
    try {
      await archiveDocument(documentId, patientId, archiveNotes || null);
      setNotes(prev => ({ ...prev, [documentId]: '' }));
      await loadDocuments();
    } catch (err) {
      setError(err.message || 'Failed to archive document');
    } finally {
      setArchiving(null);
    }
  };

  const handleViewFile = async (fileId, fileName = 'Document') => {
    setViewing(fileId);
    setError('');
    try {
      const blob = await viewDocumentFile(fileId);
      const url = URL.createObjectURL(blob);
      setPreviewModal({
        isOpen: true,
        fileUrl: url,
        fileType: blob.type,
        fileName: fileName,
      });
    } catch {
      setError('Failed to open file');
    } finally {
      setViewing(null);
    }
  };

  const closePreviewModal = () => {
    if (previewModal.fileUrl) {
      URL.revokeObjectURL(previewModal.fileUrl);
    }
    setPreviewModal({ isOpen: false, fileUrl: null, fileType: null, fileName: null });
  };

  const handleDownloadGenerated = async (documentId, templateType) => {
    setDownloadingGeneratedId(documentId);
    setGeneratedError('');
    try {
      const blob = await downloadGeneratedDocumentBlob(documentId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${templateType || 'document'}_${documentId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setGeneratedError(err.message || 'Failed to download generated document');
    } finally {
      setDownloadingGeneratedId(null);
    }
  };

  const handleCancel = async (documentId, documentLabel) => {
    if (!canManageDocuments) return;
    setConfirmModal({
      isOpen: true,
      type: 'cancel',
      documentId,
      documentLabel,
    });
  };

  const confirmCancel = async () => {
    if (!canManageDocuments) return;
    const documentId = confirmModal.documentId;
    setConfirmModal({ isOpen: false, type: null, documentId: null, documentLabel: null });
    setCancelling(documentId);
    setError('');
    try {
      await cancelDocument(documentId, patientId);
      await loadDocuments();
    } catch (err) {
      setError(err.message || 'Failed to cancel document request');
    } finally {
      setCancelling(null);
    }
  };

  const closeConfirmModal = () => {
    setConfirmModal({ isOpen: false, type: null, documentId: null, documentLabel: null });
  };

  const handleConfirmAction = (notes) => {
    if (confirmModal.type === 'reject') {
      confirmReject(notes);
    } else if (confirmModal.type === 'archive') {
      confirmArchive(notes);
    } else if (confirmModal.type === 'cancel') {
      confirmCancel();
    }
  };

  const getConfirmModalConfig = () => {
    const { type, documentLabel } = confirmModal;
    
    switch (type) {
      case 'reject':
        return {
          title: 'Reject Document',
          message: `Are you sure you want to reject "${documentLabel}"?`,
          description: 'The patient will be notified about this rejection.',
          confirmText: 'Reject',
          variant: 'danger',
          showNotesInput: true,
          notesLabel: 'Rejection Reason',
          notesPlaceholder: 'Enter reason for rejection...',
          notesRequired: false,
        };
      case 'archive':
        return {
          title: 'Archive Document',
          message: `Archive "${documentLabel}"?`,
          description: 'You can request a new document after archiving. This action will move the current document to archived submissions.',
          confirmText: 'Archive',
          variant: 'danger',
          showNotesInput: true,
          notesLabel: 'Archive Notes (Optional)',
          notesPlaceholder: 'Enter notes about why this is being archived...',
          notesRequired: false,
        };
      case 'cancel':
        return {
          title: 'Cancel Document Request',
          message: `Cancel the request for "${documentLabel}"?`,
          description: 'The patient will no longer see this document request.',
          confirmText: 'Cancel Request',
          variant: 'danger',
          showNotesInput: false,
        };
      default:
        return {};
    }
  };

  const getDocStatus = (doc) => {
    // RULE: submission is the CURRENT active submission
    if (!doc.submission) return 'Missing';
    
    // Return the active state this document is in
    return doc.submission.status;
  };

  // For Archived filter, show documents that have archived submissions
  const getFilteredDocs = () => {
    if (filter === 'Archived') {
      // Show documents with archived submissions (historical approved versions)
      return documents.filter(d => 
        d.archivedSubmissions && d.archivedSubmissions.length > 0
      );
    }
    
    if (filter === 'Missing') {
      // Missing = no active submission
      return documents.filter(d => !d.submission);
    }
    
    // For other filters, match by status
    return documents.filter(d => getDocStatus(d) === filter);
  };

  // Filter tabs: manage-enabled users see workflow states, others are read-only.
  const statuses = canManageDocuments
    ? ['Missing', 'Requested', 'Pending', 'Recorded', 'Archived']
    : ['Recorded', 'Archived'];
  const filtered = getFilteredDocs();

  const submittedDocs = documents.filter(d => d.submission?.status === 'Recorded');
  const pendingDocs = documents.filter(d => d.submission?.status === 'Pending');
  const requestedDocs = documents.filter(d => d.submission?.status === 'Requested');
  const missingDocs = documents.filter(d => !d.submission);
  const generatedSummaryByType = generatedDocuments.reduce((acc, doc) => {
    const key = doc.templateType || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const refreshHandler = activeSubTab === 'generated' ? loadGenerated : loadDocuments;
  const isRefreshing = activeSubTab === 'generated' ? generatedLoading : loading;

  if (!patientId) {
    return (
      <PatientSectionCard title="Documents">
        <div className="py-8 text-center">
          <p className="text-sm text-secondary-500 dark:text-neutral-400">No patient selected</p>
        </div>
      </PatientSectionCard>
    );
  }

  return (
    <PatientSectionCard
      title="Documents"
      right={
        <div className="flex items-center gap-2">
          <button
            onClick={refreshHandler}
            disabled={isRefreshing}
            className="p-1.5 text-secondary-400 dark:text-neutral-500 hover:text-secondary-600 dark:hover:text-neutral-300 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      }
    >
      {/* Source Sub-tabs */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('non-generated')}
          className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap ${
            activeSubTab === 'non-generated'
              ? 'bg-primary-500 dark:bg-primary-600 text-white'
              : 'text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-200 bg-neutral-100 dark:bg-neutral-700/50'
          }`}
        >
          Non-Generated
        </button>
        <button
          onClick={() => setActiveSubTab('generated')}
          className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap ${
            activeSubTab === 'generated'
              ? 'bg-primary-500 dark:bg-primary-600 text-white'
              : 'text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-200 bg-neutral-100 dark:bg-neutral-700/50'
          }`}
        >
          Generated
        </button>
      </div>

      {activeSubTab === 'generated' ? (
        <>
          {/* Generated Summary */}
          <div className="flex gap-4 mb-4 pb-3 border-b border-neutral-100 dark:border-neutral-700/60">
            <div className="text-center">
              <p className="text-lg font-bold text-primary-600 dark:text-primary-400">{generatedDocuments.length}</p>
              <p className="text-[10px] text-secondary-400 dark:text-neutral-500 uppercase">Total</p>
            </div>
            {Object.entries(generatedSummaryByType).slice(0, 3).map(([type, count]) => (
              <div key={type} className="text-center">
                <p className="text-lg font-bold text-secondary-700 dark:text-neutral-200">{count}</p>
                <p className="text-[10px] text-secondary-400 dark:text-neutral-500 uppercase">{formatTemplateType(type)}</p>
              </div>
            ))}
          </div>

          {/* Generated Error */}
          {generatedError && (
            <div className="flex items-center gap-2 p-2 mb-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded text-xs text-error-700 dark:text-error-400">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {generatedError}
            </div>
          )}

          {/* Generated Loading */}
          {generatedLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-neutral-100 dark:bg-neutral-700 rounded animate-pulse" />
              ))}
            </div>
          )}

          {/* Generated Empty */}
          {!generatedLoading && generatedDocuments.length === 0 && !generatedError && (
            <div className="py-8 text-center">
              <svg className="w-10 h-10 mx-auto text-secondary-300 dark:text-neutral-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-secondary-500 dark:text-neutral-400">No generated documents yet</p>
            </div>
          )}

          {/* Generated List */}
          {!generatedLoading && generatedDocuments.length > 0 && (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-700/60 -mx-3 -mb-3">
              {generatedDocuments.map((doc) => {
                const isDownloading = downloadingGeneratedId === doc.id;
                return (
                  <div key={doc.id} className="px-3 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-700/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-secondary-800 dark:text-white truncate">
                          {formatTemplateType(doc.templateType)}
                        </p>
                        <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-0.5">
                          {doc.description || 'System-generated document'}
                        </p>
                        <div className="mt-1.5 text-[11px] text-secondary-500 dark:text-neutral-400 flex flex-wrap items-center gap-3">
                          <span>Issued: {formatDate(doc.createdAt)}</span>
                          <span>Patient: {doc.patient?.name || patient?.name || 'Unknown'}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownloadGenerated(doc.id, doc.templateType)}
                        disabled={isDownloading}
                        className="px-2.5 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded transition-colors disabled:opacity-50 inline-flex items-center gap-1 shrink-0"
                      >
                        {isDownloading ? (
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                          </svg>
                        )}
                        Download
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
      {/* Summary Stats */}
      <div className="flex gap-4 mb-4 pb-3 border-b border-neutral-100 dark:border-neutral-700/60">
        <div className="text-center">
          <p className="text-lg font-bold text-success-600 dark:text-success-400">{submittedDocs.length}</p>
          <p className="text-[10px] text-secondary-400 dark:text-neutral-500 uppercase">Approved</p>
        </div>
        {canManageDocuments && (
          <>
            <div className="text-center">
              <p className="text-lg font-bold text-warning-600 dark:text-warning-400">{pendingDocs.length}</p>
              <p className="text-[10px] text-secondary-400 dark:text-neutral-500 uppercase">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-primary-600 dark:text-primary-400">{requestedDocs.length}</p>
              <p className="text-[10px] text-secondary-400 dark:text-neutral-500 uppercase">Requested</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-neutral-400 dark:text-neutral-500">{missingDocs.length}</p>
              <p className="text-[10px] text-secondary-400 dark:text-neutral-500 uppercase">Missing</p>
            </div>
          </>
        )}
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
                          onClick={() => handleViewFile(archived.file, `${doc.label} - Archived v${idx + 1}`)}
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
                        'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                      }`}>
                        <span className={`font-medium ${
                          status === 'Requested' ? 'text-primary-600 dark:text-primary-400' :
                          status === 'Recorded' ? 'text-success-600 dark:text-success-400' :
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
                            onClick={() => handleViewFile(archived.file, `${doc.label} - Archived v${doc.archivedSubmissions.length - idx}`)}
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

                {/* Actions Row - Hide when viewing Archived filter */}
                {filter !== 'Archived' && (
                  <div className="mt-2 ml-10 space-y-2">
                    {/* Missing: Show notes input and Request button */}
                    {status === 'Missing' && (
                    <div className="space-y-2">
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
                        Request
                      </button>
                    </div>
                  )}

                  {/* Requested: Show waiting message + Cancel button */}
                  {status === 'Requested' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-primary-600 dark:text-primary-400 italic">
                        Waiting for patient to upload...
                      </span>
                      <button
                        onClick={() => handleCancel(doc.id)}
                        disabled={cancelling === doc.id}
                        className="px-2.5 py-1 text-xs font-medium text-error-600 dark:text-error-400 bg-error-50 dark:bg-error-900/20 hover:bg-error-100 dark:hover:bg-error-900/40 rounded transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        {cancelling === doc.id ? (
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        Cancel Request
                      </button>
                    </div>
                  )}

                  {/* Pending: Show View File + notes + Approve/Reject buttons */}
                  {status === 'Pending' && (
                    <div className="space-y-2">
                      {/* View File Button */}
                      {doc.submission?.file && (
                        <button
                          onClick={() => handleViewFile(doc.submission.file, `${doc.label} - Pending Review`)}
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
                          onClick={() => handleReject(doc.id, doc.label)}
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

                        {/* Cancel Request Button */}
                        <button
                          onClick={() => handleCancel(doc.id, doc.label)}
                          disabled={cancelling === doc.id || isApproving || isRejecting}
                          className="px-2.5 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          {cancelling === doc.id ? (
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          Cancel Request
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Recorded: Show View File + Archive button */}
                  {status === 'Recorded' && doc.submission?.file && (
                    canManageDocuments ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewFile(doc.submission.file, `${doc.label} - Recorded`)}
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
                            onClick={() => handleArchive(doc.id, doc.label)}
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
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewFile(doc.submission.file, `${doc.label} - Recorded`)}
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
                      </div>
                    )
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
        </>
      )}

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={previewModal.isOpen}
        onClose={closePreviewModal}
        fileUrl={previewModal.fileUrl}
        fileType={previewModal.fileType}
        fileName={previewModal.fileName}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={handleConfirmAction}
        isLoading={rejecting === confirmModal.documentId || archiving === confirmModal.documentId || cancelling === confirmModal.documentId}
        {...getConfirmModalConfig()}
      />
    </PatientSectionCard>
  );
}
