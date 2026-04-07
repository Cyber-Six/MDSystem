import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, X } from 'lucide-react';

/**
 * ExpiryWarningBanner (Staff side)
 *
 * Shown above the message input when the active session expires within 24 hours.
 * Provides a countdown and an "Extend by 1 day" action.
 *
 * @param {Date|string} expiresAt     - Session expiry timestamp
 * @param {boolean}     isExtending   - True while the extension request is in-flight
 * @param {Function}    onExtend      - Called when user confirms extension
 */
const ExpiryWarningBanner = ({ expiresAt, isExtending, onExtend }) => {
  const [dismissed, setDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Reset dismiss state when expiresAt changes (after extension)
  useEffect(() => {
    setDismissed(false);
  }, [expiresAt]);

  // Countdown ticker – updates every 30 s
  useEffect(() => {
    function update() {
      if (!expiresAt) return;
      const ms = new Date(expiresAt).getTime() - Date.now();
      if (ms <= 0) { setTimeLeft('expired'); return; }
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setTimeLeft(h > 0 ? `${h}h ${m}m` : `${m}m`);
    }
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (!expiresAt || dismissed) return null;
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  if (msLeft <= 0 || msLeft > 24 * 3_600_000) return null;

  const handleConfirm = () => {
    setShowModal(false);
    onExtend();
  };

  return (
    <>
      {/* Banner */}
      <div className="mx-3 mb-2 flex items-center gap-2.5 px-3 py-2 rounded-lg
                      bg-amber-50 dark:bg-amber-900/20
                      border border-amber-200 dark:border-amber-800">
        <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <p className="flex-1 text-xs text-amber-800 dark:text-amber-300 leading-snug">
          <span className="font-semibold">Session expires in {timeLeft}.</span>{' '}
          Send a message or extend to keep this conversation active.
        </p>
        <button
          onClick={() => setShowModal(true)}
          disabled={isExtending}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold
                     bg-amber-500 hover:bg-amber-600 text-white
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isExtending
            ? <RefreshCw className="w-3 h-3 animate-spin" />
            : <RefreshCw className="w-3 h-3" />
          }
          {isExtending ? 'Extending…' : 'Extend'}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-0.5 rounded text-amber-500 dark:text-amber-400
                     hover:text-amber-700 dark:hover:text-amber-200 transition-colors"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Confirm modal */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50">
          <div
            className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 p-6 border-b border-neutral-200 dark:border-neutral-700">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 flex-shrink-0">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-secondary-900 dark:text-white">
                  Extend session?
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  This chat session expires in {timeLeft}.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Extending resets the inactivity timer. The session will remain
                active for <strong>3 more days</strong> from now, or until there is no activity
                from either side for 3 days.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors
                           text-neutral-700 dark:text-neutral-300
                           border border-neutral-300 dark:border-neutral-600
                           hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Not now
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors
                           bg-amber-500 hover:bg-amber-600 text-white"
              >
                Extend session
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ExpiryWarningBanner;
