import React, { useState } from 'react';
import { Spinner, statusColor, CancelConfirmModal } from './shared';
import { SESSION } from '../patient-appointment-service';

const ActiveAppointmentCard = ({ appointment, onCancel, cancelling }) => {
  const [showModal, setShowModal] = useState(false);

  const handleConfirm = async () => {
    await onCancel();
    setShowModal(false);
  };

  if (!appointment) return null;

  const { status, session, created_at, notes } = appointment;

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">Your Current Appointment</h2>

      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">Status:</span>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(status)}`}>
            {status}
          </span>
        </div>

        {session && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Session:</span>
            <span className="text-sm font-medium text-neutral-900 dark:text-white">
              {session === SESSION.MORNING ? 'Morning (8:00 AM - 12:00 PM)' : 'Afternoon (1:00 PM - 5:00 PM)'}
            </span>
          </div>
        )}

        {created_at && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Submitted:</span>
            <span className="text-sm font-medium text-neutral-900 dark:text-white">
              {new Date(created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        )}

        {notes && (
          <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700">
            <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Notes:</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{notes}</p>
          </div>
        )}
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-4">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          You currently have an active appointment. You cannot book another one until this is completed or cancelled.
        </p>
      </div>

      <button
        onClick={() => setShowModal(true)}
        disabled={cancelling}
        className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
      >
        {cancelling && <Spinner />}
        <span>{cancelling ? 'Cancelling...' : 'Cancel Appointment'}</span>
      </button>

      {showModal && (
        <CancelConfirmModal
          onConfirm={handleConfirm}
          onClose={() => setShowModal(false)}
          loading={cancelling}
        />
      )}
    </div>
  );
};

export default ActiveAppointmentCard;
