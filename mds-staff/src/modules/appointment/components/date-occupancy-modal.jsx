import React, { useState } from 'react';
import { AlertTriangle, Trash2, Users, X } from 'lucide-react';

/**
 * DateOccupancyModal
 *
 * Shown when a staff member tries to disable or remove a custom date that still
 * has active (Pending / Scheduled / InProgress) appointments.
 *
 * Props:
 *  isOpen      – boolean
 *  onClose     – () => void
 *  date        – "YYYY-MM-DD" string
 *  count       – number of active appointments on that date
 *  actionLabel – short description of what the staff is trying to do
 *                e.g. "Disable this date" | "Remove this custom date"
 *  onKeep      – async () => void  — proceed but keep existing appointments
 *  onCancelAll – async () => void  — reject all existing appointments, then proceed
 */
const DateOccupancyModal = ({ isOpen, onClose, date, count, actionLabel, onKeep, onCancelAll }) => {
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('choice'); // 'choice' | 'confirm-cancel'

  if (!isOpen) return null;

  const dateLabel = (() => {
    if (!date) return '';
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  })();

  const handleKeep = async () => {
    setBusy(true);
    try {
      await onKeep();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleCancelAll = async () => {
    setBusy(true);
    try {
      await onCancelAll();
      onClose();
    } finally {
      setBusy(false);
      setPhase('choice');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                Date Has Active Appointments
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{dateLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Count badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <Users className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <span className="font-semibold">{count}</span> active appointment{count !== 1 ? 's' : ''} on this date still need to be processed.
            </p>
          </div>

          {phase === 'choice' ? (
            <>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                You are about to <span className="font-medium text-neutral-800 dark:text-neutral-200">{actionLabel.toLowerCase()}</span>.
                Choose how to handle the existing appointments:
              </p>

              {/* Option 1 — Keep */}
              <button
                onClick={handleKeep}
                disabled={busy}
                className="w-full text-left px-4 py-3 rounded-lg border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <p className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">
                  Keep existing appointments
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {actionLabel} for new bookings, but patients already booked can still be approved and attended.
                </p>
              </button>

              {/* Option 2 — Cancel all */}
              <button
                onClick={() => setPhase('confirm-cancel')}
                disabled={busy}
                className="w-full text-left px-4 py-3 rounded-lg border-2 border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 hover:border-rose-400 dark:hover:border-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <p className="font-semibold text-sm text-rose-800 dark:text-rose-300">
                  Cancel all & proceed
                </p>
                <p className="text-xs text-rose-700 dark:text-rose-400 mt-0.5">
                  Reject all {count} appointment{count !== 1 ? 's' : ''} with a "date unavailable" notice, then {actionLabel.toLowerCase()}.
                </p>
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                This will <span className="font-semibold text-rose-600 dark:text-rose-400">reject all {count} active appointment{count !== 1 ? 's' : ''}</span> with the following message sent to patients:
              </p>
              <div className="px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                <p className="text-xs text-neutral-600 dark:text-neutral-400 italic">
                  "This appointment date is no longer available. We apologize for the inconvenience. Please rebook at your earliest convenience."
                </p>
              </div>
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                This action cannot be undone.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setPhase('choice')}
                  disabled={busy}
                  className="flex-1 px-3 py-2 text-sm font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleCancelAll}
                  disabled={busy}
                  className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {busy ? (
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {busy ? 'Cancelling…' : 'Confirm & Cancel All'}
                </button>
              </div>
            </>
          )}

          {phase === 'choice' && (
            <button
              onClick={onClose}
              disabled={busy}
              className="w-full px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors disabled:opacity-50"
            >
              Cancel (do nothing)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DateOccupancyModal;
