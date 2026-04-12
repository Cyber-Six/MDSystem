import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchActiveRefreshTokenCount,
  fetchPatientBasicInfo,
  fetchStaffSessions,
  fetchUserSessions,
} from '../staff-service';

const ACCOUNT_SCAN_LIMIT = 100;
const ANALYTICS_LIMIT_OPTIONS = [10, 20, 50];

const STATUS_DOT_CLASS = {
  active: 'bg-success-500',
  unverified: 'bg-warning-500',
  inactive: 'bg-neutral-400',
  locked: 'bg-error-500',
  expired: 'bg-error-500',
  unknown: 'bg-neutral-400',
};

function isStaffPortalEmail(email) {
  return typeof email === 'string' && email.toLowerCase().includes('.mds@');
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

function getStatusKey(rawStatus) {
  const normalized = String(rawStatus || '').toLowerCase();
  if (normalized === 'active') return 'active';
  if (normalized === 'unverified') return 'unverified';
  if (normalized === 'inactive') return 'inactive';
  if (normalized === 'locked') return 'locked';
  if (normalized === 'expired') return 'expired';
  return 'unknown';
}

function formatStatusLabel(rawStatus) {
  const key = getStatusKey(rawStatus);
  if (key === 'unknown') return 'Unknown';
  if (key === 'unverified') return 'Unverified';
  if (key === 'inactive') return 'Inactive';
  if (key === 'locked') return 'Locked';
  if (key === 'expired') return 'Expired';
  return 'Active';
}

function formatPatientName(patientInfo, email, userId) {
  if (patientInfo) {
    const first = patientInfo.first_name || '';
    const middle = patientInfo.middle_name ? `${patientInfo.middle_name[0]}.` : '';
    const last = patientInfo.last_name || '';
    const suffix = patientInfo.suffix || '';
    const full = [first, middle, last, suffix].filter(Boolean).join(' ').trim();
    if (full) return full;
  }

  if (email) {
    const localPart = email.split('@')[0] || '';
    const pretty = localPart
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
    if (pretty) return pretty;
  }

  return `User ${userId}`;
}

function buildSessionId(baseSession, detailSession, index) {
  const device = detailSession?.deviceId || 'device';
  const expPart = Number(baseSession?.exp) || index;
  return `${baseSession?.userId || 'user'}-${device}-${expPart}`;
}

function matchSessionDetail(baseSession, detailSessions) {
  if (!Array.isArray(detailSessions) || detailSessions.length === 0) return null;

  const baseExpiry = toDateFromUnix(baseSession.exp);
  if (!baseExpiry) return detailSessions[0];

  let bestMatch = null;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const detail of detailSessions) {
    if (!detail?.expiresAt) continue;
    const detailExpiry = new Date(detail.expiresAt);
    if (Number.isNaN(detailExpiry.getTime())) continue;

    const delta = Math.abs(detailExpiry.getTime() - baseExpiry.getTime());
    if (delta < bestDelta) {
      bestDelta = delta;
      bestMatch = detail;
    }
  }

  return bestMatch || detailSessions[0];
}

const PatientManagement = () => {
  const [activeTab, setActiveTab] = useState('accounts');

  const [accountRows, setAccountRows] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState(null);

  const [tokenCount, setTokenCount] = useState(0);
  const [tokenCountLoading, setTokenCountLoading] = useState(false);
  const [tokenCountError, setTokenCountError] = useState(null);

  const [sessionRows, setSessionRows] = useState([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionOffset, setSessionOffset] = useState(0);
  const [sessionLimit, setSessionLimit] = useState(10);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState(null);

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsError(null);

    try {
      const page = await fetchUserSessions(0, ACCOUNT_SCAN_LIMIT);
      const uniqueByUser = new Map();

      for (const session of page.sessions || []) {
        if (!session?.userId) continue;
        const existing = uniqueByUser.get(String(session.userId));
        const currentExp = Number(session.exp) || 0;
        const previousExp = Number(existing?.exp) || 0;

        if (!existing || currentExp > previousExp) {
          uniqueByUser.set(String(session.userId), session);
        }
      }

      const candidateSessions = Array.from(uniqueByUser.values()).filter((session) => !isStaffPortalEmail(session.email));

      const hydratedRows = await Promise.all(
        candidateSessions.map(async (session) => {
          let patientInfo = null;
          try {
            patientInfo = await fetchPatientBasicInfo(session.userId);
          } catch {
            patientInfo = null;
          }

          const expDate = toDateFromUnix(session.exp);
          const status = patientInfo?.credentials_status || (expDate && expDate > new Date() ? 'Active' : 'Expired');

          return {
            id: String(session.userId),
            patientName: formatPatientName(patientInfo, session.email, session.userId),
            email: session.email || '--',
            branch: patientInfo?.branch || '--',
            status,
            lastActive: patientInfo?.latest_updated_at || (expDate ? expDate.toISOString() : null),
          };
        })
      );

      setAccountRows(hydratedRows);
    } catch (error) {
      setAccountsError(error.message || 'Failed to load patient accounts.');
      setAccountRows([]);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  const loadActiveRefreshTokenCount = useCallback(async () => {
    setTokenCountLoading(true);
    setTokenCountError(null);

    try {
      const count = await fetchActiveRefreshTokenCount();
      setTokenCount(Number(count) || 0);
    } catch (error) {
      setTokenCountError(error.message || 'Failed to load active refresh token count.');
      setTokenCount(0);
    } finally {
      setTokenCountLoading(false);
    }
  }, []);

  const loadAnalyticsSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);

    try {
      const page = await fetchUserSessions(sessionOffset, sessionLimit);
      const baseSessions = page.sessions || [];
      const uniqueUserIds = Array.from(new Set(baseSessions.map((session) => String(session.userId)).filter(Boolean)));

      const detailMap = new Map();
      await Promise.all(
        uniqueUserIds.map(async (userId) => {
          try {
            const detailSessions = await fetchStaffSessions(userId);
            detailMap.set(userId, detailSessions || []);
          } catch {
            detailMap.set(userId, []);
          }
        })
      );

      const mergedRows = baseSessions.map((baseSession, index) => {
        const details = detailMap.get(String(baseSession.userId)) || [];
        const matched = matchSessionDetail(baseSession, details);
        const fallbackDate = toDateFromUnix(baseSession.exp);

        const status = matched?.status || (fallbackDate && fallbackDate > new Date() ? 'active' : 'expired');
        const lastActive = matched?.updatedAt || matched?.createdAt || (fallbackDate ? fallbackDate.toISOString() : null);

        return {
          sessionId: buildSessionId(baseSession, matched, sessionOffset + index),
          userId: String(baseSession.userId || '--'),
          device: matched?.deviceId || 'Unknown',
          lastActive,
          status,
        };
      });

      setSessionRows(mergedRows);
      setSessionTotal(Number(page.totalCount) || 0);
    } catch (error) {
      setSessionsError(error.message || 'Failed to load sessions analytics.');
      setSessionRows([]);
      setSessionTotal(0);
    } finally {
      setSessionsLoading(false);
    }
  }, [sessionLimit, sessionOffset]);

  useEffect(() => {
    if (activeTab === 'accounts' && accountRows.length === 0 && !accountsLoading) {
      loadAccounts();
    }
  }, [activeTab, accountRows.length, accountsLoading, loadAccounts]);

  useEffect(() => {
    if (activeTab !== 'analytics') return;
    loadActiveRefreshTokenCount();
  }, [activeTab, loadActiveRefreshTokenCount]);

  useEffect(() => {
    if (activeTab !== 'analytics') return;
    loadAnalyticsSessions();
  }, [activeTab, loadAnalyticsSessions]);

  const canGoPrev = sessionOffset > 0;
  const canGoNext = sessionOffset + sessionLimit < sessionTotal;

  const paginationLabel = useMemo(() => {
    if (sessionTotal === 0 || sessionRows.length === 0) return 'Showing 0 of 0';
    const start = sessionOffset + 1;
    const end = Math.min(sessionOffset + sessionRows.length, sessionTotal);
    return `Showing ${start}-${end} of ${sessionTotal}`;
  }, [sessionOffset, sessionRows.length, sessionTotal]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-700/50 p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('accounts')}
            aria-pressed={activeTab === 'accounts'}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'accounts'
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'
            }`}
          >
            Accounts List
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            aria-pressed={activeTab === 'analytics'}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'analytics'
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'
            }`}
          >
            Analytics
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            if (activeTab === 'accounts') {
              loadAccounts();
              return;
            }
            loadActiveRefreshTokenCount();
            loadAnalyticsSessions();
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          aria-label={`Refresh ${activeTab === 'accounts' ? 'accounts list' : 'analytics'}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {activeTab === 'accounts' && (
        <>
          <p className="text-xs text-secondary-500 dark:text-neutral-400 mb-1">
            {accountRows.length} patient account{accountRows.length !== 1 ? 's' : ''} with recorded sessions
          </p>

          {accountsLoading ? (
            <div className="py-12 text-center">
              <div className="w-6 h-6 mx-auto border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs text-secondary-400 dark:text-neutral-500">Loading patient accounts...</p>
            </div>
          ) : accountsError ? (
            <div className="py-10 text-center">
              <p className="text-xs text-error-600 dark:text-error-400 mb-2">{accountsError}</p>
              <button
                type="button"
                onClick={loadAccounts}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                Retry
              </button>
            </div>
          ) : accountRows.length === 0 ? (
            <div className="py-12 text-center border border-neutral-200 dark:border-neutral-700 rounded-lg">
              <p className="text-xs text-secondary-500 dark:text-neutral-400">No patient sessions found.</p>
            </div>
          ) : (
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
                    {accountRows.map((row) => {
                      const statusKey = getStatusKey(row.status);
                      return (
                        <tr
                          key={row.id}
                          className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                        >
                          <td className="py-2.5 px-3 text-xs font-medium text-secondary-900 dark:text-white">{row.patientName}</td>
                          <td className="py-2.5 px-3 text-xs text-secondary-500 dark:text-neutral-400">{row.email}</td>
                          <td className="py-2.5 px-3 text-xs text-secondary-600 dark:text-neutral-300">{row.branch || '--'}</td>
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
          )}
        </>
      )}

      {activeTab === 'analytics' && (
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
              <p className="mt-1 text-sm font-semibold text-secondary-900 dark:text-white">Read-only analytics</p>
              <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-1">
                Session visibility is limited to monitoring and does not allow session mutation.
              </p>
            </div>
          </div>

          {sessionsLoading ? (
            <div className="py-12 text-center">
              <div className="w-6 h-6 mx-auto border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs text-secondary-400 dark:text-neutral-500">Loading session analytics...</p>
            </div>
          ) : sessionsError ? (
            <div className="py-10 text-center">
              <p className="text-xs text-error-600 dark:text-error-400 mb-2">{sessionsError}</p>
              <button
                type="button"
                onClick={loadAnalyticsSessions}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                <div className="overflow-auto">
                  <table className="w-full text-xs min-w-[700px]">
                    <thead>
                      <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Session ID</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">User ID</th>
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
                            <td className="py-2.5 px-3 text-xs text-secondary-700 dark:text-neutral-300">{row.userId}</td>
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
                <p className="text-xs text-secondary-500 dark:text-neutral-400">{paginationLabel}</p>

                <div className="flex items-center gap-2">
                  <label htmlFor="session-limit" className="text-xs text-secondary-500 dark:text-neutral-400">Rows</label>
                  <select
                    id="session-limit"
                    value={sessionLimit}
                    onChange={(event) => {
                      setSessionLimit(Number(event.target.value));
                      setSessionOffset(0);
                    }}
                    className="px-2 py-1 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-secondary-700 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  >
                    {ANALYTICS_LIMIT_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setSessionOffset((prev) => Math.max(0, prev - sessionLimit))}
                    disabled={!canGoPrev || sessionsLoading}
                    className="px-2.5 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    onClick={() => setSessionOffset((prev) => prev + sessionLimit)}
                    disabled={!canGoNext || sessionsLoading}
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
