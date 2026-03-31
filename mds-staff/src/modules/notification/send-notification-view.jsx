import React, { useState } from 'react';
import { notifyStaffs, notifyPatients } from './notification-service';
import { usePermissions } from '../../context/permissions-context';

const MAX_MESSAGE_LENGTH = 500;

/**
 * Send Notification View
 *
 * Allows staff/admin to broadcast notifications:
 *   - Admin: can choose to notify Staff OR Patients (all recipients)
 *   - Staff: can only notify Patients (all recipients in their branch)
 *
 * Note: Broadcasts to ALL recipients in the selected group.
 * The backend automatically filters recipients by user's branch/location.
 */
const SendNotificationView = () => {
  const { isAdmin } = usePermissions();

  const [recipientType, setRecipientType] = useState(isAdmin ? 'staff' : 'patients');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState(null); // { type: 'success'|'error', text: string, details?: object }

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;

    setIsSending(true);
    setResult(null);

    try {
      let data;
      if (recipientType === 'staff') {
        data = await notifyStaffs(trimmed);
      } else {
        data = await notifyPatients(trimmed);
      }

      const recipientLabel = recipientType === 'staff' ? 'staff member' : 'patient';
      const plural = data.totalRecipients !== 1 ? 's' : '';
      setResult({
        type: 'success',
        text: `Notification sent to ${data.totalRecipients} ${recipientLabel}${plural}.`,
        details: data,
      });
      setMessage('');
    } catch (err) {
      const status = err?.response?.status;
      let text = 'Failed to send notification. Please try again.';
      if (status === 403) {
        text = 'You do not have permission to send notifications to this group.';
      } else if (status === 400) {
        text = err?.response?.data?.message ?? 'Invalid request. Please check your message.';
      } else if (err?.message) {
        text = err.message;
      }
      setResult({ type: 'error', text });
    } finally {
      setIsSending(false);
    }
  };

  const charsLeft = MAX_MESSAGE_LENGTH - message.length;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-secondary-800 dark:text-white">
          Send Notification
        </h1>
        <p className="text-sm text-secondary-500 dark:text-neutral-400 mt-1">
          Broadcast a message to all {recipientType === 'staff' ? 'staff members' : 'patients in your branch'}.
        </p>
      </div>

      <form
        onSubmit={handleSend}
        className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-sm p-6 space-y-5"
      >
        {/* Recipient type selector — only show for admins */}
        {isAdmin && (
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-neutral-300 mb-3">
              Notify
            </label>
            <div className="flex gap-3 flex-wrap">
              {[
                { value: 'staff', label: 'Staff', icon: '👥' },
                { value: 'patients', label: 'Patients', icon: '🏥' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRecipientType(opt.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors font-medium ${
                    recipientType === opt.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-secondary-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-600'
                  }`}
                >
                  <span>{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="notification-message"
              className="block text-sm font-medium text-secondary-700 dark:text-neutral-300"
            >
              Message
            </label>
            <span
              className={`text-xs ${
                charsLeft < 50
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-secondary-400 dark:text-neutral-500'
              }`}
            >
              {charsLeft} left
            </span>
          </div>
          <textarea
            id="notification-message"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            rows={4}
            placeholder={
              recipientType === 'staff'
                ? 'Enter a message for all staff members…'
                : 'Enter a message for all patients in your branch…'
            }
            disabled={isSending}
            className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none disabled:opacity-50"
          />
        </div>

        {/* Feedback */}
        {result && (
          <div
            role="alert"
            className={`rounded-lg px-4 py-3 text-sm flex items-start gap-3 ${
              result.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-300'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-300'
            }`}
          >
            {result.type === 'success' ? (
              <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <div>
              <p>{result.text}</p>
              {result.type === 'success' && result.details && (
                <p className="mt-1 text-xs opacity-75">
                  Delivered: {result.details.delivery?.delivered?.length ?? 0} · Queued: {result.details.delivery?.queued?.length ?? 0}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSending || !message.trim()}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Sending…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send Notification
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SendNotificationView;
