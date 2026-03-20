import React, { useState, useEffect } from 'react';
import { getPatientBasicInfo } from '../../../pending-requests/patient-record-service';

/**
 * Request Action Modal
 * Reusable modal for approving or rejecting medicine requests with optional notes
 * Enhanced to load patient info and display rich request details
 */
const RequestActionModal = ({ request, action, onConfirm, onCancel }) => {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patientInfo, setPatientInfo] = useState(null);
  const [isLoadingPatient, setIsLoadingPatient] = useState(false);
  const [patientLoadError, setPatientLoadError] = useState('');

  if (!request) return null;

  const isApprove = action?.toLowerCase() === 'approve';
  const isReject = action?.toLowerCase() === 'reject';

  if (!isApprove && !isReject) return null;

  // Load patient info on mount
  useEffect(() => {
    if (request?.patientId && !patientInfo && !isLoadingPatient) {
      setIsLoadingPatient(true);
      setPatientLoadError('');
      
      console.log('🔄 Fetching patient info for patientId:', request.patientId);
      
      getPatientBasicInfo(request.patientId)
        .then(info => {
          console.log('✅ Patient info loaded:', info);
          setPatientInfo(info);
        })
        .catch(err => {
          console.error('❌ Failed to load patient info:', err);
          // Still show the request even if patient fetch fails
          setPatientLoadError('Could not load patient details');
        })
        .finally(() => {
          setIsLoadingPatient(false);
        });
    } else if (!request?.patientId) {
      console.warn('⚠️ Request missing patientId:', request?.id);
    }
  }, [request?.patientId]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(request, notes || null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to format date safely
  const formatDate = (dateValue) => {
    if (!dateValue) return '—';
    try {
      let date;
      if (typeof dateValue === 'number') {
        // Assume it's a timestamp in seconds; convert to milliseconds
        date = new Date(dateValue * 1000);
      } else if (typeof dateValue === 'string') {
        // Try ISO format or other formats
        const trimmed = dateValue.trim();
        if (/^\d+$/.test(trimmed)) {
          // Pure number string - could be seconds or milliseconds
          const numeric = Number(trimmed);
          date = new Date(trimmed.length >= 13 ? numeric : numeric * 1000);
        } else {
          // String date format
          date = new Date(trimmed);
        }
      } else {
        date = dateValue;
      }
      
      if (isNaN(date.getTime())) {
        console.warn('⚠️ Invalid date value:', dateValue);
        return '—';
      }
      return date.toLocaleDateString();
    } catch (err) {
      console.error('Error parsing date:', err);
      return '—';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-2xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          {isApprove ? (
            <>
              <div className="w-10 h-10 rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-success-700 dark:text-success-400">Approve Request</h2>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-error-100 dark:bg-error-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-error-600 dark:text-error-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-error-700 dark:text-error-400">Reject Request</h2>
            </>
          )}
        </div>

        {/* Content */}
        <div className="space-y-4 mb-5">
          {/* Patient Info */}
          <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-3">
            <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Patient</p>
            
            {isLoadingPatient ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-secondary-600 dark:text-neutral-400">Loading...</p>
              </div>
            ) : patientLoadError ? (
              <p className="text-xs text-error-600 dark:text-error-400">{patientLoadError}</p>
            ) : patientInfo ? (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-secondary-900 dark:text-white">
                  {[patientInfo.first_name, patientInfo.middle_name, patientInfo.last_name]
                    .filter(Boolean)
                    .join(' ')}
                </p>
                <p className="text-[10px] text-secondary-600 dark:text-neutral-400">
                  ID: {patientInfo.identifier} • {patientInfo.profile_type}
                </p>
              </div>
            ) : (
              <p className="text-xs text-secondary-600 dark:text-neutral-400">Patient #{request.patientId}</p>
            )}
          </div>

          {/* Request Info */}
          <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-3">
            <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Request Details</p>
            <div className="space-y-1.5">
              <div className="flex justify-between items-start gap-2">
                <span className="text-[10px] text-secondary-600 dark:text-neutral-400">Request ID:</span>
                <span className="text-xs font-mono font-medium text-secondary-900 dark:text-white">#{request.id}</span>
              </div>
              
              <div className="flex justify-between items-start gap-2">
                <span className="text-[10px] text-secondary-600 dark:text-neutral-400">Status:</span>
                <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-medium rounded ${
                  request.status === 'Pending' ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400' :
                  request.status === 'Approved' ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400' :
                  'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400'
                }`}>
                  {request.status}
                </span>
              </div>

              {request.items?.length > 0 && (
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[10px] text-secondary-600 dark:text-neutral-400">Quantity:</span>
                  <span className="text-xs font-medium text-secondary-900 dark:text-white">
                    {request.items.reduce((sum, i) => sum + (i.quantity || 0), 0)} unit(s)
                  </span>
                </div>
              )}

              {request.items?.length > 0 && (
                <div className="pt-1 border-t border-neutral-200 dark:border-neutral-600">
                  <p className="text-[10px] text-secondary-600 dark:text-neutral-400 mb-1.5">Medicine(s):</p>
                  <div className="space-y-1">
                    {request.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start gap-2 text-xs">
                        <span className="text-secondary-700 dark:text-neutral-300 flex-1">
                          {item.itemName || `Medicine #${item.medicineId || item.batchId || idx + 1}`}
                        </span>
                        <span className="text-secondary-600 dark:text-neutral-400 font-medium flex-shrink-0">
                          {item.quantity || '—'} qty
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {request.purpose && (
                <div className="flex justify-between items-start gap-2 pt-1 border-t border-neutral-200 dark:border-neutral-600">
                  <span className="text-[10px] text-secondary-600 dark:text-neutral-400">Purpose:</span>
                  <span className="text-xs text-secondary-800 dark:text-white text-right max-w-[150px]">
                    {request.purpose}
                  </span>
                </div>
              )}

              {request.created_at && (
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[10px] text-secondary-600 dark:text-neutral-400">Submitted:</span>
                  <span className="text-[10px] text-secondary-600 dark:text-neutral-400">
                    {formatDate(request.created_at)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Notes Input */}
          <div>
            <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-2">
              {isReject ? 'Reason for Rejection' : 'Notes'} (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isReject 
                ? 'e.g., Out of stock, Expired, Incorrect dosage...' 
                : 'e.g., Available at clinic, pick up from counter...'}
              rows={3}
              className="w-full px-3 py-2 text-xs border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isApprove
                ? 'bg-success-500 hover:bg-success-600'
                : 'bg-error-500 hover:bg-error-600'
            }`}
          >
            {isSubmitting ? 'Processing...' : (isApprove ? 'Approve' : 'Reject')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestActionModal;
