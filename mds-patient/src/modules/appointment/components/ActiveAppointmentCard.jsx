import React, { useState } from 'react';
import { Spinner, statusColor, CancelConfirmModal } from './shared';

const ActiveAppointmentCard = ({ currentStatus, onCancel, cancelling }) => {
  const [showModal, setShowModal] = useState(false);

  const handleConfirm = async () => {
    await onCancel();
    setShowModal(false);
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">Your Current Appointment</h2>
      <div className="flex items-center space-x-3 mb-4">
        <span className="text-sm text-neutral-600 dark:text-neutral-400">Status:</span>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(currentStatus)}`}>
          {currentStatus}
        </span>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
        You currently have an active appointment. You cannot book another one until this is completed or cancelled.
      </p>
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
