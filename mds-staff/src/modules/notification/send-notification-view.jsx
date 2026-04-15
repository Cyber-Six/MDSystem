import React, { useState, useEffect, useCallback, useRef } from 'react';
import { notifyStaffs, notifyPatients, fetchAllStaff } from './notification-service';
import { searchPatients, formatPatientName } from '../../services/patient-search-service';
import { usePermissions } from '../../context/permissions-context';
import { useStaffProfile } from '../../hooks/use-staff-profile';

const MAX_MESSAGE_LENGTH = 500;
const MAX_TITLE_LENGTH = 80;
const SEARCH_DEBOUNCE_MS = 500;

/**
 * Send Notification View — multicast support
 *
 * Role-based behaviour:
 *   Admin  → can notify Staff OR Patients; notifyAll or select specific recipients.
 *   Staff  → can only notify Patients; notifyAll or select specific patients.
 *   Patient → cannot access this view (guarded at router level).
 *
 * Recipient data sources:
 *   Staff  → /rolemanagement/admin GraphQL `listStaffAccounts` (admin only, loaded once)
 *   Patient→ /emr/medical GraphQL `searchPatients` (debounced live search)
 *
 * Branch filtering is enforced server-side; the UI shows whatever the GraphQL
 * endpoints return to the current user.
 */
const SendNotificationView = () => {
  const { isAdmin } = usePermissions();
  const { profile } = useStaffProfile();

  // ── Recipient type (staff | patients) ──────────────────────────────────────
  const [recipientType, setRecipientType] = useState(isAdmin ? 'staff' : 'patients');

  // ── Message ─────────────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  // ── Selected recipients: [{id, label}] ──────────────────────────────────────
  const [selected, setSelected] = useState([]);

  // ── Search state ─────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // ── Staff roster (admin only, loaded when staff tab + select mode opens) ─────
  const [allStaff, setAllStaff] = useState(null);   // null = not yet loaded
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [staffError, setStaffError] = useState(null);

  // ── Send state ───────────────────────────────────────────────────────────────
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState(null); // {type:'success'|'error', text, details?}

  const debounceRef = useRef(null);
  const searchInputRef = useRef(null);

  // ── Load staff roster ────────────────────────────────────────────────────────
  const loadAllStaff = useCallback(async () => {
    if (allStaff !== null || isLoadingStaff) return;
    setIsLoadingStaff(true);
    setStaffError(null);
    try {
      const staff = await fetchAllStaff();
      setAllStaff(staff);
    } catch (err) {
      setStaffError('Failed to load staff list. Please try again.');
      setAllStaff([]);
    } finally {
      setIsLoadingStaff(false);
    }
  }, [allStaff, isLoadingStaff]);

  // Trigger staff load when staff tab is active
  useEffect(() => {
    if (recipientType === 'staff') {
      loadAllStaff();
    }
  }, [recipientType, loadAllStaff]);

  // ── Search logic ─────────────────────────────────────────────────────────────

  // Staff: filter loaded roster client-side
  useEffect(() => {
    if (recipientType !== 'staff' || !allStaff) return;
    if (!searchTerm.trim()) {
      setSearchResults(allStaff);
      return;
    }
    const q = searchTerm.toLowerCase();
    setSearchResults(
      allStaff.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.role?.toLowerCase().includes(q)
      )
    );
  }, [searchTerm, allStaff, recipientType]);

  // Patients: debounced live search
  useEffect(() => {
    if (recipientType !== 'patients') return;

    clearTimeout(debounceRef.current);

    if (!searchTerm.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchPatients(searchTerm, 20, profile?.branch || null, null, false);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [searchTerm, recipientType, profile?.branch]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleRecipientType = (type) => {
    setRecipientType(type);
    setSelected([]);
    setSearchTerm('');
    setSearchResults([]);
    setResult(null);
  };

  const addRecipient = (user) => {
    const id = String(user.id);
    if (selected.find(r => r.id === id)) return;
    const label =
      recipientType === 'staff'
        ? user.name
        : formatPatientName(user);
    setSelected(prev => [...prev, { id, label }]);
  };

  const removeRecipient = (id) => {
    setSelected(prev => prev.filter(r => r.id !== id));
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedMessage = message.trim();
    if (!trimmedTitle || !trimmedMessage) return;
    if (selected.length === 0) return;

    setIsSending(true);
    setResult(null);

    try {
      const recipientIds = selected.map(r => r.id);
      const payload = JSON.stringify({ title: trimmedTitle, body: trimmedMessage });
      let data;
      if (recipientType === 'staff') {
        data = await notifyStaffs(payload, recipientIds);
      } else {
        data = await notifyPatients(payload, recipientIds);
      }

      const label = recipientType === 'staff' ? 'staff member' : 'patient';
      const plural = data.totalRecipients !== 1 ? 's' : '';
      setResult({
        type: 'success',
        text: `Notification sent to ${data.totalRecipients} ${label}${plural}.`,
        details: data,
      });
      setTitle('');
      setMessage('');
      setSelected([]);
      setSearchTerm('');
      setSearchResults([]);
    } catch (err) {
      const status = err?.response?.status;
      let text = 'Failed to send notification. Please try again.';
      if (status === 403) text = 'You do not have permission to send notifications to this group.';
      else if (status === 400) text = err?.response?.data?.message ?? 'Invalid request.';
      else if (err?.message) text = err.message;
      setResult({ type: 'error', text });
    } finally {
      setIsSending(false);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const charsLeft = MAX_MESSAGE_LENGTH - message.length;
  const canSend =
    title.trim().length > 0 &&
    message.trim().length > 0 &&
    !isSending &&
    selected.length > 0;

  // Results excluding already-selected recipients
  const filteredResults = searchResults.filter(
    r => !selected.find(s => s.id === String(r.id))
  );
  const titleCharsLeft = MAX_TITLE_LENGTH - title.length;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Page header — consistent with other module headers */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-secondary-800 dark:text-white leading-none m-0">Send Notification</h1>
          <p className="text-[11px] text-secondary-500 dark:text-neutral-400 mt-0.5">Broadcast a message to staff or patients.</p>
        </div>
      </div>

      <form
        onSubmit={handleSend}
        className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-sm p-4 space-y-4"
      >
        {/* ── Recipient type (admin only) ────────────────────────────────── */}
        {isAdmin && (
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-secondary-500 dark:text-neutral-400 mb-1.5">
              Notify group
            </label>
            <div className="flex gap-2">
              {[
                { value: 'staff', label: 'Staff' },
                { value: 'patients', label: 'Patients' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleRecipientType(opt.value)}
                  className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                    recipientType === opt.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Recipients ────────────────────────────────────────────────── */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-secondary-500 dark:text-neutral-400 mb-1.5">
            Recipients
          </label>

          {/* ── Select recipients panel ──────────────────────────────────── */}
          <div className="space-y-2">
              {/* Search input */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder={
                    recipientType === 'staff'
                      ? 'Search staff by name, email, or role…'
                      : 'Search patients by name or ID…'
                  }
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  autoComplete="off"
                />
                {(isSearching || isLoadingStaff) && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="w-4 h-4 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  </span>
                )}
              </div>

              {/* Staff load error */}
              {staffError && (
                <p className="text-xs text-red-500 dark:text-red-400">{staffError}</p>
              )}

              {/* Search results */}
              {filteredResults.length > 0 && (
                <ul className="max-h-40 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-600 divide-y divide-neutral-100 dark:divide-neutral-700">
                  {filteredResults.map(user => (
                    <li
                      key={user.id}
                      className="flex items-center justify-between px-3 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-700 cursor-pointer"
                      onClick={() => addRecipient(user)}
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <p className="text-sm font-medium text-secondary-800 dark:text-white truncate leading-none m-0">
                          {recipientType === 'staff' ? user.name : formatPatientName(user)}
                        </p>
                        <p className="text-xs text-secondary-400 dark:text-neutral-500 truncate leading-none m-0">
                          {recipientType === 'staff'
                            ? [user.role, user.branch].filter(Boolean).join(' · ')
                            : [user.identifier, user.branch].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <span className="ml-3 shrink-0 text-primary-500 text-xs font-semibold">Add</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Empty state */}
              {searchTerm.trim() &&
                !isSearching &&
                !isLoadingStaff &&
                filteredResults.length === 0 && (
                  <p className="text-xs text-secondary-400 dark:text-neutral-500 py-1">
                    No results found.
                  </p>
                )}

              {/* Selected chips */}
              {selected.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-secondary-500 dark:text-neutral-400 mb-1.5">
                    Selected ({selected.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.map(r => (
                      <span
                        key={r.id}
                        className="flex items-center gap-1 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 rounded-full text-[11px] font-medium"
                      >
                        {r.label}
                        <button
                          type="button"
                          onClick={() => removeRecipient(r.id)}
                          className="ml-0.5 hover:text-primary-600 dark:hover:text-primary-200 transition-colors"
                          aria-label={`Remove ${r.label}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Hint when no recipients selected yet */}
              {selected.length === 0 && !searchTerm && (
                <p className="text-xs text-secondary-400 dark:text-neutral-500">
                  Search and select at least one recipient to send.
                </p>
              )}
          </div>
        </div>

        {/* ── Title ─────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="notification-title"
              className="block text-[10px] font-semibold uppercase tracking-widest text-secondary-500 dark:text-neutral-400"
            >
              Title
            </label>
            <span className={`text-xs ${
              titleCharsLeft < 20
                ? 'text-red-500 dark:text-red-400'
                : 'text-secondary-400 dark:text-neutral-500'
            }`}>
              {titleCharsLeft}/{MAX_TITLE_LENGTH}
            </span>
          </div>
          <input
            id="notification-title"
            type="text"
            value={title}
            onChange={e => { if (e.target.value.length <= MAX_TITLE_LENGTH) setTitle(e.target.value); }}
            placeholder="Short notification title…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            autoComplete="off"
          />
        </div>

        {/* ── Message ───────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="notification-message"
              className="block text-[10px] font-semibold uppercase tracking-widest text-secondary-500 dark:text-neutral-400"
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
              {charsLeft}/{MAX_MESSAGE_LENGTH}
            </span>
          </div>
          <textarea
            id="notification-message"
            value={message}
            onChange={e => {
              if (e.target.value.length <= MAX_MESSAGE_LENGTH) setMessage(e.target.value);
            }}
            rows={3}
            placeholder="Write your notification message…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          />
        </div>

        {/* ── Result feedback ───────────────────────────────────────────── */}
        {result && (
          <div
            className={`rounded-lg px-3 py-2 text-xs ${
              result.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700'
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-700'
            }`}
          >
            <p className="font-medium">{result.text}</p>
            {result.type === 'success' && result.details && (
              <p className="mt-1 text-xs opacity-75">
                Delivered immediately: {result.details.delivery?.delivered?.length ?? 0} ·{' '}
                Queued for next login: {result.details.delivery?.queued?.length ?? 0}
              </p>
            )}
          </div>
        )}

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!canSend}
            className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-600 text-white text-xs font-medium transition-colors disabled:cursor-not-allowed"
          >
            {isSending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Sending…
              </>
            ) : (
              'Send Notification'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SendNotificationView;
