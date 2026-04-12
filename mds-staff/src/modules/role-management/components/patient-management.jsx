import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchActiveRefreshTokenCount,
  fetchPatientBasicInfo,
  fetchUserSessions,
} from '../staff-service';

const PATIENT_SCAN_LIMIT = 100;
const PATIENT_PAGE_SIZE_OPTIONS = [10, 20, 50];
const SESSION_LIMIT_OPTIONS = [10, 20, 50];
const PATIENT_INITIAL_PAGE_SIZE = 10;
const SESSION_INITIAL_LIMIT = 10;
const PATIENT_INFO_BATCH_SIZE = 4;

const RATE_LIMIT_MESSAGE = 'Rate limit exceeded, please retry later';
const NETWORK_ERROR_MESSAGE = 'Unable to connect to server. Please check your connection.';

let PATIENT_MOUNT_FETCH_IN_FLIGHT = null;
let SESSIONS_MOUNT_FETCH_IN_FLIGHT = null;

const STATUS_DOT_CLASS = {
  active: 'bg-success-500',
  unverified: 'bg-warning-500',
  inactive: 'bg-neutral-400',
  suspended: 'bg-neutral-400',
  pending: 'bg-warning-500',
  locked: 'bg-error-500',
  expired: 'bg-error-500',
  unknown: 'bg-neutral-400',
};

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function toDateFromUnix(exp) {
  const numeric = Number(exp);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const millis = numeric > 1e12 ? numeric : numeric * 1000;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
  if (!value) return '--';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '--';

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function normalizeBranchLabel(branch) {
  const normalized = String(branch || '').trim();
  return normalized || '--';
}

function getStatusKey(rawStatus) {
  const normalized = normalizeText(rawStatus);
  if (normalized === 'active') return 'active';
  if (normalized === 'unverified') return 'unverified';
  if (normalized === 'inactive') return 'inactive';
  if (normalized === 'suspended') return 'suspended';
  if (normalized === 'pending') return 'pending';
  if (normalized === 'locked') return 'locked';
  if (normalized === 'expired') return 'expired';
  return 'unknown';
}

function formatStatusLabel(rawStatus) {
  const key = getStatusKey(rawStatus);
  if (key === 'unknown') return 'Unknown';
  if (key === 'unverified') return 'Unverified';
  if (key === 'inactive') return 'Inactive';
  if (key === 'suspended') return 'Suspended';
  if (key === 'pending') return 'Pending';
  if (key === 'locked') return 'Locked';
  if (key === 'expired') return 'Expired';
  return 'Active';
}

function formatPatientName(patientInfo, fallbackEmail, userId) {
  if (patientInfo) {
    const first = patientInfo.first_name || '';
    const middle = patientInfo.middle_name ? `${patientInfo.middle_name[0]}.` : '';
    const last = patientInfo.last_name || '';
    const suffix = patientInfo.suffix || '';
    const fullName = [first, middle, last, suffix].filter(Boolean).join(' ').trim();
    if (fullName) return fullName;
  }

  if (fallbackEmail) {
    const localPart = fallbackEmail.split('@')[0] || '';
    const pretty = localPart
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
    if (pretty) return pretty;
  }

  return `User ${userId}`;
}

function isRateLimitedError(error) {
  const status = Number(error?.status || error?.response?.status);
  const message = normalizeText(error?.message);
  return status === 429 || message.includes('429') || message.includes('rate limit');
}

function isConnectivityError(error) {
  const status = Number(error?.status || error?.response?.status);
  const code = normalizeText(error?.code);
  const message = normalizeText(error?.message);

  if (status === 902) return true;
  if (code === 'err_network') return true;
  if (!Number.isFinite(status) && (message.includes('network') || message.includes('connect'))) return true;
  return false;
}

function getSessionExpiryMs(session) {
  const expiry = toDateFromUnix(session?.exp);
  return expiry ? expiry.getTime() : 0;
}

function buildSessionId(baseSession, ordinal) {
  return `${baseSession?.userId || 'user'}-${ordinal}`;
}

async function mapInBatches(items, batchSize, mapper) {
  const output = [];

  for (let start = 0; start < items.length; start += batchSize) {
    const batch = items.slice(start, start + batchSize);
    const mappedBatch = await Promise.all(
      batch.map((item, index) => mapper(item, start + index))
    );
    output.push(...mappedBatch);
  }

  return output;
}

const PatientManagement = () => {
  const [activeTab, setActiveTab] = useState('patient-list');

  const [patientRows, setPatientRows] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientsError, setPatientsError] = useState(null);

  const [patientSearch, setPatientSearch] = useState('');
  const [patientBranchFilter, setPatientBranchFilter] = useState('all');
  const [patientStatusFilter, setPatientStatusFilter] = useState('all');
  const [patientPage, setPatientPage] = useState(1);
  const [patientPageSize, setPatientPageSize] = useState(PATIENT_INITIAL_PAGE_SIZE);

  const [tokenCount, setTokenCount] = useState(0);
  const [tokenCountLoading, setTokenCountLoading] = useState(false);
  const [tokenCountError, setTokenCountError] = useState(null);

  const [sessionRows, setSessionRows] = useState([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionOffset, setSessionOffset] = useState(0);
  const [sessionLimit, setSessionLimit] = useState(SESSION_INITIAL_LIMIT);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState(null);

  const [banner, setBanner] = useState(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const rateLimitedRef = useRef(false);

  const patientInfoCacheRef = useRef(new Map());
  const patientInfoInFlightRef = useRef(new Map());
  const loadTokenCountRef = useRef(null);
  const loadSessionsPageRef = useRef(null);

  const markRateLimited = useCallback(() => {
    rateLimitedRef.current = true;
    setIsRateLimited(true);
    setBanner({ type: 'rate-limit', message: RATE_LIMIT_MESSAGE });
    setPatientsError(RATE_LIMIT_MESSAGE);
    setTokenCountError(RATE_LIMIT_MESSAGE);
    setSessionsError(RATE_LIMIT_MESSAGE);
  }, []);

  const markNetworkError = useCallback(() => {
    if (rateLimitedRef.current) return;
    setBanner({ type: 'network', message: NETWORK_ERROR_MESSAGE });
  }, []);

  const getPatientInfo = useCallback(async (userId) => {
    const key = String(userId || '');
    if (!key) return null;

    if (patientInfoCacheRef.current.has(key)) {
      return patientInfoCacheRef.current.get(key);
    }

    if (patientInfoInFlightRef.current.has(key)) {
      return patientInfoInFlightRef.current.get(key);
    }

    const request = fetchPatientBasicInfo(key)
      .then((patientInfo) => {
        const normalized = patientInfo || null;
        patientInfoCacheRef.current.set(key, normalized);
        return normalized;
      })
      .finally(() => {
        patientInfoInFlightRef.current.delete(key);
      });

    patientInfoInFlightRef.current.set(key, request);
    return request;
  }, []);

  const loadPatientDirectory = useCallback(async () => {
    if (rateLimitedRef.current) return;

    setPatientsLoading(true);
    setPatientsError(null);

    try {
      setBanner(null);

      const allSessions = [];
      let offset = 0;
      let totalCount = 0;
      let safetyCounter = 0;

      do {
        const page = await fetchUserSessions(offset, PATIENT_SCAN_LIMIT);
        const pageSessions = Array.isArray(page.sessions) ? page.sessions : [];

        allSessions.push(...pageSessions);
        totalCount = Number(page.totalCount) || 0;
        offset += PATIENT_SCAN_LIMIT;
        safetyCounter += 1;

        if (pageSessions.length === 0) {
          break;
        }
      } while (offset < totalCount && safetyCounter < 50);

      const latestByUser = new Map();
      for (const session of allSessions) {
        if (!session?.userId) continue;

        const key = String(session.userId);
        const previous = latestByUser.get(key);
        const currentExpiry = getSessionExpiryMs(session);
        const previousExpiry = getSessionExpiryMs(previous);

        if (!previous || currentExpiry > previousExpiry) {
          latestByUser.set(key, session);
        }
      }

      const uniqueSessions = Array.from(latestByUser.values()).sort(
        (left, right) => getSessionExpiryMs(right) - getSessionExpiryMs(left)
      );

      const hydratedRows = await mapInBatches(
        uniqueSessions,
        PATIENT_INFO_BATCH_SIZE,
        async (session) => {
          let patientInfo = null;

          try {
            patientInfo = await getPatientInfo(session.userId);
          } catch (error) {
            if (isRateLimitedError(error) || isConnectivityError(error)) {
              throw error;
            }
            patientInfo = null;
          }

          const expDate = toDateFromUnix(session.exp);
          const derivedStatus = expDate && expDate.getTime() > Date.now() ? 'Active' : 'Expired';

          return {
            id: String(session.userId),
            patientName: formatPatientName(patientInfo, session.email, session.userId),
            email: session.email || '--',
            branch: normalizeBranchLabel(patientInfo?.branch),
            status: patientInfo?.credentials_status || derivedStatus,
            lastActive: patientInfo?.latest_updated_at || (expDate ? expDate.toISOString() : null),
          };
        }
      );

      setPatientRows(hydratedRows);
      setPatientPage(1);
    } catch (error) {
      if (isRateLimitedError(error)) {
        markRateLimited();
        return;
      }

      if (isConnectivityError(error)) {
        markNetworkError();
      }

      setPatientsError(error?.message || 'Failed to load patient list.');
      setPatientRows([]);
    } finally {
      setPatientsLoading(false);
    }
  }, [getPatientInfo, markNetworkError, markRateLimited]);

  const loadTokenCount = useCallback(async () => {
    if (rateLimitedRef.current) return;

    setTokenCountLoading(true);
    setTokenCountError(null);

    try {
      const count = await fetchActiveRefreshTokenCount();
      setTokenCount(Number(count) || 0);
    } catch (error) {
      if (isRateLimitedError(error)) {
        markRateLimited();
        return;
      }

      if (isConnectivityError(error)) {
        markNetworkError();
      }

      setTokenCountError(error?.message || 'Failed to load active token count.');
      setTokenCount(0);
    } finally {
      setTokenCountLoading(false);
    }
  }, [markNetworkError, markRateLimited]);

  const loadSessionsPage = useCallback(async (nextOffset, nextLimit) => {
    if (rateLimitedRef.current) return;

    setSessionsLoading(true);
    setSessionsError(null);

    try {
      setBanner(null);

      const page = await fetchUserSessions(nextOffset, nextLimit);
      const baseSessions = Array.isArray(page.sessions) ? page.sessions : [];

      const rows = await mapInBatches(baseSessions, PATIENT_INFO_BATCH_SIZE, async (session, index) => {
        let patientInfo = null;

        try {
          patientInfo = await getPatientInfo(session.userId);
        } catch (error) {
          if (isRateLimitedError(error) || isConnectivityError(error)) {
            throw error;
          }
          patientInfo = null;
        }

        const expDate = toDateFromUnix(session.exp);
        const isActive = Boolean(expDate && expDate.getTime() > Date.now());

        return {
          sessionId: buildSessionId(session, nextOffset + index + 1),
          userId: String(session.userId || '--'),
          patientName: formatPatientName(patientInfo, session.email, session.userId),
          email: session.email || '--',
          role: session.role || 'patient',
          device: '--',
          lastActive: patientInfo?.latest_updated_at || (expDate ? expDate.toISOString() : null),
          status: isActive ? 'active' : 'expired',
        };
      });

      setSessionRows(rows);
      setSessionTotal(Number(page.totalCount) || 0);
      setSessionOffset(nextOffset);
      setSessionLimit(nextLimit);
    } catch (error) {
      if (isRateLimitedError(error)) {
        markRateLimited();
        return;
      }

      if (isConnectivityError(error)) {
        markNetworkError();
      }

      setSessionsError(error?.message || 'Failed to load active sessions.');
      setSessionRows([]);
      setSessionTotal(0);
    } finally {
      setSessionsLoading(false);
    }
  }, [getPatientInfo, markNetworkError, markRateLimited]);

  useEffect(() => {
    loadTokenCountRef.current = loadTokenCount;
    loadSessionsPageRef.current = loadSessionsPage;
  }, [loadSessionsPage, loadTokenCount]);

  useEffect(() => {
    if (!PATIENT_MOUNT_FETCH_IN_FLIGHT) {
      PATIENT_MOUNT_FETCH_IN_FLIGHT = loadPatientDirectory().finally(() => {
        PATIENT_MOUNT_FETCH_IN_FLIGHT = null;
      });
    }

    void PATIENT_MOUNT_FETCH_IN_FLIGHT;
  }, [loadPatientDirectory]);

  useEffect(() => {
    if (!SESSIONS_MOUNT_FETCH_IN_FLIGHT) {
      SESSIONS_MOUNT_FETCH_IN_FLIGHT = Promise.allSettled([
        loadTokenCountRef.current?.(),
        loadSessionsPageRef.current?.(0, SESSION_INITIAL_LIMIT),
      ]).finally(() => {
        SESSIONS_MOUNT_FETCH_IN_FLIGHT = null;
      });
    }

    void SESSIONS_MOUNT_FETCH_IN_FLIGHT;
  }, []);

  useEffect(() => {
    setPatientPage(1);
  }, [patientSearch, patientBranchFilter, patientStatusFilter, patientPageSize]);

  const branchOptions = useMemo(() => {
    const optionsMap = new Map();

    for (const row of patientRows) {
      const label = normalizeBranchLabel(row.branch);
      const value = normalizeText(label);
      if (!value || value === '--') continue;
      optionsMap.set(value, label);
    }

    return [
      { value: 'all', label: 'All Branches' },
      ...Array.from(optionsMap.entries()).map(([value, label]) => ({ value, label })),
    ];
  }, [patientRows]);

  const statusOptions = useMemo(() => {
    const optionsMap = new Map();

    for (const row of patientRows) {
      const label = formatStatusLabel(row.status);
      const value = normalizeText(label);
      if (!value) continue;
      optionsMap.set(value, label);
    }

    return [
      { value: 'all', label: 'All Status' },
      ...Array.from(optionsMap.entries()).map(([value, label]) => ({ value, label })),
    ];
  }, [patientRows]);

  const filteredPatientRows = useMemo(() => {
    const searchValue = normalizeText(patientSearch);

    return patientRows.filter((row) => {
      if (patientBranchFilter !== 'all' && normalizeText(row.branch) !== patientBranchFilter) {
        return false;
      }

      if (patientStatusFilter !== 'all' && normalizeText(formatStatusLabel(row.status)) !== patientStatusFilter) {
        return false;
      }

      if (!searchValue) {
        return true;
      }

      const searchable = [row.patientName, row.email, row.id]
        .map((value) => normalizeText(value))
        .join(' ');

      return searchable.includes(searchValue);
    });
  }, [patientBranchFilter, patientRows, patientSearch, patientStatusFilter]);

  const patientTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredPatientRows.length / patientPageSize)),
    [filteredPatientRows.length, patientPageSize]
  );

  useEffect(() => {
    if (patientPage > patientTotalPages) {
      setPatientPage(patientTotalPages);
    }
  }, [patientPage, patientTotalPages]);

  const patientPageRows = useMemo(() => {
    const start = (patientPage - 1) * patientPageSize;
    return filteredPatientRows.slice(start, start + patientPageSize);
  }, [filteredPatientRows, patientPage, patientPageSize]);

  const patientRangeLabel = useMemo(() => {
    if (filteredPatientRows.length === 0 || patientPageRows.length === 0) {
      return 'Showing 0 of 0';
    }

    const start = (patientPage - 1) * patientPageSize + 1;
    const end = Math.min(start + patientPageRows.length - 1, filteredPatientRows.length);
    return `Showing ${start}-${end} of ${filteredPatientRows.length}`;
  }, [filteredPatientRows.length, patientPage, patientPageRows.length, patientPageSize]);

  const canSessionPrev = sessionOffset > 0;
  const canSessionNext = sessionOffset + sessionLimit < sessionTotal;

  const sessionRangeLabel = useMemo(() => {
    if (sessionTotal === 0 || sessionRows.length === 0) {
      return 'Showing 0 of 0';
    }

    const start = sessionOffset + 1;
    const end = Math.min(sessionOffset + sessionRows.length, sessionTotal);
    return `Showing ${start}-${end} of ${sessionTotal}`;
  }, [sessionOffset, sessionRows.length, sessionTotal]);

  const refreshActiveTab = useCallback(() => {
    if (rateLimitedRef.current) return;

    if (activeTab === 'patient-list') {
      void loadPatientDirectory();
      return;
    }

    void Promise.allSettled([
      loadTokenCount(),
      loadSessionsPage(sessionOffset, sessionLimit),
    ]);
  }, [activeTab, loadPatientDirectory, loadSessionsPage, loadTokenCount, sessionLimit, sessionOffset]);

  const retryAfterNetworkError = useCallback(() => {
    if (rateLimitedRef.current) return;
    setBanner(null);
    refreshActiveTab();
  }, [refreshActiveTab]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-700/50 p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('patient-list')}
            aria-pressed={activeTab === 'patient-list'}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'patient-list'
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'
            }`}
          >
            Patient List
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('active-sessions')}
            aria-pressed={activeTab === 'active-sessions'}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'active-sessions'
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'
            }`}
          >
            Active Sessions
          </button>
        </div>

        <button
          type="button"
          onClick={refreshActiveTab}
          disabled={isRateLimited}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={`Refresh ${activeTab === 'patient-list' ? 'patient list' : 'active sessions'}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {banner && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-warning-300 dark:border-warning-700 bg-warning-50 dark:bg-warning-900/20 px-3 py-2"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-warning-700 dark:text-warning-300">{banner.message}</p>
            {banner.type === 'network' && (
              <button
                type="button"
                onClick={retryAfterNetworkError}
                disabled={patientsLoading || sessionsLoading || tokenCountLoading}
                className="px-2.5 py-1 text-xs rounded border border-warning-300 dark:border-warning-700 text-warning-700 dark:text-warning-300 hover:bg-warning-100 dark:hover:bg-warning-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'patient-list' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              type="text"
              value={patientSearch}
              onChange={(event) => setPatientSearch(event.target.value)}
              placeholder="Search by name, email, or user ID"
              className="px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-secondary-700 dark:text-neutral-300 placeholder:text-secondary-400 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />

            <select
              value={patientBranchFilter}
              onChange={(event) => setPatientBranchFilter(event.target.value)}
              className="px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-secondary-700 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              {branchOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select
              value={patientStatusFilter}
              onChange={(event) => setPatientStatusFilter(event.target.value)}
              className="px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-secondary-700 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <p className="text-xs text-secondary-500 dark:text-neutral-400">
            {filteredPatientRows.length} patient account{filteredPatientRows.length !== 1 ? 's' : ''} matched
          </p>

          {patientsLoading ? (
            <div className="py-12 text-center">
              <div className="w-6 h-6 mx-auto border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs text-secondary-400 dark:text-neutral-500">Loading patient list...</p>
            </div>
          ) : patientsError ? (
            <div className="py-10 text-center">
              <p className="text-xs text-error-600 dark:text-error-400 mb-2">{patientsError}</p>
              {!isRateLimited && (
                <button
                  type="button"
                  onClick={loadPatientDirectory}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Retry
                </button>
              )}
            </div>
          ) : patientPageRows.length === 0 ? (
            <div className="py-12 text-center border border-neutral-200 dark:border-neutral-700 rounded-lg">
              <p className="text-xs text-secondary-500 dark:text-neutral-400">No patients matched your filters.</p>
            </div>
          ) : (
            <>
              <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                <div className="max-h-[420px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Patient Name</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Email</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Branch</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Status</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Last Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patientPageRows.map((row) => {
                        const statusKey = getStatusKey(row.status);
                        return (
                          <tr
                            key={row.id}
                            className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                          >
                            <td className="py-2.5 px-3 text-xs font-medium text-secondary-900 dark:text-white">{row.patientName}</td>
                            <td className="py-2.5 px-3 text-xs text-secondary-500 dark:text-neutral-400">{row.email}</td>
                            <td className="py-2.5 px-3 text-xs text-secondary-600 dark:text-neutral-300">{row.branch}</td>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center gap-1.5 text-xs text-secondary-700 dark:text-neutral-200">
                                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT_CLASS[statusKey] || STATUS_DOT_CLASS.unknown}`} />
                                {formatStatusLabel(row.status)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-xs text-secondary-500 dark:text-neutral-400">{formatDateTime(row.lastActive)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-xs text-secondary-500 dark:text-neutral-400">{patientRangeLabel}</p>

                <div className="flex items-center gap-2">
                  <label htmlFor="patient-page-size" className="text-xs text-secondary-500 dark:text-neutral-400">Rows</label>
                  <select
                    id="patient-page-size"
                    value={patientPageSize}
                    onChange={(event) => setPatientPageSize(Number(event.target.value))}
                    className="px-2 py-1 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-secondary-700 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  >
                    {PATIENT_PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setPatientPage((currentPage) => Math.max(1, currentPage - 1))}
                    disabled={patientPage <= 1}
                    className="px-2.5 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    onClick={() => setPatientPage((currentPage) => Math.min(patientTotalPages, currentPage + 1))}
                    disabled={patientPage >= patientTotalPages}
                    className="px-2.5 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'active-sessions' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 p-3">
              <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wide">Active Refresh Tokens</p>
              {tokenCountLoading ? (
                <div className="mt-2 w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              ) : tokenCountError ? (
                <p className="mt-2 text-xs text-error-600 dark:text-error-400">{tokenCountError}</p>
              ) : (
                <p className="mt-1 text-2xl font-bold text-secondary-900 dark:text-white">{tokenCount}</p>
              )}
            </div>

            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 p-3">
              <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wide">Access Mode</p>
              <p className="mt-1 text-sm font-semibold text-secondary-900 dark:text-white">Read-only monitoring</p>
              <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-1">
                This section is strictly observational and does not modify sessions.
              </p>
            </div>
          </div>

          {sessionsLoading ? (
            <div className="py-12 text-center">
              <div className="w-6 h-6 mx-auto border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs text-secondary-400 dark:text-neutral-500">Loading active sessions...</p>
            </div>
          ) : sessionsError ? (
            <div className="py-10 text-center">
              <p className="text-xs text-error-600 dark:text-error-400 mb-2">{sessionsError}</p>
              {!isRateLimited && (
                <button
                  type="button"
                  onClick={() => {
                    void loadSessionsPage(sessionOffset, sessionLimit);
                  }}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Retry
                </button>
              )}
            </div>
          ) : sessionRows.length === 0 ? (
            <div className="py-12 text-center border border-neutral-200 dark:border-neutral-700 rounded-lg">
              <p className="text-xs text-secondary-500 dark:text-neutral-400">No active patient sessions found.</p>
            </div>
          ) : (
            <>
              <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                <div className="overflow-auto">
                  <table className="w-full text-xs min-w-[760px]">
                    <thead>
                      <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Session ID</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Patient</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Email</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Role</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Device</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Last Active</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionRows.map((row) => {
                        const statusKey = getStatusKey(row.status);
                        return (
                          <tr key={row.sessionId} className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                            <td className="py-2.5 px-3 text-xs font-mono text-secondary-700 dark:text-neutral-300">{row.sessionId}</td>
                            <td className="py-2.5 px-3 text-xs font-medium text-secondary-900 dark:text-white">{row.patientName}</td>
                            <td className="py-2.5 px-3 text-xs text-secondary-500 dark:text-neutral-400">{row.email}</td>
                            <td className="py-2.5 px-3 text-xs text-secondary-600 dark:text-neutral-300">{row.role}</td>
                            <td className="py-2.5 px-3 text-xs text-secondary-500 dark:text-neutral-400">{row.device}</td>
                            <td className="py-2.5 px-3 text-xs text-secondary-500 dark:text-neutral-400">{formatDateTime(row.lastActive)}</td>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center gap-1.5 text-xs text-secondary-700 dark:text-neutral-200">
                                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT_CLASS[statusKey] || STATUS_DOT_CLASS.unknown}`} />
                                {formatStatusLabel(row.status)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-xs text-secondary-500 dark:text-neutral-400">{sessionRangeLabel}</p>

                <div className="flex items-center gap-2">
                  <label htmlFor="session-limit" className="text-xs text-secondary-500 dark:text-neutral-400">Rows</label>
                  <select
                    id="session-limit"
                    value={sessionLimit}
                    onChange={(event) => {
                      const nextLimit = Number(event.target.value);
                      void loadSessionsPage(0, nextLimit);
                    }}
                    disabled={isRateLimited || sessionsLoading}
                    className="px-2 py-1 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-secondary-700 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {SESSION_LIMIT_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      const nextOffset = Math.max(0, sessionOffset - sessionLimit);
                      void loadSessionsPage(nextOffset, sessionLimit);
                    }}
                    disabled={!canSessionPrev || sessionsLoading || isRateLimited}
                    className="px-2.5 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const nextOffset = sessionOffset + sessionLimit;
                      void loadSessionsPage(nextOffset, sessionLimit);
                    }}
                    disabled={!canSessionNext || sessionsLoading || isRateLimited}
                    className="px-2.5 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PatientManagement;
