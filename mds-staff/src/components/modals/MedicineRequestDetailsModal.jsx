import React, { useState } from 'react';

/**
 * Medicine Request Details Modal
 * Displays medicine request details with dispense/reject actions
 */
const MedicineRequestDetailsModal = ({ request, onClose, onDispense, onReject }) => {
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [dispensedQuantity, setDispensedQuantity] = useState(request?.requestedQuantity || '');
  const [quantityError, setQuantityError] = useState('');

  if (!request) return null;

  const handleDispense = () => {
    const parsedQuantity = Number(dispensedQuantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setQuantityError('Please enter a valid quantity');
      return;
    }
    setQuantityError('');
    onDispense?.(request.id, parsedQuantity);
    onClose();
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      setRejectError('Please provide a reason for rejection');
      return;
    }
    setRejectError('');
    onReject?.(request.id, rejectReason);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary-50 to-accent-50 dark:from-neutral-800 dark:to-neutral-800 px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-secondary-900 dark:text-white">Medicine Request</h2>
            <p className="text-sm text-secondary-600 dark:text-neutral-400">Request ID: #{request.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-secondary-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Patient Information */}
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
            <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-sm font-semibold text-secondary-900 dark:text-white uppercase tracking-wide">Patient Information</h3>
            </div>
            <div className="p-4 grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Name</p>
                <p className="text-sm font-semibold text-secondary-900 dark:text-white">{request.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Patient ID</p>
                <p className="text-sm font-semibold text-secondary-900 dark:text-white">{request.patientId}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Contact Number</p>
                <p className="text-sm font-semibold text-secondary-900 dark:text-white">{request.contactNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Status</p>
                <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                  request.status === 'Pending' ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400' :
                  request.status === 'Dispensed' ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400' :
                  'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400'
                }`}>
                  {request.status}
                </span>
              </div>
            </div>
          </div>

          {/* Medicine Details */}
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
            <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-sm font-semibold text-secondary-900 dark:text-white uppercase tracking-wide">Medicine Details</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-accent-50 dark:bg-accent-900/20 rounded-lg p-4 border-l-4 border-accent-500">
                <p className="text-lg font-bold text-secondary-900 dark:text-white mb-1">{request.medicineName || 'Paracetamol 500mg'}</p>
                <p className="text-sm text-secondary-600 dark:text-neutral-400">{request.medicineType || 'Tablet'}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Requested Quantity</p>
                  <p className="text-sm font-semibold text-secondary-900 dark:text-white">{request.requestedQuantity || '10'} {request.unit || 'tablets'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Stock Available</p>
                  <p className={`text-sm font-semibold ${
                    (request.stockAvailable || 50) > 20 ? 'text-success-600 dark:text-success-400' : 
                    (request.stockAvailable || 50) > 10 ? 'text-warning-600 dark:text-warning-400' : 
                    'text-error-600 dark:text-error-400'
                  }`}>
                    {request.stockAvailable || '50'} {request.unit || 'tablets'}
                  </p>
                </div>
              </div>

              {/* Reason for Request */}
              <div>
                <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Reason for Request</p>
                <p className="text-sm text-secondary-700 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-800/30 p-3 rounded-lg">
                  {request.reason || 'For headache relief'}
                </p>
              </div>

              {/* Prescription Details */}
              {request.prescribedBy && (
                <div className="bg-success-50 dark:bg-success-900/20 rounded-lg p-3">
                  <p className="text-xs font-medium text-success-700 dark:text-success-400 uppercase tracking-wider mb-1">Prescribed By</p>
                  <p className="text-sm font-semibold text-secondary-900 dark:text-white">{request.prescribedBy}</p>
                  {request.prescriptionDate && (
                    <p className="text-xs text-secondary-600 dark:text-neutral-400 mt-1">Date: {request.prescriptionDate}</p>
                  )}
                </div>
              )}

              {/* Request Timeline */}
              <div className="grid md:grid-cols-2 gap-4 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                <div>
                  <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Submitted On</p>
                  <p className="text-sm font-semibold text-secondary-900 dark:text-white">{request.submitted}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Priority</p>
                  <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                    request.priority === 'High' ? 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400' :
                    request.priority === 'Medium' ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400' :
                    'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400'
                  }`}>
                    {request.priority || 'Normal'}
                  </span>
                </div>
              </div>

              {/* Dispense Quantity Input (only for pending) */}
              {request.status === 'Pending' && !showRejectForm && (
                <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 border-l-4 border-primary-500">
                  <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-2">
                    Quantity to Dispense
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={request.stockAvailable || 50}
                    value={dispensedQuantity}
                    onChange={(e) => {
                      setDispensedQuantity(e.target.value);
                      if (quantityError) setQuantityError('');
                    }}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter quantity"
                  />
                  <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-1">
                    Maximum: {request.stockAvailable || 50} {request.unit || 'tablets'}
                  </p>
                  {quantityError && (
                    <p className="text-xs text-error-700 dark:text-error-400 mt-1">
                      {quantityError}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Reject Form */}
          {showRejectForm && (
            <div className="border border-error-200 dark:border-error-800 rounded-lg overflow-hidden bg-error-50 dark:bg-error-900/20">
              <div className="px-4 py-3 border-b border-error-200 dark:border-error-800">
                <h3 className="text-sm font-semibold text-error-900 dark:text-error-400">Reason for Rejection</h3>
              </div>
              <div className="p-4">
                <textarea
                  value={rejectReason}
                  onChange={(e) => {
                    setRejectReason(e.target.value);
                    if (rejectError) setRejectError('');
                  }}
                  rows={3}
                  placeholder="Please provide a reason for rejecting this medicine request..."
                  className="w-full px-3 py-2 text-sm border border-error-300 dark:border-error-700 rounded-lg bg-white dark:bg-neutral-800 text-secondary-900 dark:text-white focus:ring-2 focus:ring-error-500 focus:border-error-500"
                />
                {rejectError && (
                  <p className="mt-2 text-xs text-error-700 dark:text-error-400">
                    {rejectError}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-neutral-50 dark:bg-neutral-800/50 px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between gap-3">
          {showRejectForm ? (
            <>
              <button
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectReason('');
                  setRejectError('');
                }}
                className="px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 text-sm font-medium text-white bg-error-500 hover:bg-error-600 rounded-lg transition-colors"
              >
                Confirm Rejection
              </button>
            </>
          ) : request.status === 'Pending' ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors"
              >
                Close
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowRejectForm(true);
                    setRejectError('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-error-500 hover:bg-error-600 rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reject
                </button>
                <button
                  onClick={handleDispense}
                  className="px-4 py-2 text-sm font-medium text-white bg-success-500 hover:bg-success-600 rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Dispense Medicine
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={onClose}
              className="ml-auto px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicineRequestDetailsModal;
