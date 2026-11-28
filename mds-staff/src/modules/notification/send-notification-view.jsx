import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, ChevronDown, CircleAlert, CircleCheck, HeartPulse, LoaderCircle, Plus, Search, Send, Users, X } from 'lucide-react';
import {
  notifyStaffs, notifyPatients, fetchAllStaff, fetchPatientNotificationGroups, sendPatientGroupNotification,
} from './notification-service';
import { searchPatients, formatPatientName, getPatientYearLevelLabel } from '../../services/patient-search-service';
import { usePermissions } from '../../context/permissions-context';
import { useStaffProfile } from '../../hooks/use-staff-profile';

const MAX_TITLE_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 500;
const SEARCH_DEBOUNCE_MS = 500;

const audiences = [
  { value: 'staff', label: 'Staff', icon: Users },
  { value: 'patients', label: 'Patients', icon: HeartPulse },
];
const groupLabels = { Student: 'Students', Employee: 'Employees' };
const campusLabels = { Manila: 'Manila', QuezonCity: 'Quezon City', Both: 'Both campuses' };

const cardClass = 'min-w-0 rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800';
const mutedClass = 'text-neutral-600 dark:text-neutral-300';
const focusClass = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-900 dark:focus-visible:outline-primary-300';
const fieldClass = `w-full rounded-xl border border-neutral-400 bg-white px-3 py-2.5 text-[16px] text-neutral-900 placeholder:text-neutral-600 sm:text-sm dark:border-neutral-500 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-400 ${focusClass}`;
const labelClass = 'block text-sm font-semibold text-neutral-900 dark:text-white';

function useRecipientSearch(isStaff, query, branch, browseStaff) {
  const [staff, setStaff] = useState(null);
  const [staffError, setStaffError] = useState(false);
  const [patientSearch, setPatientSearch] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const shouldLoadStaff = isStaff && Boolean(query || browseStaff);

  useEffect(() => {
    if (!shouldLoadStaff || staff || staffError) return;

    let active = true;
    fetchAllStaff().then(
      (users) => { if (active) setStaff(users); },
      () => { if (active) setStaffError(true); },
    );

    return () => { active = false; };
  }, [shouldLoadStaff, staff, staffError]);

  useEffect(() => {
    if (isStaff || !query) return;

    let active = true;
    const timer = setTimeout(async () => {
      try {
        const users = await searchPatients(query, 20, branch, null, false);
        if (active) setPatientSearch({ query, branch, users });
      } catch {
        if (active) setPatientSearch({ query, branch, error: true });
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isStaff, query, branch, attempt]);

  const currentSearch = patientSearch?.query === query && patientSearch.branch === branch ? patientSearch : null;
  const staffQuery = query.toLowerCase();
  const matches = isStaff
    ? (staff ?? []).filter((user) => [user.name, user.email, user.role].some((value) => value?.toLowerCase().includes(staffQuery)))
    : currentSearch?.users ?? [];

  return {
    matches,
    loading: isStaff ? !staff && !staffError : Boolean(query && !currentSearch),
    error: isStaff ? staffError : Boolean(currentSearch?.error),
    resetPatientSearch: () => setPatientSearch(null),
    retry: () => {
      if (isStaff) {
        setStaffError(false);
      } else {
        setPatientSearch(null);
        setAttempt((previous) => previous + 1);
      }
    },
  };
}

function CharacterCount({ id, value, limit }) {
  return (
    <span id={id} className={`shrink-0 text-xs tabular-nums ${value.length === limit ? 'font-semibold text-primary-950 dark:text-primary-300' : mutedClass}`}>
      {value.length}/{limit}<span className="sr-only"> characters used</span>
    </span>
  );
}

function SendResult({ result }) {
  const isError = result?.type === 'error';
  const counts = result?.details?.deliveryCounts;
  const hasUnconfirmed = counts?.unconfirmed > 0;
  return (
    <div aria-live="polite" aria-atomic="true">
      {result && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${isError
          ? 'border-error-200 bg-error-50 text-error-900 dark:border-error-800 dark:bg-error-900/30 dark:text-error-200'
          : hasUnconfirmed
            ? 'border-warning-200 bg-warning-50 text-warning-900 dark:border-warning-800 dark:bg-warning-900/30 dark:text-warning-200'
            : 'border-success-200 bg-success-50 text-success-900 dark:border-success-800 dark:bg-success-900/30 dark:text-success-200'}`}>
          {isError || hasUnconfirmed
            ? <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            : <CircleCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />}
          <div className="min-w-0 break-words">
            <p className="mb-0 font-semibold">{result.text}</p>
            {!isError && (
              <p className="mb-0 mt-1">
                {counts?.delivered ?? result.details.delivery?.delivered?.length ?? 0} delivered immediately · {counts?.queued ?? result.details.delivery?.queued?.length ?? 0} queued
                {counts?.suppressed > 0 && ` · ${counts.suppressed} opted out`}
                {hasUnconfirmed && ` · ${counts.unconfirmed} unconfirmed`}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SendNotificationView() {
  const { isAdmin } = usePermissions();
  const { profile } = useStaffProfile();
  const [selectedAudience, setSelectedAudience] = useState(isAdmin ? 'staff' : 'patients');
  const [selected, setSelected] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [browseStaff, setBrowseStaff] = useState(false);
  const [recipientMode, setRecipientMode] = useState('individual');
  const [groupOptions, setGroupOptions] = useState(null);
  const [groupAttempt, setGroupAttempt] = useState(0);
  const [groupProfile, setGroupProfile] = useState('');
  const [groupCampus, setGroupCampus] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState(null);
  const searchInput = useRef(null);
  const sending = useRef(false);

  const isStaff = isAdmin && selectedAudience === 'staff';
  const isGroup = !isStaff && recipientMode === 'group';
  const audience = isStaff ? 'Staff' : 'Patients';
  const groupBranches = groupOptions?.data?.branches;
  const groupBranch = groupBranches?.includes(groupCampus) ? groupCampus
    : !groupCampus && groupBranches?.length === 1 ? groupBranches[0] : '';
  const group = groupOptions?.data?.groups?.find(option => option.profile === groupProfile && option.branch === groupBranch);
  const query = isGroup ? '' : searchTerm.trim();
  const branch = profile?.branch || null;
  const { matches, loading, error, resetPatientSearch, retry } = useRecipientSearch(isStaff, query, branch, browseStaff);
  const activeRecipients = selected.filter((recipient) => recipient.audience === audience);
  const selectedIds = new Set(activeRecipients.map((recipient) => recipient.id));
  const available = matches.filter((user) => !selectedIds.has(String(user.id)));
  const showResults = Boolean(query || (isStaff && browseStaff));
  const recipientCount = isGroup ? group?.count ?? 0 : activeRecipients.length;
  const hasMessage = Boolean(title.trim() && message.trim());
  const canSend = recipientCount > 0 && hasMessage && !isSending;

  useEffect(() => {
    if (!isGroup) return;

    let active = true;
    fetchPatientNotificationGroups().then(
      (data) => { if (active) setGroupOptions({ data }); },
      (err) => {
        if (active) setGroupOptions({ error: err?.response?.status === 403 ? 'forbidden' : 'unavailable' });
      },
    );
    return () => { active = false; };
  }, [isGroup, groupAttempt]);

  const reloadGroups = () => {
    setGroupOptions(null);
    setGroupAttempt(previous => previous + 1);
  };

  const changeRecipientMode = (mode) => {
    setRecipientMode(mode);
    setGroupOptions(null);
    setResult(null);
  };

  const updateSearch = (value) => {
    if (value.trim() !== query) resetPatientSearch();
    setSearchTerm(value);
  };

  const changeAudience = (value) => {
    setSelectedAudience(value);
    changeRecipientMode('individual');
    setGroupProfile('');
    setGroupCampus('');
    setSelected([]);
    updateSearch('');
    setBrowseStaff(false);
  };

  const addRecipient = (user) => {
    const id = String(user.id);
    const label = isStaff ? user.name : formatPatientName(user);
    setSelected((previous) => previous.some((recipient) => recipient.id === id && recipient.audience === audience)
      ? previous
      : [...previous, { id, label, audience }]);
    searchInput.current?.focus();
  };

  const removeRecipient = (id) => {
    setSelected((previous) => previous.filter((recipient) => recipient.id !== id || recipient.audience !== audience));
    searchInput.current?.focus();
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if (!canSend || sending.current) return;

    sending.current = true;
    setIsSending(true);
    setResult(null);
    try {
      const recipientIds = activeRecipients.map((recipient) => recipient.id);
      const payload = JSON.stringify({ title: title.trim(), body: message.trim() });
      const send = isStaff ? notifyStaffs : notifyPatients;
      const data = isGroup ? await sendPatientGroupNotification(payload, group) : await send(payload, recipientIds);
      if (data.totalRecipients === 0) {
        setResult({ type: 'error', text: 'No selected recipients were eligible. Check your recipient list and try again.' });
        return;
      }
      const label = isStaff ? 'staff member' : 'patient';
      const plural = data.totalRecipients !== 1 ? 's' : '';
      setResult({
        type: 'success',
        text: isGroup
          ? `Group notification processed for ${data.totalRecipients.toLocaleString()} ${group.profile.toLowerCase()}${plural}.`
          : `Notification sent to ${data.totalRecipients} ${label}${plural}.`,
        details: data,
      });
      setTitle('');
      setMessage('');
      setSelected([]);
      updateSearch('');
      setBrowseStaff(false);
      if (isGroup) {
        setGroupProfile('');
        setGroupCampus('');
        reloadGroups();
      }
    } catch (err) {
      const status = err?.response?.status;
      let text = 'Failed to send notification. Please try again.';
      if (isGroup && status === 409) {
        text = 'The recipient count changed. Review the updated group before sending.';
        reloadGroups();
      } else if (status === 403) {
        text = 'You do not have permission to send notifications to this group.';
        if (isGroup) {
          setGroupProfile('');
          setGroupCampus('');
          reloadGroups();
        }
      } else if (status === 400) text = err?.response?.data?.message ?? 'Invalid request.';
      else if (isGroup && !status) text = 'Could not confirm the send. Check delivery before sending again.';
      else if (err?.message) text = err.message;
      setResult({ type: 'error', text });
    } finally {
      sending.current = false;
      setIsSending(false);
    }
  };

  // Enter in a single-line input should not send a notification.
  const preventImplicitSend = (event) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.preventDefault();
  };

  let searchStatus = isStaff ? 'Search by name, email, or role.' : 'Search by name or patient ID.';
  if (showResults) {
    if (loading) searchStatus = isStaff ? 'Loading staff…' : 'Searching patients…';
    else if (error) searchStatus = isStaff ? 'Could not load the staff list.' : 'Could not search for patients.';
    else if (available.length) searchStatus = `${available.length} ${available.length === 1 ? 'match' : 'matches'} available to add.`;
    else if (matches.length) searchStatus = 'All matching recipients are already selected.';
    else searchStatus = query ? 'No matches. Try a different search.' : 'No staff are available to select.';
  }

  return (
    <div className="mx-auto w-full max-w-5xl pb-6 pt-1 sm:pt-3">
      <header className="mb-6 flex items-start gap-3 sm:mb-8 sm:gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-100 text-primary-950 dark:bg-primary-500/15 dark:text-primary-300 sm:h-12 sm:w-12">
          <Send aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="mb-0 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">Send Notification</h1>
          <p className={`mb-0 mt-1 text-sm leading-relaxed ${mutedClass}`}>Send a notification to individuals or a patient group.</p>
        </div>
      </header>

      <form onSubmit={handleSend} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.57fr)] lg:gap-6">
        <fieldset disabled={isSending} className={cardClass}>
          <legend className="sr-only">Notification details</legend>
          <section aria-labelledby="notification-audience" className="p-4 sm:p-6">
            <h2 id="notification-audience" className="mb-0 text-lg font-semibold text-neutral-900 dark:text-white">Recipients</h2>
            {isAdmin && (
              <fieldset className="mt-4 min-w-0">
                <legend className={labelClass}>Audience</legend>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:gap-3">
                  {audiences.map(({ value, label, icon: Icon }) => (
                    <label key={value} className="relative min-w-0 cursor-pointer">
                      <input
                        type="radio"
                        name="notification-audience"
                        value={value}
                        checked={selectedAudience === value}
                        onChange={() => changeAudience(value)}
                        className="peer sr-only"
                      />
                      <span className="flex min-h-11 items-center gap-1.5 rounded-xl border border-neutral-300 px-2 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 peer-checked:border-primary-700 peer-checked:bg-primary-50 peer-checked:text-primary-950 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-900 peer-disabled:cursor-not-allowed sm:gap-2 sm:px-3 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:peer-checked:border-primary-500/70 dark:peer-checked:bg-primary-500/10 dark:peer-checked:text-primary-200 dark:peer-focus-visible:outline-primary-300">
                        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                        {label}
                        {selectedAudience === value && <Check aria-hidden="true" className="ml-auto h-4 w-4 shrink-0" />}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {!isStaff && (
              <fieldset className="mt-4 min-w-0">
                <legend className={labelClass}>Send to</legend>
                <div className={`mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm ${mutedClass}`}>
                  {[['individual', 'Individuals'], ['group', 'Patient group']].map(([value, label]) => (
                    <label key={value} className="inline-flex min-h-9 cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="notification-recipient-mode"
                        checked={recipientMode === value}
                        onChange={() => changeRecipientMode(value)}
                        className={`h-4 w-4 accent-primary-700 dark:accent-primary-400 ${focusClass}`}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {isGroup ? (
              <div className="mt-4">
                {groupBranches && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="notification-group" className={labelClass}>Patient group</label>
                      <select
                        id="notification-group"
                        value={groupProfile}
                        onChange={event => { setGroupProfile(event.target.value); setResult(null); }}
                        className={`mt-2 ${fieldClass}`}
                      >
                        <option value="">Choose a group</option>
                        {Object.entries(groupLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="notification-campus" className={labelClass}>Campus</label>
                      <select
                        id="notification-campus"
                        value={groupBranch}
                        onChange={event => { setGroupCampus(event.target.value); setResult(null); }}
                        className={`mt-2 ${fieldClass}`}
                      >
                        {(groupBranches.length > 1 || !groupBranch) && <option value="">Choose a campus</option>}
                        {groupBranches.map(value => <option key={value} value={value}>{campusLabels[value]}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                <p role="status" className={`mb-0 mt-2 text-sm ${mutedClass}`}>
                  {!groupOptions && 'Loading patient groups…'}
                  {groupOptions?.error === 'forbidden' && 'Your role does not allow patient group notifications.'}
                  {groupOptions?.error === 'unavailable' && 'Could not load patient groups.'}
                  {groupBranches && 'Campus options follow your notification permission in Role Management.'}
                </p>
                {groupOptions?.error === 'unavailable' && (
                  <button type="button" onClick={reloadGroups} className={`mt-1 min-h-9 rounded-md px-1 text-sm font-semibold text-primary-950 underline dark:text-primary-300 ${focusClass}`}>Try again</button>
                )}
              </div>
            ) : (
              <div className="mt-4">
                <div className="mb-2 flex min-h-6 flex-wrap items-center justify-between gap-x-2">
                  <label htmlFor="notification-search" className={labelClass}>Find {isStaff ? 'staff' : 'patients'}</label>
                  {isStaff && !query && (
                    <button type="button" aria-expanded={browseStaff} aria-controls="notification-search-results" onClick={() => setBrowseStaff(!browseStaff)} className={`inline-flex min-h-8 items-center gap-1 rounded-md px-1 text-sm font-semibold text-primary-950 hover:underline dark:text-primary-300 ${focusClass}`}>
                      {browseStaff ? 'Hide staff list' : 'Browse staff'} <ChevronDown aria-hidden="true" className={`h-4 w-4 ${browseStaff ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600 dark:text-neutral-400" />
                  <input
                    ref={searchInput}
                    id="notification-search"
                    type="search"
                    autoComplete="off"
                    value={searchTerm}
                    onChange={(event) => updateSearch(event.target.value)}
                    onKeyDown={preventImplicitSend}
                    aria-describedby="notification-search-status"
                    placeholder={isStaff ? 'Search staff' : 'Search patients'}
                    className={`${fieldClass} pl-9`}
                  />
                </div>

                <div id="notification-search-results" className="mt-2">
                  <p id="notification-search-status" role="status" className={`mb-0 text-sm ${mutedClass}`}>{searchStatus}</p>
                  {showResults && error && (
                    <button type="button" onClick={() => { retry(); searchInput.current?.focus(); }} className={`mt-1 min-h-9 rounded-md px-1 text-sm font-semibold text-primary-950 underline dark:text-primary-300 ${focusClass}`}>
                      Try again
                    </button>
                  )}
                  {showResults && !loading && !error && available.length > 0 && (
                    <ul aria-label="Matching recipients" className="mt-2 max-h-56 divide-y divide-neutral-200 overflow-y-auto rounded-xl border border-neutral-200 dark:divide-neutral-700 dark:border-neutral-700">
                      {available.map((user) => {
                        const name = isStaff ? user.name : formatPatientName(user);
                        const details = isStaff ? [user.role, user.branch, user.email] : [user.identifier, getPatientYearLevelLabel(user), user.branch];
                        return (
                          <li key={user.id}>
                            <button
                              type="button"
                              onClick={() => addRecipient(user)}
                              aria-label={`Add ${name}`}
                              aria-describedby={`notification-recipient-${user.id}`}
                              className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-900 dark:hover:bg-neutral-700 dark:focus-visible:outline-primary-300"
                            >
                              <span className="min-w-0 break-words">
                                <span className="block text-sm font-semibold text-neutral-900 dark:text-white">{name}</span>
                                <span id={`notification-recipient-${user.id}`} className={`block text-xs leading-relaxed ${mutedClass}`}>{details.filter(Boolean).join(' · ')}</span>
                              </span>
                              <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-950 dark:text-primary-300">
                                <Plus aria-hidden="true" className="h-4 w-4" /> Add
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {!isGroup && recipientCount > 0 && (
              <ul aria-label="Selected recipients" className="mt-4 flex flex-wrap gap-2">
                {activeRecipients.map(({ id, label }) => (
                  <li key={id} className="inline-flex max-w-full items-center gap-1 rounded-xl border border-primary-200 bg-primary-50 pl-3 text-sm text-primary-950 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-200">
                    <span className="min-w-0 break-words py-1">{label}</span>
                    <button type="button" onClick={() => removeRecipient(id)} aria-label={`Remove ${label}`} className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl hover:bg-primary-100 dark:hover:bg-primary-500/20 ${focusClass}`}>
                      <X aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="notification-content" className="space-y-4 border-t border-neutral-200 p-4 dark:border-neutral-700 sm:p-6">
            <h2 id="notification-content" className="mb-0 text-lg font-semibold text-neutral-900 dark:text-white">Compose message</h2>
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <label htmlFor="notification-title" className={labelClass}>Title</label>
                <CharacterCount id="notification-title-count" value={title} limit={MAX_TITLE_LENGTH} />
              </div>
              <input
                id="notification-title"
                type="text"
                autoComplete="off"
                required
                maxLength={MAX_TITLE_LENGTH}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={preventImplicitSend}
                aria-describedby="notification-title-count"
                placeholder="Enter a short title"
                className={fieldClass}
              />
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <label htmlFor="notification-message" className={labelClass}>Message</label>
                <CharacterCount id="notification-message-count" value={message} limit={MAX_MESSAGE_LENGTH} />
              </div>
              <textarea
                id="notification-message"
                required
                maxLength={MAX_MESSAGE_LENGTH}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                aria-describedby="notification-message-count"
                placeholder="Write your notification"
                rows={5}
                className={`${fieldClass} block resize-y`}
              />
            </div>
          </section>
        </fieldset>

        <div className="min-w-0 space-y-4">
          <section aria-labelledby="notification-preview" className={cardClass}>
            <div className="p-4 sm:p-5">
              <h2 id="notification-preview" className="mb-0 text-lg font-semibold text-neutral-900 dark:text-white">Notification preview</h2>
              <div className="mt-4 flex min-h-28 items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900 sm:p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-100 text-primary-950 dark:bg-primary-500/15 dark:text-primary-300">
                  <Bell aria-hidden="true" className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  <p className={`mb-0 text-sm font-semibold ${title.trim() ? 'text-neutral-900 dark:text-white' : mutedClass}`}>{title.trim() || 'Your notification title'}</p>
                  <p className={`mb-0 mt-1 whitespace-pre-wrap text-sm leading-relaxed ${mutedClass}`}>{message.trim() || 'Your message appears here as you type.'}</p>
                </div>
              </div>
            </div>
            <div className="border-t border-neutral-200 p-4 dark:border-neutral-700 sm:p-5">
              <dl className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <dt className={mutedClass}>{isGroup && group ? `${groupLabels[group.profile]} · ${campusLabels[group.branch]}` : audience}</dt>
                <dd className="font-semibold tabular-nums text-neutral-900 dark:text-white">
                  <span role="status">
                    {isGroup
                      ? group && `${recipientCount.toLocaleString()} eligible ${recipientCount === 1 ? 'recipient' : 'recipients'}`
                      : `${recipientCount} ${recipientCount === 1 ? 'recipient' : 'recipients'} selected`}
                  </span>
                </dd>
              </dl>
              <button
                type="submit"
                disabled={!canSend}
                className={`mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-primary-400 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-600 disabled:opacity-100 dark:disabled:bg-neutral-700 dark:disabled:text-neutral-300 ${focusClass}`}
              >
                {isSending
                  ? <><LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" /> Sending…</>
                  : <><Send aria-hidden="true" className="h-4 w-4" /> {isGroup && recipientCount > 0 ? `Send to ${recipientCount.toLocaleString()}` : 'Send notification'}</>}
              </button>
              {!canSend && !isSending && (!isGroup || groupBranches) && (
                <p className={`mb-0 mt-2 text-sm ${mutedClass}`}>
                  {isGroup && recipientCount === 0
                    ? group ? 'This group has no eligible recipients.' : 'Choose a group and campus.'
                    : recipientCount === 0 ? 'Select at least one recipient.' : 'Enter a title and message to send.'}
                </p>
              )}
            </div>
          </section>
          <SendResult result={result} />
        </div>
      </form>
    </div>
  );
}
