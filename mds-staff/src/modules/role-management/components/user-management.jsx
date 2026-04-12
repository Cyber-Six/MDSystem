import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchActiveRefreshTokenCount,
  fetchAllSessions,
  fetchUserSessions,
  fetchUsers,
} from '../staff-service';

const USER_SCAN_LIMIT = 100;
const USER_PAGE_SIZE_OPTIONS = [10, 20, 50];
const SESSION_LIMIT_OPTIONS = [10, 20, 50];
const USER_INITIAL_PAGE_SIZE = 10;
const SESSION_INITIAL_LIMIT = 10;

const RATE_LIMIT_MESSAGE = 'Rate limit exceeded, please retry later';
const NETWORK_ERROR_MESSAGE = 'Unable to connect to server. Please check your connection.';

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

let USERS_MOUNT_FETCH_IN_FLIGHT = null;
let SESSIONS_MOUNT_FETCH_IN_FLIGHT = null;

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function toDate(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    const millis = value > 1e12 ? value : value * 1000;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return '--';

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

function normalizeTypeLabel(type) {
  const normalized = String(type || '').trim();
  return normalized || 'Unknown';
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

const UserManagement = () => {
  const [activeTab, setActiveTab] = useState('patients-list');

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(null);

  const [userSearch, setUserSearch] = useState('');
  const [userBranchFilter, setUserBranchFilter] = useState('all');
  const [userTypeFilter, setUserTypeFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(USER_INITIAL_PAGE_SIZE);

  const [selectedUser, setSelectedUser] = useState(null);
  const [userSessionRows, setUserSessionRows] = useState([]);
  const [userSessionsLoading, setUserSessionsLoading] = useState(false);
  const [userSessionsError, setUserSessionsError] = useState(null);

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

  const loadTokenCountRef = useRef(null);
  const loadSessionsPageRef = useRef(null);

  const markRateLimited = useCallback(() => {
    rateLimitedRef.current = true;
    setIsRateLimited(true);
    setBanner({ type: 'rate-limit', message: RATE_LIMIT_MESSAGE });
    setUsersError(RATE_LIMIT_MESSAGE);
    setTokenCountError(RATE_LIMIT_MESSAGE);
    setSessionsError(RATE_LIMIT_MESSAGE);
    setUserSessionsError(RATE_LIMIT_MESSAGE);
  }, []);

  const markNetworkError = useCallback(() => {
    if (rateLimitedRef.current) return;
    setBanner({ type: 'network', message: NETWORK_ERROR_MESSAGE });
  }, []);

  const loadUsers = useCallback(async () => {
    if (rateLimitedRef.current) return;

    setUsersLoading(true);
    setUsersError(null);

    try {
      setBanner(null);

      const allUsers = [];
      let offset = 0;
      let totalCount = 0;
      let safetyCounter = 0;

      do {
        const page = await fetchUsers(offset, USER_SCAN_LIMIT);
        const pageUsers = Array.isArray(page.users) ? page.users : [];

        allUsers.push(...pageUsers);
        totalCount = Number(page.totalCount) || 0;
        offset += USER_SCAN_LIMIT;
        safetyCounter += 1;

        if (pageUsers.length === 0) {
          break;
        }
      } while (offset < totalCount && safetyCounter < 100);

      const normalizedUsers = allUsers.map((row) => ({
        id: String(row.id || ''),
        name: row.name || row.email || `User ${row.id}`,
        email: row.email || '--',
        branch: normalizeBranchLabel(row.branch),
        type: normalizeTypeLabel(row.type),
        status: row.status || 'Unknown',
        lastLogin: row.lastLogin || null,
      }));

      setUsers(normalizedUsers);
      setUserPage(1);
    } catch (error) {
      if (isRateLimitedError(error)) {
        markRateLimited();
        return;
      }

      if (isConnectivityError(error)) {
        markNetworkError();
      }

      setUsersError(error?.message || 'Failed to load users.');
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [markNetworkError, markRateLimited]);

  const loadUserSessions = useCallback(async (userId) => {
    if (rateLimitedRef.current) return;
    if (!userId) return;

    setUserSessionsLoading(true);
    setUserSessionsError(null);

    try {
      const sessions = await fetchUserSessions(String(userId));
      const rows = (Array.isArray(sessions) ? sessions : [])
        .map((session, index) => {
          const ttlSeconds = Number(session.ttlSeconds) || 0;
          const expiresAt = session.expiresAt || (ttlSeconds > 0 ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null);

          return {
            rowId: `${userId}:${session.deviceId || index}`,
            deviceId: session.deviceId || '--',
            refreshToken: session.refreshToken || '--',
            status: session.status || 'unknown',
            createdAt: session.createdAt || null,
            updatedAt: session.updatedAt || null,
            ttlSeconds,
            expiresAt,
          };
        })
        .sort((left, right) => {
          const leftDate = toDate(left.updatedAt) || toDate(left.createdAt) || toDate(left.expiresAt);
          const rightDate = toDate(right.updatedAt) || toDate(right.createdAt) || toDate(right.expiresAt);
          return (rightDate?.getTime() || 0) - (leftDate?.getTime() || 0);
        });

      setUserSessionRows(rows);
    } catch (error) {
      if (isRateLimitedError(error)) {
        markRateLimited();
        return;
      }

      if (isConnectivityError(error)) {
        markNetworkError();
      }

      setUserSessionsError(error?.message || 'Failed to load linked sessions.');
      setUserSessionRows([]);
    } finally {
      setUserSessionsLoading(false);
    }
  }, [markNetworkError, markRateLimited]);

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

      const page = await fetchAllSessions(nextOffset, nextLimit);
      const baseSessions = Array.isArray(page.sessions) ? page.sessions : [];

      const rows = baseSessions.map((session, index) => ({
        rowId: session.userId ? `session-user-${session.userId}` : `session-row-${nextOffset + index + 1}`,
        userId: String(session.userId || '--'),
        email: session.email || '--',
        numberOfSessions: Number(session.numberOfSessions) || 0,
        status: session.status || 'unknown',
        lastActive: session.lastActive || session.exp || null,
      }));

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
  }, [markNetworkError, markRateLimited]);

  useEffect(() => {
    loadTokenCountRef.current = loadTokenCount;
    loadSessionsPageRef.current = loadSessionsPage;
  }, [loadSessionsPage, loadTokenCount]);

  useEffect(() => {
    if (!USERS_MOUNT_FETCH_IN_FLIGHT) {
      USERS_MOUNT_FETCH_IN_FLIGHT = loadUsers().finally(() => {
        USERS_MOUNT_FETCH_IN_FLIGHT = null;
      });
    }

    void USERS_MOUNT_FETCH_IN_FLIGHT;
  }, [loadUsers]);

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
    setUserPage(1);
  }, [userSearch, userBranchFilter, userTypeFilter, userStatusFilter, userPageSize]);

  const branchOptions = useMemo(() => {
    const optionsMap = new Map();

    for (const row of users) {
      const label = normalizeBranchLabel(row.branch);
      const value = normalizeText(label);
      if (!value || value === '--') continue;
      optionsMap.set(value, label);
    }

    return [
      { value: 'all', label: 'All Branches' },
      ...Array.from(optionsMap.entries()).map(([value, label]) => ({ value, label })),
    ];
  }, [users]);

  const typeOptions = useMemo(() => {
    const optionsMap = new Map();

    for (const row of users) {
      const label = normalizeTypeLabel(row.type);
      const value = normalizeText(label);
      if (!value) continue;
      optionsMap.set(value, label);
    }

    return [
      { value: 'all', label: 'All Types' },
      ...Array.from(optionsMap.entries()).map(([value, label]) => ({ value, label })),
    ];
  }, [users]);

  const statusOptions = useMemo(() => {
    const optionsMap = new Map();

    for (const row of users) {
      const label = formatStatusLabel(row.status);
      const value = normalizeText(label);
      if (!value) continue;
      optionsMap.set(value, label);
    }

    return [
      { value: 'all', label: 'All Status' },
      ...Array.from(optionsMap.entries()).map(([value, label]) => ({ value, label })),
    ];
  }, [users]);

  const filteredUsers = useMemo(() => {
    const searchValue = normalizeText(userSearch);

    return users.filter((row) => {
      if (userBranchFilter !== 'all' && normalizeText(row.branch) !== userBranchFilter) {
        return false;
      }

      if (userTypeFilter !== 'all' && normalizeText(row.type) !== userTypeFilter) {
        return false;
      }

      if (userStatusFilter !== 'all' && normalizeText(formatStatusLabel(row.status)) !== userStatusFilter) {
        return false;
      }

      if (!searchValue) {
        return true;
      }

      const searchable = [row.name, row.email, row.id]
        .map((value) => normalizeText(value))
        .join(' ');

      return searchable.includes(searchValue);
    });
  }, [userBranchFilter, userSearch, userStatusFilter, userTypeFilter, users]);

  const userTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredUsers.length / userPageSize)),
    [filteredUsers.length, userPageSize]
  );

  useEffect(() => {
    if (userPage > userTotalPages) {
      setUserPage(userTotalPages);
    }
  }, [userPage, userTotalPages]);

  const userPageRows = useMemo(() => {
    const start = (userPage - 1) * userPageSize;
    return filteredUsers.slice(start, start + userPageSize);
  }, [filteredUsers, userPage, userPageSize]);

  const userRangeLabel = useMemo(() => {
    if (filteredUsers.length === 0 || userPageRows.length === 0) {
      return 'Showing 0 of 0';
    }

    const start = (userPage - 1) * userPageSize + 1;
    const end = Math.min(start + userPageRows.length - 1, filteredUsers.length);
    return `Showing ${start}-${end} of ${filteredUsers.length}`;
  }, [filteredUsers.length, userPage, userPageRows.length, userPageSize]);

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

    if (activeTab === 'patients-list') {
      void loadUsers();
      return;
    }

    void Promise.allSettled([
      loadTokenCount(),
      loadSessionsPage(sessionOffset, sessionLimit),
    ]);
  }, [activeTab, loadSessionsPage, loadTokenCount, loadUsers, sessionLimit, sessionOffset]);

  const retryAfterNetworkError = useCallback(() => {
    if (rateLimitedRef.current) return;
    setBanner(null);
    refreshActiveTab();
  }, [refreshActiveTab]);

  const openSessionDetail = useCallback(async (row) => {
    const normalizedUser = {
      id: String(row.userId || ''),
      name: row.email || `User ${row.userId}`,
      email: row.email || '--',
    };

    if (!normalizedUser.id || normalizedUser.id === '--') {
      return;
    }

    setSelectedUser(normalizedUser);
    setUserSessionRows([]);
    setUserSessionsError(null);
    await loadUserSessions(normalizedUser.id);
  }, [loadUserSessions]);

  const closeUserDetail = useCallback(() => {
    setSelectedUser(null);
    setUserSessionRows([]);
    setUserSessionsError(null);
    setUserSessionsLoading(false);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-700/50 p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('patients-list')}
            aria-pressed={activeTab === 'patients-list'}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'patients-list'
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'
            }`}
          >
            Patients List
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
          aria-label={`Refresh ${activeTab === 'patients-list' ? 'patients list' : 'active sessions'}`}
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
                disabled={usersLoading || sessionsLoading || tokenCountLoading}
                className="px-2.5 py-1 text-xs rounded border border-warning-300 dark:border-warning-700 text-warning-700 dark:text-warning-300 hover:bg-warning-100 dark:hover:bg-warning-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'patients-list' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input
              type="text"
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="Search by name, email, or user ID"
              className="px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-secondary-700 dark:text-neutral-300 placeholder:text-secondary-400 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />

            <select
              value={userBranchFilter}
              onChange={(event) => setUserBranchFilter(event.target.value)}
              className="px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-secondary-700 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              {branchOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select
              value={userTypeFilter}
              onChange={(event) => setUserTypeFilter(event.target.value)}
              className="px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-secondary-700 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select
              value={userStatusFilter}
              onChange={(event) => setUserStatusFilter(event.target.value)}
              className="px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-secondary-700 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <p className="text-xs text-secondary-500 dark:text-neutral-400">
            {filteredUsers.length} patient account{filteredUsers.length !== 1 ? 's' : ''} matched
          </p>

          {usersLoading ? (
            <div className="py-12 text-center">
              <div className="w-6 h-6 mx-auto border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs text-secondary-400 dark:text-neutral-500">Loading patients...</p>
            </div>
          ) : usersError ? (
            <div className="py-10 text-center">
              <p className="text-xs text-error-600 dark:text-error-400 mb-2">{usersError}</p>
              {!isRateLimited && (
                <button
                  type="button"
                  onClick={loadUsers}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Retry
                </button>
              )}
            </div>
          ) : userPageRows.length === 0 ? (
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
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Name</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Email</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Branch</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Type</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Last Login</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userPageRows.map((row) => (
                        <tr key={row.id} className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0">
                          <td className="py-2.5 px-3 text-xs font-medium text-secondary-900 dark:text-white">{row.name}</td>
                          <td className="py-2.5 px-3 text-xs text-secondary-500 dark:text-neutral-400">{row.email}</td>
                          <td className="py-2.5 px-3 text-xs text-secondary-600 dark:text-neutral-300">{row.branch}</td>
                          <td className="py-2.5 px-3 text-xs text-secondary-600 dark:text-neutral-300">{row.type}</td>
                          <td className="py-2.5 px-3 text-xs text-secondary-500 dark:text-neutral-400">{formatDateTime(row.lastLogin)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-xs text-secondary-500 dark:text-neutral-400">{userRangeLabel}</p>

                <div className="flex items-center gap-2">
                  <label htmlFor="user-page-size" className="text-xs text-secondary-500 dark:text-neutral-400">Rows</label>
                  <select
                    id="user-page-size"
                    value={userPageSize}
                    onChange={(event) => setUserPageSize(Number(event.target.value))}
                    className="px-2 py-1 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-secondary-700 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  >
                    {USER_PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setUserPage((currentPage) => Math.max(1, currentPage - 1))}
                    disabled={userPage <= 1}
                    className="px-2.5 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    onClick={() => setUserPage((currentPage) => Math.min(userTotalPages, currentPage + 1))}
                    disabled={userPage >= userTotalPages}
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
              <p className="text-xs text-secondary-500 dark:text-neutral-400">No active sessions found.</p>
            </div>
          ) : (
            <>
              <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                <div className="overflow-auto">
                  <table className="w-full text-xs min-w-[760px]">
                    <thead>
                      <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">User ID</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Email</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Number of Sessions</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Last Active</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionRows.map((row) => {
                        const statusKey = getStatusKey(row.status);
                        return (
                          <tr
                            key={row.rowId}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              void openSessionDetail(row);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                void openSessionDetail(row);
                              }
                            }}
                            aria-label={`Open active tickets for user ${row.userId}`}
                            className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer"
                          >
                            <td className="py-2.5 px-3 text-xs text-secondary-600 dark:text-neutral-300">{row.userId}</td>
                            <td className="py-2.5 px-3 text-xs text-secondary-500 dark:text-neutral-400">{row.email}</td>
                            <td className="py-2.5 px-3 text-xs text-secondary-600 dark:text-neutral-300">{row.numberOfSessions}</td>
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

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="user-session-title">
          <div className="absolute inset-0 bg-black/40" onClick={closeUserDetail} aria-hidden="true" />
          <div className="relative w-full max-w-5xl max-h-[85vh] overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
              <div>
                <h3 id="user-session-title" className="text-sm font-semibold text-secondary-900 dark:text-white">Active Tickets (Devices and Refresh Tokens)</h3>
                <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-0.5">{selectedUser.name} ({selectedUser.email})</p>
              </div>
              <button
                type="button"
                onClick={closeUserDetail}
                className="px-2.5 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                aria-label="Close user session details"
              >
                Close
              </button>
            </div>

            <div className="p-4 overflow-auto max-h-[calc(85vh-64px)]">
              {userSessionsLoading ? (
                <div className="py-10 text-center">
                  <div className="w-6 h-6 mx-auto border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-xs text-secondary-400 dark:text-neutral-500">Loading linked sessions...</p>
                </div>
              ) : userSessionsError ? (
                <div className="py-10 text-center">
                  <p className="text-xs text-error-600 dark:text-error-400 mb-2">{userSessionsError}</p>
                  {!isRateLimited && (
                    <button
                      type="button"
                      onClick={() => {
                        void loadUserSessions(selectedUser.id);
                      }}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      Retry
                    </button>
                  )}
                </div>
              ) : userSessionRows.length === 0 ? (
                <div className="py-10 text-center border border-neutral-200 dark:border-neutral-700 rounded-lg">
                  <p className="text-xs text-secondary-500 dark:text-neutral-400">No active tickets found for this user.</p>
                </div>
              ) : (
                <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                  <div className="overflow-auto">
                    <table className="w-full text-xs min-w-[760px]">
                      <thead>
                        <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
                          <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Device ID</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Refresh Token</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Status</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Expiry</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userSessionRows.map((row) => {
                          const statusKey = getStatusKey(row.status);
                          return (
                            <tr key={row.rowId} className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                              <td className="py-2.5 px-3 text-xs font-mono text-secondary-700 dark:text-neutral-300">{row.deviceId}</td>
                              <td className="py-2.5 px-3 text-xs font-mono text-secondary-700 dark:text-neutral-300 max-w-[360px] truncate" title={row.refreshToken}>{row.refreshToken}</td>
                              <td className="py-2.5 px-3">
                                <span className="inline-flex items-center gap-1.5 text-xs text-secondary-700 dark:text-neutral-200">
                                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT_CLASS[statusKey] || STATUS_DOT_CLASS.unknown}`} />
                                  {formatStatusLabel(row.status)}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-xs text-secondary-500 dark:text-neutral-400">{formatDateTime(row.expiresAt)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
