import React from 'react';

export const Spinner = () => (
  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

export const STEP_LABELS = ['Select Type', 'Date & Session', 'Requirements', 'Review & Submit'];

export const DAY_INDEX = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

export const statusColor = (status) => {
  const map = {
    Pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
    Scheduled: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    InProgress: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300',
    Completed: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    Rejected: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    CancelledByPatient: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    CancelledByMedical: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    NoShow: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
    Expired: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300',
  };
  return map[status] || 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300';
};

export const CancelConfirmModal = ({ onConfirm, onClose, loading }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-sm p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Cancel Appointment</h3>
        </div>
        <button
          onClick={onClose}
          disabled={loading}
          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-all disabled:opacity-50"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
        Are you sure you want to cancel your appointment? This action cannot be undone.
      </p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 rounded-lg font-medium text-sm bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-all disabled:opacity-50"
        >
          Keep Appointment
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="px-4 py-2 rounded-lg font-medium text-sm bg-red-600 hover:bg-red-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading && <Spinner />}
          <span>{loading ? 'Cancelling...' : 'Yes, Cancel'}</span>
        </button>
      </div>
    </div>
  </div>
);

export const BackButton = ({ onClick }) => (
  <button onClick={onClick} className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all duration-200 bg-neutral-100 dark:bg-neutral-700 text-secondary-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-600">
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
    Back
  </button>
);
