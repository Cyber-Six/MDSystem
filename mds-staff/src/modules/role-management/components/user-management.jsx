import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  deletePatients,
  fetchActiveRefreshTokenCount,
  fetchMaxActiveUsersInHours,
  applySemestralInactivation,
  previewSemestralInactivation,
  searchPatientDeletionCandidates,
  fetchAllSessions,
  fetchUserLoginAttempts,
  fetchUserSessions,
  fetchUsers,
  setAllUserSessionsRevoked,
  setUserAccountLocked,
  setUserSessionRevoked,
  setUserSuperiorStatus,
} from '../staff-service';
import ConfirmationModal from '../../../components/modals/ConfirmationModal.jsx';

const USER_PAGE_SIZE_OPTIONS = [10, 20, 50];
const LOGIN_HISTORY_LIMIT_OPTIONS = [10, 20, 50];
const SESSION_LIMIT_OPTIONS = [10, 20, 50];
const PATIENT_DELETION_PAGE_SIZE_OPTIONS = [10, 20, 50];
const PATIENT_DELETION_DROPDOWN_LIMIT = 200;
const ACTIVE_USER_WINDOW_OPTIONS = [6, 12, 24, 48, 72];
const USER_INITIAL_PAGE_SIZE = 10;
const LOGIN_HISTORY_INITIAL_LIMIT = 10;
const SESSION_INITIAL_LIMIT = 10;
const PATIENT_DELETION_INITIAL_PAGE_SIZE = 10;
const ACTIVE_USERS_DEFAULT_HOURS = 24;
const ADMIN_REFETCH_MIN_WAIT_MS = 15000;

const USER_BRANCH_FILTER_OPTIONS = [
  { value: 'all', label: 'All Branches' },
  { value: 'Manila', label: 'Manila' },
  { value: 'QuezonCity', label: 'QuezonCity' },
  { value: 'Both', label: 'Both' },
];

const USER_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
  { value: 'Unverified', label: 'Unverified' },
  { value: 'Locked', label: 'Locked' },
];

const SEMESTRAL_BRANCH_OPTIONS = [
  { value: 'Manila', label: 'Manila' },
  { value: 'QuezonCity', label: 'QuezonCity' },
  { value: 'Both', label: 'Both' },
];

const SEMESTRAL_TARGET_OPTIONS = [
  { value: 'both', label: 'Students and Employees' },
  { value: 'students', label: 'Students only' },
  { value: 'employees', label: 'Employees only' },
];

const RATE_LIMIT_MESSAGE = 'Rate limit exceeded, please retry later';
const NETWORK_ERROR_MESSAGE = 'Unable to connect to server. Please check your connection.';

const STATUS_DOT_CLASS = {
  active: 'bg-success-500',
  revoked: 'bg-error-500',
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

function resolveSemestralTargetIdentities(target) {
  const normalized = normalizeText(target);
  if (normalized === 'students') return ['Student'];
  if (normalized === 'employees') return ['Employee'];
  return ['Student', 'Employee'];
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

function formatWindowLabel(hours) {
  const normalizedHours = Number(hours) || 0;
  if (normalizedHours >= 24 && normalizedHours % 24 === 0) {
    const days = normalizedHours / 24;
    return `${days}d`;
  }
  return `${normalizedHours}h`;
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
  if (normalized === 'revoked') return 'revoked';
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
  if (key === 'revoked') return 'Revoked';
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
  const [userTotal, setUserTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(null);

  const [userSearch, setUserSearch] = useState('');
  const [userBranchFilter, setUserBranchFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [userShowUnverified, setUserShowUnverified] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(USER_INITIAL_PAGE_SIZE);

  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loginHistoryRows, setLoginHistoryRows] = useState([]);
  const [loginHistoryLoading, setLoginHistoryLoading] = useState(false);
  const [loginHistoryError, setLoginHistoryError] = useState(null);
  const [loginHistoryOffset, setLoginHistoryOffset] = useState(0);
  const [loginHistoryLimit, setLoginHistoryLimit] = useState(LOGIN_HISTORY_INITIAL_LIMIT);
  const [loginHistoryHasMore, setLoginHistoryHasMore] = useState(false);
  const [lockingAccount, setLockingAccount] = useState(false);
  const [settingSuperior, setSettingSuperior] = useState(false);
  const [superiorActionUserId, setSuperiorActionUserId] = useState(null);
  const [accountActionConfirm, setAccountActionConfirm] = useState(null);

  const [selectedSessionUser, setSelectedSessionUser] = useState(null);
  const [userSessionRows, setUserSessionRows] = useState([]);
  const [userSessionOffset, setUserSessionOffset] = useState(0);
  const [userSessionLimit, setUserSessionLimit] = useState(SESSION_INITIAL_LIMIT);
  const [userSessionHasMore, setUserSessionHasMore] = useState(false);
  const [userSessionsLoading, setUserSessionsLoading] = useState(false);
  const [userSessionsError, setUserSessionsError] = useState(null);

  const [tokenCount, setTokenCount] = useState(0);
  const [tokenCountLoading, setTokenCountLoading] = useState(false);
  const [tokenCountError, setTokenCountError] = useState(null);

  const [activeUsersWindowHours, setActiveUsersWindowHours] = useState(ACTIVE_USERS_DEFAULT_HOURS);
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [activeUsersLoading, setActiveUsersLoading] = useState(false);
  const [activeUsersError, setActiveUsersError] = useState(null);

  const [sessionRows, setSessionRows] = useState([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionOffset, setSessionOffset] = useState(0);
  const [sessionLimit, setSessionLimit] = useState(SESSION_INITIAL_LIMIT);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState(null);

  const [revokingSessionRowId, setRevokingSessionRowId] = useState(null);
  const [bulkSessionAction, setBulkSessionAction] = useState(null);
  const [sessionToastMessage, setSessionToastMessage] = useState(null);

  const [semestralScopeType, setSemestralScopeType] = useState('branch');
  const [semestralScopeValue, setSemestralScopeValue] = useState(SEMESTRAL_BRANCH_OPTIONS[0].value);
  const [semestralTarget, setSemestralTarget] = useState('both');
  const [semestralPreview, setSemestralPreview] = useState(null);
  const [semestralPreviewLoading, setSemestralPreviewLoading] = useState(false);
  const [semestralApplying, setSemestralApplying] = useState(false);
  const [semestralNotice, setSemestralNotice] = useState(null);
  const [semestralReviewModal, setSemestralReviewModal] = useState(null);

  const [deletionSearch, setDeletionSearch] = useState('');
  const [deletionRows, setDeletionRows] = useState([]);
  const [deletionTotal, setDeletionTotal] = useState(0);
  const [deletionLoading, setDeletionLoading] = useState(false);
  const [eligibleDropdownLoading, setEligibleDropdownLoading] = useState(false);
  const [eligibleDropdownRows, setEligibleDropdownRows] = useState([]);
  const [deletionError, setDeletionError] = useState(null);
  const [deletionPage, setDeletionPage] = useState(1);
  const [deletionPageSize, setDeletionPageSize] = useState(PATIENT_DELETION_INITIAL_PAGE_SIZE);
  const [selectedDeletionIds, setSelectedDeletionIds] = useState([]);
  const [deletionSelectionMeta, setDeletionSelectionMeta] = useState({});
  const [deletionToast, setDeletionToast] = useState(null);
  const [deletionConfirmModalOpen, setDeletionConfirmModalOpen] = useState(false);
  const [deletionConfirmCountdown, setDeletionConfirmCountdown] = useState(5);
  const [deletionSubmitting, setDeletionSubmitting] = useState(false);

  const [banner, setBanner] = useState(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const rateLimitedRef = useRef(false);

  const patientsTabRef = useRef(activeTab);
  const sessionsTabRef = useRef(activeTab);
  const accountActionsTabRef = useRef(activeTab);
  const tabRefetchAtRef = useRef({
    'patients-list': 0,
    'active-sessions': 0,
    'account-actions': 0,
  });

  const markRateLimited = useCallback(() => {
    rateLimitedRef.current = true;
    setIsRateLimited(true);
    setBanner({ type: 'rate-limit', message: RATE_LIMIT_MESSAGE });
    setUsersError(RATE_LIMIT_MESSAGE);
    setLoginHistoryError(RATE_LIMIT_MESSAGE);
    setTokenCountError(RATE_LIMIT_MESSAGE);
    setActiveUsersError(RATE_LIMIT_MESSAGE);
    setSessionsError(RATE_LIMIT_MESSAGE);
    setUserSessionsError(RATE_LIMIT_MESSAGE);
  }, []);

  const markNetworkError = useCallback(() => {
    if (rateLimitedRef.current) return;
    setBanner({ type: 'network', message: NETWORK_ERROR_MESSAGE });
  }, []);

  const getTabRefetchRemainingMs = useCallback((tabKey) => {
    const lastRefetchAt = Number(tabRefetchAtRef.current?.[tabKey]) || 0;
    if (lastRefetchAt <= 0) return 0;

    const elapsedMs = Date.now() - lastRefetchAt;
    const remainingMs = ADMIN_REFETCH_MIN_WAIT_MS - elapsedMs;
    return remainingMs > 0 ? remainingMs : 0;
  }, []);

  const markTabRefetch = useCallback((tabKey) => {
    tabRefetchAtRef.current[tabKey] = Date.now();
  }, []);

  const showRefetchCooldown = useCallback((remainingMs) => {
    const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
    setBanner({
      type: 'cooldown',
      message: `Please wait ${remainingSeconds}s before refetching this admin tab again.`,
    });
  }, []);

  const loadUsers = useCallback(async () => {
    if (rateLimitedRef.current) return;

    setUsersLoading(true);
    setUsersError(null);

    try {
      setBanner(null);

      const offset = Math.max(0, (userPage - 1) * userPageSize);
      const page = await fetchUsers(offset, userPageSize, {
        search: userSearch,
        branch: userBranchFilter,
        status: userStatusFilter,
        includeUnverified: userShowUnverified || normalizeText(userStatusFilter) === 'unverified',
      });

      const pageUsers = Array.isArray(page.users) ? page.users : [];
      const normalizedUsers = pageUsers.map((row) => ({
        id: String(row.id || ''),
        name: row.name || '--',
        email: row.email || '--',
        branch: normalizeBranchLabel(row.branch),
        type: normalizeTypeLabel(row.type),
        userType: normalizeText(row.userType) === 'medical' ? 'medical' : 'patient',
        status: row.status || 'Unknown',
        inactiveExpiresAt: row.inactiveExpiresAt || null,
        lastLogin: row.lastLogin || null,
      }));

      setUsers(normalizedUsers);
      setUserTotal(Number(page.totalCount) || 0);
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
      setUserTotal(0);
    } finally {
      setUsersLoading(false);
    }
  }, [markNetworkError, markRateLimited, userBranchFilter, userPage, userPageSize, userSearch, userShowUnverified, userStatusFilter]);

  const loadUserSessions = useCallback(async (userId, nextOffset = 0, nextLimit = userSessionLimit) => {
    if (rateLimitedRef.current) return;
    if (!userId) return;

    setUserSessionsLoading(true);
    setUserSessionsError(null);

    try {
      const page = await fetchUserSessions(String(userId), nextOffset, nextLimit);
      const sessions = Array.isArray(page.sessions) ? page.sessions : [];

      const rows = sessions
        .map((session, index) => {
          const ttlSeconds = Number(session.ttlSeconds) || 0;
          const expiresAt = session.expiresAt || (ttlSeconds > 0 ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null);

          return {
            rowId: `${userId}:${session.deviceId || 'unknown'}:${nextOffset + index}`,
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
      setUserSessionOffset(nextOffset);
      setUserSessionLimit(nextLimit);
      setUserSessionHasMore(Boolean(page.hasMore));
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
      setUserSessionOffset(0);
      setUserSessionHasMore(false);
    } finally {
      setUserSessionsLoading(false);
    }
  }, [markNetworkError, markRateLimited, userSessionLimit]);

  const loadLoginHistory = useCallback(async (userId, nextOffset = 0, nextLimit = loginHistoryLimit) => {
    if (rateLimitedRef.current) return;
    if (!userId) return;

    setLoginHistoryLoading(true);
    setLoginHistoryError(null);

    try {
      const page = await fetchUserLoginAttempts(String(userId), nextOffset, nextLimit);
      const attempts = Array.isArray(page.attempts) ? page.attempts : [];

      const rows = attempts.map((attempt, index) => ({
        rowId: `${userId}:attempt:${nextOffset + index}`,
        timestamp: attempt.timestamp || null,
        ip: attempt.ip || 'N/A',
        device: attempt.device || 'Unknown Device',
        status: attempt.status || 'Unknown',
      }));

      setLoginHistoryRows(rows);
      setLoginHistoryOffset(nextOffset);
      setLoginHistoryLimit(nextLimit);
      setLoginHistoryHasMore(Boolean(page.hasMore));
    } catch (error) {
      if (isRateLimitedError(error)) {
        markRateLimited();
        return;
      }

      if (isConnectivityError(error)) {
        markNetworkError();
      }

      setLoginHistoryError(error?.message || 'Failed to load login history.');
      setLoginHistoryRows([]);
      setLoginHistoryOffset(0);
      setLoginHistoryHasMore(false);
    } finally {
      setLoginHistoryLoading(false);
    }
  }, [loginHistoryLimit, markNetworkError, markRateLimited]);

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

  const loadActiveUsersInHours = useCallback(async (hours) => {
    if (rateLimitedRef.current) return;

    setActiveUsersLoading(true);
    setActiveUsersError(null);

    try {
      const count = await fetchMaxActiveUsersInHours(Number(hours));
      setActiveUsersCount(Number(count) || 0);
    } catch (error) {
      if (isRateLimitedError(error)) {
        markRateLimited();
        return;
      }

      if (isConnectivityError(error)) {
        markNetworkError();
      }

      setActiveUsersError(error?.message || 'Failed to load active user metric.');
      setActiveUsersCount(0);
    } finally {
      setActiveUsersLoading(false);
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

  const loadEligibleDropdownCandidates = useCallback(async () => {
    if (rateLimitedRef.current) return;

    setEligibleDropdownLoading(true);

    try {
      const page = await searchPatientDeletionCandidates({
        search: '',
        offset: 0,
        limit: PATIENT_DELETION_DROPDOWN_LIMIT,
      });

      const patients = Array.isArray(page.patients) ? page.patients : [];
      const normalizedRows = patients
        .map((row) => ({
          id: String(row.id || ''),
          name: row.name || 'Unverified User',
          email: row.email || '--',
          branch: normalizeBranchLabel(row.branch),
          type: normalizeTypeLabel(row.type),
          status: row.status || 'Unknown',
          updatedAt: row.updatedAt || null,
          eligibleAfter: row.eligibleAfter || null,
          eligible: Boolean(row.eligible),
        }))
        .filter((row) => normalizeText(row.status) === 'inactive');

      setEligibleDropdownRows(normalizedRows);
      setDeletionSelectionMeta((prev) => {
        const next = { ...prev };
        for (const row of normalizedRows) {
          next[row.id] = row;
        }
        return next;
      });
    } catch (error) {
      if (isRateLimitedError(error)) {
        markRateLimited();
        return;
      }

      if (isConnectivityError(error)) {
        markNetworkError();
      }

      setEligibleDropdownRows([]);
      setDeletionError(error?.message || 'Failed to load auto-eligible inactive accounts.');
    } finally {
      setEligibleDropdownLoading(false);
    }
  }, [markNetworkError, markRateLimited]);

  const loadDeletionCandidates = useCallback(async () => {
    if (rateLimitedRef.current) return;

    setDeletionLoading(true);
    setDeletionError(null);

    try {
      setBanner(null);

      const offset = Math.max(0, (deletionPage - 1) * deletionPageSize);
      const page = await searchPatientDeletionCandidates({
        search: deletionSearch,
        offset,
        limit: deletionPageSize,
      });

      const patients = Array.isArray(page.patients) ? page.patients : [];
      const normalizedRows = patients.map((row) => ({
        id: String(row.id || ''),
        name: row.name || 'Unverified User',
        email: row.email || '--',
        branch: normalizeBranchLabel(row.branch),
        type: normalizeTypeLabel(row.type),
        status: row.status || 'Unknown',
        updatedAt: row.updatedAt || null,
        eligibleAfter: row.eligibleAfter || null,
        eligible: Boolean(row.eligible),
      }));

      setDeletionRows(normalizedRows);
      setDeletionTotal(Number(page.totalCount) || 0);
      setDeletionSelectionMeta((prev) => {
        const next = { ...prev };
        for (const row of normalizedRows) {
          next[row.id] = row;
        }
        return next;
      });
    } catch (error) {
      if (isRateLimitedError(error)) {
        markRateLimited();
        return;
      }

      if (isConnectivityError(error)) {
        markNetworkError();
      }

      setDeletionError(error?.message || 'Failed to load patient deletion candidates.');
      setDeletionRows([]);
      setDeletionTotal(0);
    } finally {
      setDeletionLoading(false);
    }
  }, [deletionPage, deletionPageSize, deletionSearch, markNetworkError, markRateLimited]);

  useEffect(() => {
    const switchedTabs = patientsTabRef.current !== activeTab;
    patientsTabRef.current = activeTab;
    const hasPatientsFetched = Number(tabRefetchAtRef.current['patients-list']) > 0;

    if (activeTab !== 'patients-list') return;
    if (rateLimitedRef.current) return;

    if (switchedTabs) {
      const remainingMs = getTabRefetchRemainingMs('patients-list');
      if (remainingMs > 0) {
        showRefetchCooldown(remainingMs);
        return;
      }
      markTabRefetch('patients-list');
    } else if (!hasPatientsFetched) {
      markTabRefetch('patients-list');
    }

    void loadUsers();
  }, [activeTab, getTabRefetchRemainingMs, loadUsers, markTabRefetch, showRefetchCooldown]);

  useEffect(() => {
    const switchedTabs = sessionsTabRef.current !== activeTab;
    sessionsTabRef.current = activeTab;

    if (activeTab !== 'active-sessions') return;
    if (rateLimitedRef.current) return;

    if (switchedTabs) {
      const remainingMs = getTabRefetchRemainingMs('active-sessions');
      if (remainingMs > 0) {
        showRefetchCooldown(remainingMs);
        return;
      }

      markTabRefetch('active-sessions');
      void Promise.allSettled([
        loadTokenCount(),
        loadActiveUsersInHours(activeUsersWindowHours),
        loadSessionsPage(sessionOffset, sessionLimit),
      ]);
      return;
    }

    void loadActiveUsersInHours(activeUsersWindowHours);
  }, [
    activeTab,
    activeUsersWindowHours,
    getTabRefetchRemainingMs,
    loadActiveUsersInHours,
    loadSessionsPage,
    loadTokenCount,
    markTabRefetch,
    sessionLimit,
    sessionOffset,
    showRefetchCooldown,
  ]);

  useEffect(() => {
    const switchedTabs = accountActionsTabRef.current !== activeTab;
    accountActionsTabRef.current = activeTab;

    if (activeTab !== 'account-actions') return;
    if (rateLimitedRef.current) return;

    if (switchedTabs) {
      const remainingMs = getTabRefetchRemainingMs('account-actions');
      if (remainingMs > 0) {
        showRefetchCooldown(remainingMs);
        return;
      }
      markTabRefetch('account-actions');
    }

    void Promise.allSettled([
      loadEligibleDropdownCandidates(),
      loadDeletionCandidates(),
    ]);
  }, [
    activeTab,
    getTabRefetchRemainingMs,
    loadDeletionCandidates,
    loadEligibleDropdownCandidates,
    markTabRefetch,
    showRefetchCooldown,
  ]);

  useEffect(() => {
    if (!sessionToastMessage) return;

    const timeoutId = setTimeout(() => {
      setSessionToastMessage(null);
    }, 2500);

    return () => clearTimeout(timeoutId);
  }, [sessionToastMessage]);

  useEffect(() => {
    if (!semestralNotice) return;

    const timeoutId = setTimeout(() => {
      setSemestralNotice(null);
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [semestralNotice]);

  useEffect(() => {
    if (!deletionToast) return;

    const timeoutId = setTimeout(() => {
      setDeletionToast(null);
    }, 3500);

    return () => clearTimeout(timeoutId);
  }, [deletionToast]);

  useEffect(() => {
    if (!deletionConfirmModalOpen) {
      setDeletionConfirmCountdown(5);
      return;
    }

    setDeletionConfirmCountdown(5);

    const intervalId = setInterval(() => {
      setDeletionConfirmCountdown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [deletionConfirmModalOpen]);

  useEffect(() => {
    if (semestralScopeType === 'branch') {
      setSemestralScopeValue(SEMESTRAL_BRANCH_OPTIONS[0].value);
      return;
    }

    setSemestralScopeValue('');
  }, [semestralScopeType]);

  useEffect(() => {
    setSemestralPreview(null);
    setSemestralReviewModal(null);
  }, [semestralScopeType, semestralScopeValue, semestralTarget]);

  useEffect(() => {
    setUserPage(1);
  }, [userSearch, userBranchFilter, userStatusFilter, userShowUnverified, userPageSize]);

  useEffect(() => {
    setDeletionPage(1);
  }, [deletionSearch, deletionPageSize]);

  const branchOptions = USER_BRANCH_FILTER_OPTIONS;
  const statusOptions = USER_STATUS_FILTER_OPTIONS;

  const userTotalPages = useMemo(
    () => Math.max(1, Math.ceil(userTotal / userPageSize)),
    [userPageSize, userTotal]
  );

  const deletionTotalPages = useMemo(
    () => Math.max(1, Math.ceil(deletionTotal / deletionPageSize)),
    [deletionPageSize, deletionTotal]
  );

  useEffect(() => {
    if (userPage > userTotalPages) {
      setUserPage(userTotalPages);
    }
  }, [userPage, userTotalPages]);

  useEffect(() => {
    if (deletionPage > deletionTotalPages) {
      setDeletionPage(deletionTotalPages);
    }
  }, [deletionPage, deletionTotalPages]);

  const userPageRows = users;

  const hasSuperiorUserInPage = useMemo(
    () => userPageRows.some((row) => normalizeText(row.type) === 'superior'),
    [userPageRows]
  );

  const userRangeLabel = useMemo(() => {
    if (userTotal === 0 || userPageRows.length === 0) {
      return 'Showing 0 of 0';
    }

    const start = (userPage - 1) * userPageSize + 1;
    const end = Math.min(start + userPageRows.length - 1, userTotal);
    return `Showing ${start}-${end} of ${userTotal}`;
  }, [userPage, userPageRows.length, userPageSize, userTotal]);

  const deletionRangeLabel = useMemo(() => {
    if (deletionTotal === 0 || deletionRows.length === 0) {
      return 'Showing 0 of 0';
    }

    const start = (deletionPage - 1) * deletionPageSize + 1;
    const end = Math.min(start + deletionRows.length - 1, deletionTotal);
    return `Showing ${start}-${end} of ${deletionTotal}`;
  }, [deletionPage, deletionPageSize, deletionRows.length, deletionTotal]);

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

  const canUserSessionPrev = userSessionOffset > 0;
  const canUserSessionNext = userSessionHasMore;

  const canLoginHistoryPrev = loginHistoryOffset > 0;
  const canLoginHistoryNext = loginHistoryHasMore;

  const loginHistoryRangeLabel = useMemo(() => {
    if (loginHistoryRows.length === 0) {
      return 'Showing 0 of 0';
    }

    const start = loginHistoryOffset + 1;
    const end = loginHistoryOffset + loginHistoryRows.length;
    return `Showing ${start}-${end}${loginHistoryHasMore ? '+' : ''}`;
  }, [loginHistoryHasMore, loginHistoryOffset, loginHistoryRows.length]);

  const userSessionRangeLabel = useMemo(() => {
    if (userSessionRows.length === 0) {
      return 'Showing 0 of 0';
    }

    const start = userSessionOffset + 1;
    const end = userSessionOffset + userSessionRows.length;
    return `Showing ${start}-${end}${userSessionHasMore ? '+' : ''}`;
  }, [userSessionHasMore, userSessionOffset, userSessionRows.length]);

  const selectedDeletionIdSet = useMemo(
    () => new Set(selectedDeletionIds),
    [selectedDeletionIds]
  );

  const eligibleDropdownIdSet = useMemo(
    () => new Set(eligibleDropdownRows.map((row) => row.id)),
    [eligibleDropdownRows]
  );

  const selectedEligibleDropdownIds = useMemo(
    () => selectedDeletionIds.filter((id) => eligibleDropdownIdSet.has(id)),
    [eligibleDropdownIdSet, selectedDeletionIds]
  );

  const visibleEligibleIds = useMemo(
    () => deletionRows.filter((row) => row.eligible).map((row) => row.id),
    [deletionRows]
  );

  const allVisibleEligibleSelected = useMemo(
    () => visibleEligibleIds.length > 0 && visibleEligibleIds.every((id) => selectedDeletionIdSet.has(id)),
    [selectedDeletionIdSet, visibleEligibleIds]
  );

  const selectedDeletionRows = useMemo(
    () => selectedDeletionIds.map((id) => deletionSelectionMeta[id]).filter(Boolean),
    [deletionSelectionMeta, selectedDeletionIds]
  );

  const selectedEligibleDeletionCount = useMemo(
    () => selectedDeletionRows.filter((row) => row.eligible).length,
    [selectedDeletionRows]
  );

  const handleEligibleDropdownSelection = useCallback((event) => {
    const selectedIds = Array.from(event.target.selectedOptions || [])
      .map((option) => String(option.value || '').trim())
      .filter(Boolean);

    setSelectedDeletionIds((current) => {
      const preservedManualSelections = current.filter((id) => !eligibleDropdownIdSet.has(id));
      return [...new Set([...preservedManualSelections, ...selectedIds])];
    });
  }, [eligibleDropdownIdSet]);

  const handleToggleDeletionSelection = useCallback((id, eligible) => {
    if (!eligible) return;

    const normalizedId = String(id || '').trim();
    if (!normalizedId) return;

    setSelectedDeletionIds((current) => {
      if (current.includes(normalizedId)) {
        return current.filter((value) => value !== normalizedId);
      }
      return [...current, normalizedId];
    });
  }, []);

  const handleToggleSelectAllVisible = useCallback(() => {
    if (visibleEligibleIds.length === 0) return;

    setSelectedDeletionIds((current) => {
      const currentSet = new Set(current);
      const shouldSelectAll = visibleEligibleIds.some((id) => !currentSet.has(id));

      if (shouldSelectAll) {
        for (const id of visibleEligibleIds) currentSet.add(id);
      } else {
        for (const id of visibleEligibleIds) currentSet.delete(id);
      }

      return Array.from(currentSet);
    });
  }, [visibleEligibleIds]);

  const openDeletionConfirmModal = useCallback(() => {
    if (selectedDeletionIds.length === 0) {
      setDeletionToast({ type: 'error', message: 'Select at least one eligible patient account first.' });
      return;
    }

    if (selectedEligibleDeletionCount !== selectedDeletionIds.length) {
      setDeletionToast({
        type: 'error',
        message: 'Some selected accounts are no longer eligible. Refresh the list and select eligible rows only.',
      });
      return;
    }

    setDeletionConfirmCountdown(5);
    setDeletionConfirmModalOpen(true);
  }, [selectedDeletionIds.length, selectedEligibleDeletionCount]);

  const handleConfirmDeletePatients = useCallback(async () => {
    if (rateLimitedRef.current) return;
    if (selectedDeletionIds.length === 0) return;

    setDeletionSubmitting(true);
    try {
      const result = await deletePatients(selectedDeletionIds);
      setDeletionToast({
        type: 'success',
        message: result?.message || 'Selected patient accounts deleted successfully.',
      });
      setSelectedDeletionIds([]);
      setDeletionSelectionMeta({});
      setDeletionConfirmModalOpen(false);

      await Promise.allSettled([
        loadEligibleDropdownCandidates(),
        loadDeletionCandidates(),
        loadUsers(),
      ]);
    } catch (error) {
      if (isRateLimitedError(error)) {
        markRateLimited();
        return;
      }

      if (isConnectivityError(error)) {
        markNetworkError();
      }

      setDeletionToast({
        type: 'error',
        message: error?.message || 'Deletion failed and transaction was rolled back.',
      });
      setDeletionConfirmModalOpen(false);
    } finally {
      setDeletionSubmitting(false);
    }
  }, [
    loadDeletionCandidates,
    loadEligibleDropdownCandidates,
    loadUsers,
    markNetworkError,
    markRateLimited,
    selectedDeletionIds,
  ]);

  const refreshActiveTab = useCallback(() => {
    if (rateLimitedRef.current) return;

    const remainingMs = getTabRefetchRemainingMs(activeTab);
    if (remainingMs > 0) {
      showRefetchCooldown(remainingMs);
      return;
    }

    markTabRefetch(activeTab);

    if (activeTab === 'patients-list') {
      void loadUsers();
      return;
    }

    if (activeTab === 'account-actions') {
      void Promise.allSettled([
        loadEligibleDropdownCandidates(),
        loadDeletionCandidates(),
      ]);
      return;
    }

    void Promise.allSettled([
      loadTokenCount(),
      loadActiveUsersInHours(activeUsersWindowHours),
      loadSessionsPage(sessionOffset, sessionLimit),
    ]);
  }, [
    activeTab,
    activeUsersWindowHours,
    getTabRefetchRemainingMs,
    loadActiveUsersInHours,
    loadDeletionCandidates,
    loadEligibleDropdownCandidates,
    loadSessionsPage,
    loadTokenCount,
    loadUsers,
    markTabRefetch,
    sessionLimit,
    sessionOffset,
    showRefetchCooldown,
  ]);

  const retryAfterNetworkError = useCallback(() => {
    if (rateLimitedRef.current) return;
    setBanner(null);
    refreshActiveTab();
  }, [refreshActiveTab]);

  const openPatientDetail = useCallback(async (row) => {
    const normalizedPatient = {
      id: String(row.id || ''),
      name: row.name || '--',
      email: row.email || '--',
      branch: row.branch || '--',
      type: row.type || 'Unknown',
      userType: normalizeText(row.userType) === 'medical' ? 'medical' : 'patient',
      status: row.status || 'Unknown',
      inactiveExpiresAt: row.inactiveExpiresAt || null,
      lastLogin: row.lastLogin || null,
    };

    if (!normalizedPatient.id || normalizedPatient.id === '--') {
      return;
    }

    setSelectedPatient(normalizedPatient);
    setLoginHistoryRows([]);
    setLoginHistoryOffset(0);
    setLoginHistoryHasMore(false);
    setLoginHistoryError(null);
    await loadLoginHistory(normalizedPatient.id, 0, loginHistoryLimit);
  }, [loadLoginHistory, loginHistoryLimit]);

  const closePatientDetail = useCallback(() => {
    setSelectedPatient(null);
    setAccountActionConfirm(null);
    setLoginHistoryRows([]);
    setLoginHistoryOffset(0);
    setLoginHistoryHasMore(false);
    setLoginHistoryError(null);
    setLoginHistoryLoading(false);
    setLockingAccount(false);
    setSettingSuperior(false);
    setSuperiorActionUserId(null);
  }, []);

  const handleToggleLockAccount = useCallback(async () => {
    if (rateLimitedRef.current) return;
    if (!selectedPatient?.id) return;

    const currentlyLocked = getStatusKey(selectedPatient.status) === 'locked';
    const nextLocked = !currentlyLocked;

    setLockingAccount(true);
    setLoginHistoryError(null);

    try {
      await setUserAccountLocked(String(selectedPatient.id), nextLocked);

      setSelectedPatient((current) => {
        if (!current) return current;
        return {
          ...current,
          status: nextLocked ? 'Locked' : 'Active',
        };
      });

      setUsers((currentRows) => currentRows.map((currentRow) => {
        if (currentRow.id !== String(selectedPatient.id)) return currentRow;
        return {
          ...currentRow,
          status: nextLocked ? 'Locked' : 'Active',
        };
      }));
    } catch (error) {
      if (isRateLimitedError(error)) {
        markRateLimited();
        return;
      }

      if (isConnectivityError(error)) {
        markNetworkError();
      }

      setLoginHistoryError(error?.message || 'Failed to update account lock status.');
    } finally {
      setLockingAccount(false);
    }
  }, [markNetworkError, markRateLimited, selectedPatient]);

  const applySuperiorTypeToState = useCallback((targetUserId, superiorEnabled) => {
    const normalizedUserId = String(targetUserId || '');
    const nextType = superiorEnabled ? 'Superior' : 'Employee';

    setUsers((currentRows) => currentRows.map((currentRow) => {
      if (String(currentRow.id) !== normalizedUserId) return currentRow;
      return {
        ...currentRow,
        type: nextType,
      };
    }));

    setSelectedPatient((current) => {
      if (!current) return current;
      if (String(current.id) !== normalizedUserId) return current;
      return {
        ...current,
        type: nextType,
      };
    });
  }, []);

  const handleSetSuperiorAccount = useCallback(async () => {
    if (rateLimitedRef.current) return;
    if (!selectedPatient?.id) return;

    const normalizedUserId = String(selectedPatient.id);
    const nextSuperior = normalizeText(selectedPatient.type) !== 'superior';

    setSettingSuperior(true);
    setSuperiorActionUserId(normalizedUserId);
    setLoginHistoryError(null);

    try {
      await setUserSuperiorStatus(normalizedUserId, nextSuperior);
      applySuperiorTypeToState(normalizedUserId, nextSuperior);
    } catch (error) {
      if (isRateLimitedError(error)) {
        markRateLimited();
        return;
      }

      if (isConnectivityError(error)) {
        markNetworkError();
      }

      setLoginHistoryError(error?.message || 'Failed to update Superior role.');
    } finally {
      setSettingSuperior(false);
      setSuperiorActionUserId(null);
    }
  }, [applySuperiorTypeToState, markNetworkError, markRateLimited, selectedPatient]);

  const openSessionDetail = useCallback(async (row) => {
    const normalizedUser = {
      id: String(row.userId || ''),
      name: row.email || `User ${row.userId}`,
      email: row.email || '--',
    };

    if (!normalizedUser.id || normalizedUser.id === '--') {
      return;
    }

    setSelectedSessionUser(normalizedUser);
    setUserSessionOffset(0);
    setUserSessionHasMore(false);
    setUserSessionRows([]);
    setUserSessionsError(null);
    setSessionToastMessage(null);
    await loadUserSessions(normalizedUser.id, 0, userSessionLimit);
  }, [loadUserSessions, userSessionLimit]);

  const handleRevokeSession = useCallback(async (row) => {
    if (rateLimitedRef.current) return;
    if (!selectedSessionUser?.id || !row?.deviceId) return;

    setRevokingSessionRowId(row.rowId);
    setUserSessionsError(null);

    try {
      const shouldRevoke = getStatusKey(row.status) !== 'revoked';
      await setUserSessionRevoked(String(selectedSessionUser.id), String(row.deviceId), shouldRevoke);

      setUserSessionRows((currentRows) => currentRows.map((currentRow) => {
        if (currentRow.rowId !== row.rowId) return currentRow;
        return {
          ...currentRow,
          status: shouldRevoke ? 'revoked' : 'active',
          updatedAt: new Date().toISOString(),
        };
      }));

      setSessionToastMessage(shouldRevoke ? 'Session revoked successfully.' : 'Session unrevoked successfully.');
    } catch (error) {
      if (isRateLimitedError(error)) {
        markRateLimited();
        return;
      }

      if (isConnectivityError(error)) {
        markNetworkError();
      }

      setUserSessionsError(error?.message || 'Failed to update this session ticket.');
    } finally {
      setRevokingSessionRowId(null);
    }
  }, [
    markNetworkError,
    markRateLimited,
    selectedSessionUser,
  ]);

  const handleBulkSessionAction = useCallback(async (revoked) => {
    if (rateLimitedRef.current) return;
    if (!selectedSessionUser?.id) return;

    const shouldRevoke = Boolean(revoked);
    const targetStatus = shouldRevoke ? 'revoked' : 'active';
    const hasRowsToChange = userSessionRows.some((row) => getStatusKey(row.status) !== targetStatus);

    if (!hasRowsToChange) {
      setSessionToastMessage(shouldRevoke ? 'All sessions are already revoked.' : 'All sessions are already active.');
      return;
    }

    setBulkSessionAction(shouldRevoke ? 'revoke' : 'unrevoke');
    setUserSessionsError(null);

    try {
      const result = await setAllUserSessionsRevoked(String(selectedSessionUser.id), shouldRevoke);

      setUserSessionRows((currentRows) => currentRows.map((currentRow) => {
        const currentStatus = getStatusKey(currentRow.status);
        if (!['active', 'revoked'].includes(currentStatus)) return currentRow;

        return {
          ...currentRow,
          status: targetStatus,
          updatedAt: new Date().toISOString(),
        };
      }));

      setSessionToastMessage(result?.message || (shouldRevoke
        ? 'All sessions revoked successfully.'
        : 'All sessions unrevoked successfully.'));
    } catch (error) {
      if (isRateLimitedError(error)) {
        markRateLimited();
        return;
      }

      if (isConnectivityError(error)) {
        markNetworkError();
      }

      setUserSessionsError(error?.message || 'Failed to update all session tickets.');
    } finally {
      setBulkSessionAction(null);
    }
  }, [markNetworkError, markRateLimited, selectedSessionUser, userSessionRows]);

  const handleApplySemestralInactivation = useCallback(async () => {
    if (rateLimitedRef.current) return;

    const identities = resolveSemestralTargetIdentities(semestralTarget);

    const payload = semestralScopeType === 'branch'
      ? { branch: semestralScopeValue, department: null, identities }
      : { branch: null, department: semestralScopeValue, identities };

    const normalizedBranch = typeof payload.branch === 'string' ? payload.branch.trim() : '';
    const normalizedDepartment = typeof payload.department === 'string' ? payload.department.trim() : '';

    if (!normalizedBranch && !normalizedDepartment) {
      setSemestralNotice({ type: 'error', message: 'Please select a branch or provide a department.' });
      return;
    }

    setSemestralPreviewLoading(true);
    setSemestralNotice(null);

    let preview;
    try {
      preview = await previewSemestralInactivation(payload);
      setSemestralPreview(preview);
    } catch (error) {
      if (isRateLimitedError(error)) {
        markRateLimited();
        return;
      }

      if (isConnectivityError(error)) {
        markNetworkError();
      }

      setSemestralNotice({ type: 'error', message: error?.message || 'Failed to preview semestral impact.' });
      return;
    } finally {
      setSemestralPreviewLoading(false);
    }

    const scopedCount = Number(preview?.scopedCount) || 0;
    const willUpdateCount = Number(preview?.willUpdateCount) || 0;

    if (scopedCount === 0) {
      setSemestralNotice({ type: 'warning', message: preview?.message || 'No matching accounts found for the selected scope.' });
      return;
    }

    setSemestralNotice({
      type: 'warning',
      message: `Warning: ${willUpdateCount} of ${scopedCount} scoped account(s) will be set to Inactive.`,
    });

    const scopeLabel = normalizedBranch || normalizedDepartment;
    const scopeTypeLabel = normalizedBranch ? 'branch' : 'department';
    const targetLabel = semestralTarget === 'students'
      ? 'Student'
      : (semestralTarget === 'employees' ? 'Employee' : 'Student and Employee');

    setSemestralReviewModal({
      payload,
      scopedCount,
      willUpdateCount,
      scopeLabel,
      scopeTypeLabel,
      targetLabel,
    });
  }, [
    markNetworkError,
    markRateLimited,
    semestralScopeType,
    semestralScopeValue,
    semestralTarget,
  ]);

  const handleConfirmSemestralInactivation = useCallback(async () => {
    if (!semestralReviewModal?.payload) return;
    if (rateLimitedRef.current) return;

    setSemestralApplying(true);

    try {
      const result = await applySemestralInactivation(semestralReviewModal.payload);
      setSemestralNotice({ type: 'success', message: result?.message || 'Semestral action applied successfully.' });
      await loadUsers();
      setSemestralReviewModal(null);
    } catch (error) {
      if (isRateLimitedError(error)) {
        markRateLimited();
        return;
      }

      if (isConnectivityError(error)) {
        markNetworkError();
      }

      setSemestralNotice({ type: 'error', message: error?.message || 'Failed to apply semestral inactivation.' });
    } finally {
      setSemestralApplying(false);
    }
  }, [
    loadUsers,
    markNetworkError,
    markRateLimited,
    semestralReviewModal,
  ]);

  const closeUserDetail = useCallback(() => {
    setSelectedSessionUser(null);
    setUserSessionRows([]);
    setUserSessionOffset(0);
    setUserSessionHasMore(false);
    setUserSessionsError(null);
    setUserSessionsLoading(false);
    setRevokingSessionRowId(null);
    setBulkSessionAction(null);
    setSessionToastMessage(null);
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
          <button
            type="button"
            onClick={() => setActiveTab('account-actions')}
            aria-pressed={activeTab === 'account-actions'}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'account-actions'
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'
            }`}
          >
            Account Actions
          </button>
        </div>

        <button
          type="button"
          onClick={refreshActiveTab}
          disabled={isRateLimited}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={`Refresh ${
            activeTab === 'patients-list'
              ? 'patients list'
              : activeTab === 'active-sessions'
                ? 'active sessions'
                : 'account actions'
          }`}
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
                disabled={usersLoading || sessionsLoading || tokenCountLoading || activeUsersLoading}
                className="px-2.5 py-1 text-xs rounded border border-warning-300 dark:border-warning-700 text-warning-700 dark:text-warning-300 hover:bg-warning-100 dark:hover:bg-warning-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {deletionToast && (
        <div className="fixed top-4 right-4 z-50 max-w-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg px-3 py-2" role="status" aria-live="polite">
          <p className={`text-xs ${
            deletionToast.type === 'error'
              ? 'text-error-700 dark:text-error-300'
              : 'text-success-700 dark:text-success-300'
          }`}
          >
            {deletionToast.message}
          </p>
        </div>
      )}

      {activeTab === 'patients-list' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
              value={userStatusFilter}
              onChange={(event) => {
                const nextStatus = event.target.value;
                setUserStatusFilter(nextStatus);
                if (normalizeText(nextStatus) === 'unverified') {
                  setUserShowUnverified(true);
                }
              }}
              className="px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-secondary-700 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-secondary-600 dark:text-neutral-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={userShowUnverified}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setUserShowUnverified(checked);
                  if (!checked && normalizeText(userStatusFilter) === 'unverified') {
                    setUserStatusFilter('all');
                  }
                }}
                className="h-3.5 w-3.5 rounded border-neutral-300 dark:border-neutral-600 text-primary-600 focus:ring-primary-500"
              />
              Show unverified users
            </label>
          </div>

          <p className="text-xs text-secondary-500 dark:text-neutral-400">
            {userTotal} patient account{userTotal !== 1 ? 's' : ''} matched
          </p>

          {hasSuperiorUserInPage && (
            <div className="rounded-lg border border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20 px-3 py-2">
              <p className="text-xs text-primary-700 dark:text-primary-300">
                Superior account detected in this result set. Superior users remain protected by stricter permission checks.
              </p>
            </div>
          )}

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
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Account Status</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Last Login</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userPageRows.map((row) => {
                        const statusKey = getStatusKey(row.status);
                        const isLocked = statusKey === 'locked';
                        const isSuperior = normalizeText(row.type) === 'superior';

                        return (
                          <tr
                            key={row.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              void openPatientDetail(row);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                void openPatientDetail(row);
                              }
                            }}
                            aria-label={`Open account details for user ${row.id}`}
                            className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer"
                          >
                            <td className="py-2.5 px-3 text-xs font-medium text-secondary-900 dark:text-white">{row.name}</td>
                            <td className="py-2.5 px-3 text-xs text-secondary-500 dark:text-neutral-400">{row.email}</td>
                            <td className="py-2.5 px-3 text-xs text-secondary-600 dark:text-neutral-300">{row.branch}</td>
                            <td className="py-2.5 px-3 text-xs text-secondary-600 dark:text-neutral-300">{row.type}</td>
                            <td className="py-2.5 px-3">
                              <div className="space-y-1">
                                <div className="inline-flex flex-wrap items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 text-xs text-secondary-700 dark:text-neutral-200">
                                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT_CLASS[statusKey] || STATUS_DOT_CLASS.unknown}`} />
                                    {formatStatusLabel(row.status)}
                                  </span>
                                  {isLocked && (
                                    <span className="inline-flex items-center rounded-full border border-error-300 dark:border-error-700 px-1.5 py-0.5 text-[10px] font-medium text-error-700 dark:text-error-300">
                                      Locked
                                    </span>
                                  )}
                                  {isSuperior && (
                                    <span className="inline-flex items-center rounded-full border border-primary-300 dark:border-primary-700 px-1.5 py-0.5 text-[10px] font-medium text-primary-700 dark:text-primary-300">
                                      Superior
                                    </span>
                                  )}
                                </div>
                                {statusKey === 'inactive' && (
                                  <p className="text-[10px] text-secondary-500 dark:text-neutral-400">
                                    Update window ends: {formatDateTime(row.inactiveExpiresAt)}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-xs text-secondary-500 dark:text-neutral-400">{formatDateTime(row.lastLogin)}</td>
                          </tr>
                        );
                      })}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 p-3">
              <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wide">Active Session Token</p>
              {tokenCountLoading ? (
                <div className="mt-2 w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              ) : tokenCountError ? (
                <p className="mt-2 text-xs text-error-600 dark:text-error-400">{tokenCountError}</p>
              ) : (
                <p className="mt-1 text-2xl font-bold text-secondary-900 dark:text-white">{tokenCount}</p>
              )}
            </div>

            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wide">Max Total Active Users in {formatWindowLabel(activeUsersWindowHours)}</p>
                <label htmlFor="active-users-days" className="sr-only">Active user day window</label>
                <select
                  id="active-users-days"
                  value={activeUsersWindowHours}
                  onChange={(event) => setActiveUsersWindowHours(Number(event.target.value))}
                  disabled={activeUsersLoading || isRateLimited}
                  className="px-2 py-1 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-secondary-700 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {ACTIVE_USER_WINDOW_OPTIONS.map((option) => (
                    <option key={option} value={option}>{formatWindowLabel(option)}</option>
                  ))}
                </select>
              </div>

              {activeUsersLoading ? (
                <div className="mt-2 w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              ) : activeUsersError ? (
                <p className="mt-2 text-xs text-error-600 dark:text-error-400">{activeUsersError}</p>
              ) : (
                <p className="mt-1 text-2xl font-bold text-secondary-900 dark:text-white">{activeUsersCount}</p>
              )}
            </div>

            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 p-3">
              <p className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wide">Access Mode</p>
              <p className="mt-1 text-sm font-semibold text-secondary-900 dark:text-white">Monitoring and session control</p>
              <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-1">
                Open a user row to review device tickets and revoke individual sessions.
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

      {activeTab === 'account-actions' && (
        <div className="space-y-4">
          <div className="space-y-3">
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 p-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-secondary-900 dark:text-white">Semestral Credential Action</p>
                  <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-1">
                    Set all Student and Employee accounts in a selected scope to Inactive.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <select
                    value={semestralScopeType}
                    onChange={(event) => setSemestralScopeType(event.target.value)}
                    disabled={semestralApplying || semestralPreviewLoading || isRateLimited}
                    className="px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-secondary-700 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="branch">Branch Scope</option>
                    <option value="department">Department Scope</option>
                  </select>

                  {semestralScopeType === 'branch' ? (
                    <select
                      value={semestralScopeValue}
                      onChange={(event) => setSemestralScopeValue(event.target.value)}
                      disabled={semestralApplying || semestralPreviewLoading || isRateLimited}
                      className="px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-secondary-700 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {SEMESTRAL_BRANCH_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={semestralScopeValue}
                      onChange={(event) => setSemestralScopeValue(event.target.value)}
                      placeholder="Enter employee department"
                      disabled={semestralApplying || semestralPreviewLoading || isRateLimited}
                      className="px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-secondary-700 dark:text-neutral-300 placeholder:text-secondary-400 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  )}

                  <select
                    value={semestralTarget}
                    onChange={(event) => setSemestralTarget(event.target.value)}
                    disabled={semestralApplying || semestralPreviewLoading || isRateLimited}
                    className="px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-secondary-700 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {SEMESTRAL_TARGET_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      void handleApplySemestralInactivation();
                    }}
                    disabled={semestralApplying || semestralPreviewLoading || isRateLimited}
                    className="px-3 py-2 text-xs font-medium rounded border border-warning-300 dark:border-warning-700 text-warning-700 dark:text-warning-300 hover:bg-warning-50 dark:hover:bg-warning-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {semestralApplying ? 'Applying...' : (semestralPreviewLoading ? 'Reviewing...' : 'Set Accounts to Inactive')}
                  </button>
                </div>
              </div>

              {semestralPreview && (
                <div className="rounded-lg border border-warning-300 dark:border-warning-700 bg-warning-50 dark:bg-warning-900/20 px-3 py-2">
                  <p className="text-xs font-medium text-warning-700 dark:text-warning-300">Impact Preview</p>
                  <p className="text-xs text-warning-700 dark:text-warning-300 mt-1">
                    {Number(semestralPreview.willUpdateCount) || 0} of {Number(semestralPreview.scopedCount) || 0} scoped account(s) will be updated to Inactive.
                  </p>
                </div>
              )}

              {semestralNotice && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`rounded-lg border px-3 py-2 ${
                    semestralNotice.type === 'error'
                      ? 'border-error-300 dark:border-error-700 bg-error-50 dark:bg-error-900/20'
                      : semestralNotice.type === 'warning'
                        ? 'border-warning-300 dark:border-warning-700 bg-warning-50 dark:bg-warning-900/20'
                      : 'border-success-300 dark:border-success-700 bg-success-50 dark:bg-success-900/20'
                  }`}
                >
                  <p className={`text-xs ${
                    semestralNotice.type === 'error'
                      ? 'text-error-700 dark:text-error-300'
                      : semestralNotice.type === 'warning'
                        ? 'text-warning-700 dark:text-warning-300'
                      : 'text-success-700 dark:text-success-300'
                  }`}
                  >
                    {semestralNotice.message}
                  </p>
                </div>
              )}
          </div>

          <div className="space-y-3">
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 p-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-secondary-900 dark:text-white">Account Delete Action</p>
                  <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-1">
                    Inactive patient accounts older than 1 year are auto-listed below. Locked accounts must be searched manually using the search bar.
                  </p>
                </div>

                <div className="flex flex-wrap items-stretch gap-2">
                  <input
                    type="text"
                    value={deletionSearch}
                    onChange={(event) => setDeletionSearch(event.target.value)}
                    placeholder="Search locked/inactive by name, email, or user ID"
                    disabled={deletionLoading || deletionSubmitting || isRateLimited}
                    className="flex-1 min-w-[240px] px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-secondary-700 dark:text-neutral-300 placeholder:text-secondary-400 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      void loadDeletionCandidates();
                    }}
                    disabled={deletionLoading || deletionSubmitting || isRateLimited}
                    className="px-3 py-2 text-xs font-medium whitespace-nowrap rounded border border-neutral-300 dark:border-neutral-600 text-secondary-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletionLoading ? 'Searching...' : 'Search Candidates'}
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleSelectAllVisible}
                    disabled={visibleEligibleIds.length === 0 || deletionLoading || deletionSubmitting || isRateLimited}
                    className="px-3 py-2 text-xs whitespace-nowrap rounded border border-neutral-200 dark:border-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {allVisibleEligibleSelected ? 'Unselect Visible Eligible' : 'Select Visible Eligible'}
                  </button>

                  <button
                    type="button"
                    onClick={openDeletionConfirmModal}
                    disabled={deletionSubmitting || selectedEligibleDeletionCount === 0 || isRateLimited}
                    className="px-3 py-2 text-xs font-medium whitespace-nowrap rounded border border-error-300 dark:border-error-700 text-error-700 dark:text-error-300 hover:bg-error-50 dark:hover:bg-error-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletionSubmitting
                      ? 'Deleting...'
                      : `Delete Selected Accounts (${selectedEligibleDeletionCount})`}
                  </button>
                </div>

                <div className="space-y-1">
                  <label htmlFor="auto-eligible-patient-dropdown" className="text-xs font-medium text-secondary-700 dark:text-neutral-200">
                    Eligible Inactive Accounts (Auto-listed)
                  </label>
                  <select
                    id="auto-eligible-patient-dropdown"
                    multiple
                    value={selectedEligibleDropdownIds}
                    onChange={handleEligibleDropdownSelection}
                    disabled={eligibleDropdownLoading || deletionSubmitting || isRateLimited}
                    className="w-full min-h-[112px] max-h-48 px-2 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-secondary-700 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {eligibleDropdownRows.map((row) => (
                      <option key={row.id} value={row.id}>
                        {`${row.name} (${row.email}) - ${formatDateTime(row.updatedAt)}`}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-secondary-500 dark:text-neutral-400">
                    Hold Ctrl (Windows/Linux) or Command (macOS) to select multiple accounts.
                  </p>
                </div>

                <p className="text-xs text-secondary-500 dark:text-neutral-400">
                  Deletion rules: Inactive accounts are eligible when updated_at + 1 year &lt; now. Locked accounts can be deleted once manually searched and selected.
                </p>
              </div>

              {deletionError && (
                <div className="rounded-lg border border-error-300 dark:border-error-700 bg-error-50 dark:bg-error-900/20 px-3 py-2">
                  <p className="text-xs text-error-700 dark:text-error-300">{deletionError}</p>
                </div>
              )}

              {deletionLoading ? (
                <div className="py-12 text-center">
                  <div className="w-6 h-6 mx-auto border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-xs text-secondary-400 dark:text-neutral-500">Loading deletion candidates...</p>
                </div>
              ) : deletionRows.length === 0 ? (
                <div className="py-12 text-center border border-neutral-200 dark:border-neutral-700 rounded-lg">
                  <p className="text-xs text-secondary-500 dark:text-neutral-400">No matching deletion candidates found for the current search.</p>
                </div>
              ) : (
                <>
                  <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                    <div className="max-h-[420px] overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                            <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Select</th>
                            <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Name</th>
                            <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Email</th>
                            <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Branch</th>
                            <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Type</th>
                            <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Status</th>
                            <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Updated At</th>
                            <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Eligibility</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deletionRows.map((row) => {
                            const statusKey = getStatusKey(row.status);
                            const isLocked = statusKey === 'locked';

                            return (
                              <tr
                                key={row.id}
                                className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                              >
                                <td className="py-2.5 px-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedDeletionIdSet.has(row.id)}
                                    disabled={!row.eligible || deletionSubmitting || isRateLimited}
                                    onChange={() => handleToggleDeletionSelection(row.id, row.eligible)}
                                    className="h-3.5 w-3.5 rounded border-neutral-300 dark:border-neutral-600 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                                    aria-label={`Select patient ${row.name}`}
                                  />
                                </td>
                                <td className="py-2.5 px-3 text-xs font-medium text-secondary-900 dark:text-white">{row.name}</td>
                                <td className="py-2.5 px-3 text-xs text-secondary-500 dark:text-neutral-400">{row.email}</td>
                                <td className="py-2.5 px-3 text-xs text-secondary-600 dark:text-neutral-300">{row.branch}</td>
                                <td className="py-2.5 px-3 text-xs text-secondary-600 dark:text-neutral-300">{row.type}</td>
                                <td className="py-2.5 px-3">
                                  <span className="inline-flex items-center gap-1 text-xs text-secondary-700 dark:text-neutral-200">
                                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT_CLASS[statusKey] || STATUS_DOT_CLASS.unknown}`} />
                                    {formatStatusLabel(row.status)}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-xs text-secondary-500 dark:text-neutral-400">{formatDateTime(row.updatedAt)}</td>
                                <td className="py-2.5 px-3">
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                    isLocked
                                      ? 'border border-warning-300 dark:border-warning-700 text-warning-700 dark:text-warning-300 bg-warning-50 dark:bg-warning-900/20'
                                      : 'border border-success-300 dark:border-success-700 text-success-700 dark:text-success-300 bg-success-50 dark:bg-success-900/20'
                                  }`}
                                  >
                                    {isLocked ? 'Locked (manual search)' : 'Inactive > 1 year'}
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
                    <p className="text-xs text-secondary-500 dark:text-neutral-400">{deletionRangeLabel}</p>

                    <div className="flex items-center gap-2">
                      <label htmlFor="patient-deletion-page-size" className="text-xs text-secondary-500 dark:text-neutral-400">Rows</label>
                      <select
                        id="patient-deletion-page-size"
                        value={deletionPageSize}
                        onChange={(event) => setDeletionPageSize(Number(event.target.value))}
                        disabled={deletionLoading || deletionSubmitting || isRateLimited}
                        className="px-2 py-1 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-secondary-700 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {PATIENT_DELETION_PAGE_SIZE_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => setDeletionPage((currentPage) => Math.max(1, currentPage - 1))}
                        disabled={deletionPage <= 1 || deletionLoading || deletionSubmitting || isRateLimited}
                        className="px-2.5 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletionPage((currentPage) => Math.min(deletionTotalPages, currentPage + 1))}
                        disabled={deletionPage >= deletionTotalPages || deletionLoading || deletionSubmitting || isRateLimited}
                        className="px-2.5 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
          </div>
        </div>
      )}

      {semestralReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="semestral-review-title">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!semestralApplying) {
                setSemestralReviewModal(null);
              }
            }}
            aria-hidden="true"
          />

          <div className="relative w-full max-w-lg rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl">
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
              <h3 id="semestral-review-title" className="text-sm font-semibold text-secondary-900 dark:text-white">Review Semestral Action</h3>
              <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-1">
                Please review the impact before applying this bulk credential update.
              </p>
            </div>

            <div className="px-4 py-3 space-y-2">
              <p className="text-xs text-secondary-700 dark:text-neutral-200">
                <span className="font-medium">Scope:</span> {semestralReviewModal.scopeTypeLabel} "{semestralReviewModal.scopeLabel}"
              </p>
              <p className="text-xs text-secondary-700 dark:text-neutral-200">
                <span className="font-medium">Target:</span> {semestralReviewModal.targetLabel}
              </p>
              <div className="rounded border border-warning-300 dark:border-warning-700 bg-warning-50 dark:bg-warning-900/20 px-3 py-2">
                <p className="text-xs text-warning-700 dark:text-warning-300">
                  {semestralReviewModal.willUpdateCount} of {semestralReviewModal.scopedCount} scoped account(s) will be set to Inactive.
                </p>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSemestralReviewModal(null)}
                disabled={semestralApplying}
                className="px-3 py-1.5 text-xs rounded border border-neutral-200 dark:border-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleConfirmSemestralInactivation();
                }}
                disabled={semestralApplying}
                className="px-3 py-1.5 text-xs rounded border border-warning-300 dark:border-warning-700 text-warning-700 dark:text-warning-300 hover:bg-warning-50 dark:hover:bg-warning-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {semestralApplying ? 'Applying...' : 'Confirm and Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletionConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="patient-delete-confirm-title">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!deletionSubmitting) {
                setDeletionConfirmModalOpen(false);
              }
            }}
            aria-hidden="true"
          />

          <div className="relative w-full max-w-lg rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl">
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
              <h3 id="patient-delete-confirm-title" className="text-sm font-semibold text-secondary-900 dark:text-white">Confirm Patient Account Deletion</h3>
              <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-1">
                This action permanently deletes selected patient accounts and all related records.
              </p>
            </div>

            <div className="px-4 py-3 space-y-2">
              <p className="text-xs text-secondary-700 dark:text-neutral-200">
                <span className="font-medium">Selected accounts:</span> {selectedDeletionIds.length}
              </p>
              <p className="text-xs text-secondary-700 dark:text-neutral-200">
                <span className="font-medium">Eligibility rule:</span> status = Locked OR (status = Inactive and updated_at + 1 year &lt; now)
              </p>
              <p className="text-xs text-warning-700 dark:text-warning-300">
                Safety timer: confirm button unlocks in {deletionConfirmCountdown}s.
              </p>
              <div className="rounded border border-error-300 dark:border-error-700 bg-error-50 dark:bg-error-900/20 px-3 py-2">
                <p className="text-xs text-error-700 dark:text-error-300">
                  If any selected account fails validation, the transaction is rolled back and no account will be deleted.
                </p>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletionConfirmModalOpen(false)}
                disabled={deletionSubmitting}
                className="px-3 py-1.5 text-xs rounded border border-neutral-200 dark:border-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleConfirmDeletePatients();
                }}
                disabled={deletionSubmitting || deletionConfirmCountdown > 0}
                className="px-3 py-1.5 text-xs rounded border border-error-300 dark:border-error-700 text-error-700 dark:text-error-300 hover:bg-error-50 dark:hover:bg-error-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletionSubmitting
                  ? 'Deleting...'
                  : deletionConfirmCountdown > 0
                    ? `Confirm in ${deletionConfirmCountdown}s`
                    : 'Delete Selected Accounts'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="patient-detail-title">
          <div className="absolute inset-0 bg-black/40" onClick={closePatientDetail} aria-hidden="true" />
          <div className="relative w-full max-w-5xl max-h-[85vh] overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-b border-neutral-200 dark:border-neutral-700">
              <div className="min-w-0">
                <div id="patient-detail-title" className="flex flex-col" style={{ gap: '2px' }}>
                  <h3 className="text-sm font-semibold text-secondary-900 dark:text-white" style={{ lineHeight: 1.2, margin: 0 }}>User Account Controls</h3>
                  <p className="text-[11px] font-medium text-secondary-500 dark:text-neutral-400" style={{ lineHeight: 1.2, margin: 0 }}>Login History</p>
                </div>
                <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-neutral-200 dark:border-neutral-700 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-[#F1C526] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                    {String(selectedPatient.name || '')
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()}
                  </div>
                  <p className="text-xs text-secondary-500 dark:text-neutral-400 truncate" style={{ lineHeight: 1.2, margin: 0 }}>
                    {selectedPatient.name} ({selectedPatient.email})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAccountActionConfirm({ type: 'lock' });
                  }}
                  disabled={lockingAccount || settingSuperior || isRateLimited}
                  className="px-2.5 py-1 text-xs rounded border border-warning-300 dark:border-warning-700 text-warning-700 dark:text-warning-300 hover:bg-warning-50 dark:hover:bg-warning-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {lockingAccount
                    ? 'Updating...'
                    : (getStatusKey(selectedPatient.status) === 'locked' ? 'Unlock Account' : 'Lock Account')}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAccountActionConfirm({ type: 'superior' });
                  }}
                  disabled={settingSuperior || lockingAccount || isRateLimited || superiorActionUserId === String(selectedPatient.id)}
                  className="px-2.5 py-1 text-xs rounded border border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {settingSuperior
                    ? 'Updating...'
                    : (normalizeText(selectedPatient.type) === 'superior' ? 'Unset Superior' : 'Set Superior')}
                </button>

                <button
                  type="button"
                  onClick={closePatientDetail}
                  className="px-2.5 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  aria-label="Close patient account details"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-3 overflow-auto max-h-[calc(85vh-64px)] space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-1.5">
                <div className="rounded border border-neutral-200 dark:border-neutral-700 px-2.5 py-1.5">
                  <p className="text-[11px] uppercase tracking-wide text-secondary-500 dark:text-neutral-400">Type</p>
                  <p className="text-xs font-medium text-secondary-900 dark:text-white mt-0.5">{selectedPatient.type}</p>
                </div>
                <div className="rounded border border-neutral-200 dark:border-neutral-700 px-2.5 py-1.5">
                  <p className="text-[11px] uppercase tracking-wide text-secondary-500 dark:text-neutral-400">Account Status</p>
                  <p className="text-xs font-medium text-secondary-900 dark:text-white mt-0.5">{formatStatusLabel(selectedPatient.status)}</p>
                  {getStatusKey(selectedPatient.status) === 'inactive' && (
                    <p className="text-[11px] text-secondary-500 dark:text-neutral-400 mt-0.5" style={{ lineHeight: 1.2, marginBottom: 0 }}>
                      Update window ends: {formatDateTime(selectedPatient.inactiveExpiresAt)}
                    </p>
                  )}
                </div>
                <div className="rounded border border-neutral-200 dark:border-neutral-700 px-2.5 py-1.5">
                  <p className="text-[11px] uppercase tracking-wide text-secondary-500 dark:text-neutral-400">Branch</p>
                  <p className="text-xs font-medium text-secondary-900 dark:text-white mt-0.5">{selectedPatient.branch}</p>
                </div>
                <div className="rounded border border-neutral-200 dark:border-neutral-700 px-2.5 py-1.5">
                  <p className="text-[11px] uppercase tracking-wide text-secondary-500 dark:text-neutral-400">Last Login</p>
                  <p className="text-xs font-medium text-secondary-900 dark:text-white mt-0.5">{formatDateTime(selectedPatient.lastLogin)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-secondary-900 dark:text-white">Login History</p>
                <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-0.5">Superior accounts are protected by stricter permission checks for non-admin staff.</p>
              </div>

              {loginHistoryError && (
                <div className="rounded border border-error-300 dark:border-error-700 bg-error-50 dark:bg-error-900/20 px-3 py-2">
                  <p className="text-xs text-error-700 dark:text-error-300">{loginHistoryError}</p>
                </div>
              )}

              {loginHistoryLoading ? (
                <div className="py-10 text-center">
                  <div className="w-6 h-6 mx-auto border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-xs text-secondary-400 dark:text-neutral-500">Loading login history...</p>
                </div>
              ) : loginHistoryRows.length === 0 ? (
                <div className="py-10 text-center border border-neutral-200 dark:border-neutral-700 rounded-lg">
                  <p className="text-xs text-secondary-500 dark:text-neutral-400">No login attempts found for this account.</p>
                </div>
              ) : (
                <>
                  <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                    <div className="overflow-auto">
                      <table className="w-full text-xs min-w-[760px]">
                        <thead>
                          <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
                            <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Timestamp</th>
                            <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">IP</th>
                            <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Device</th>
                            <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loginHistoryRows.map((attempt) => {
                            const attemptStatus = normalizeText(attempt.status) === 'success' ? 'active' : 'unknown';
                            return (
                              <tr key={attempt.rowId} className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0">
                                <td className="py-2 px-3 text-xs text-secondary-600 dark:text-neutral-300">{formatDateTime(attempt.timestamp)}</td>
                                <td className="py-2 px-3 text-xs font-mono text-secondary-600 dark:text-neutral-300">{attempt.ip}</td>
                                <td className="py-2 px-3 text-xs text-secondary-600 dark:text-neutral-300">{attempt.device}</td>
                                <td className="py-2 px-3">
                                  <span className="inline-flex items-center gap-1.5 text-xs text-secondary-700 dark:text-neutral-200">
                                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT_CLASS[attemptStatus] || STATUS_DOT_CLASS.unknown}`} />
                                    {attempt.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <p className="text-xs text-secondary-500 dark:text-neutral-400">{loginHistoryRangeLabel}</p>

                    <div className="flex items-center gap-2">
                      <label htmlFor="login-history-limit" className="text-xs text-secondary-500 dark:text-neutral-400">Rows</label>
                      <select
                        id="login-history-limit"
                        value={loginHistoryLimit}
                        onChange={(event) => {
                          const nextLimit = Number(event.target.value);
                          void loadLoginHistory(selectedPatient.id, 0, nextLimit);
                        }}
                        disabled={isRateLimited || loginHistoryLoading}
                        className="px-2 py-1 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-secondary-700 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {LOGIN_HISTORY_LIMIT_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          const nextOffset = Math.max(0, loginHistoryOffset - loginHistoryLimit);
                          void loadLoginHistory(selectedPatient.id, nextOffset, loginHistoryLimit);
                        }}
                        disabled={!canLoginHistoryPrev || loginHistoryLoading || isRateLimited}
                        className="px-2.5 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const nextOffset = loginHistoryOffset + loginHistoryLimit;
                          void loadLoginHistory(selectedPatient.id, nextOffset, loginHistoryLimit);
                        }}
                        disabled={!canLoginHistoryNext || loginHistoryLoading || isRateLimited}
                        className="px-2.5 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!accountActionConfirm}
        onClose={() => setAccountActionConfirm(null)}
        onConfirm={async () => {
          const actionType = accountActionConfirm?.type;
          setAccountActionConfirm(null);

          if (actionType === 'lock') {
            await handleToggleLockAccount();
            return;
          }

          if (actionType === 'superior') {
            await handleSetSuperiorAccount();
          }
        }}
        title={
          accountActionConfirm?.type === 'lock'
            ? `Verify ${getStatusKey(selectedPatient?.status) === 'locked' ? 'Unlock' : 'Lock'} Action`
            : `Verify ${normalizeText(selectedPatient?.type) === 'superior' ? 'Unset' : 'Set'} Superior`
        }
        message={
          accountActionConfirm?.type === 'lock'
            ? `Please verify: ${getStatusKey(selectedPatient?.status) === 'locked' ? 'unlock' : 'lock'} this account.`
            : `Please verify: ${normalizeText(selectedPatient?.type) === 'superior' ? 'unset' : 'set'} Superior for this account.`
        }
        description={selectedPatient ? `${selectedPatient.name} (${selectedPatient.email})` : 'Verify this action before continuing.'}
        confirmText={
          accountActionConfirm?.type === 'lock'
            ? `Verify & ${getStatusKey(selectedPatient?.status) === 'locked' ? 'Unlock' : 'Lock'}`
            : `Verify & ${normalizeText(selectedPatient?.type) === 'superior' ? 'Unset' : 'Set'} Superior`
        }
        cancelText="Cancel"
        variant={accountActionConfirm?.type === 'lock' ? 'danger' : 'primary'}
        isLoading={accountActionConfirm?.type === 'lock' ? lockingAccount : settingSuperior}
      />

      {selectedSessionUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="user-session-title">
          <div className="absolute inset-0 bg-black/40" onClick={closeUserDetail} aria-hidden="true" />
          <div className="relative w-full max-w-5xl max-h-[85vh] overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
              <div>
                <h3 id="user-session-title" className="text-sm font-semibold text-secondary-900 dark:text-white">Active Tickets (Devices and Refresh Tokens)</h3>
                <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-0.5">{selectedSessionUser.name} ({selectedSessionUser.email})</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void loadUserSessions(selectedSessionUser.id, userSessionOffset, userSessionLimit);
                  }}
                  disabled={userSessionsLoading || bulkSessionAction !== null || revokingSessionRowId !== null || isRateLimited}
                  className="px-2.5 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Refresh Tickets
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void handleBulkSessionAction(true);
                  }}
                  disabled={userSessionsLoading || bulkSessionAction !== null || revokingSessionRowId !== null || isRateLimited}
                  className="px-2.5 py-1 text-xs rounded border border-error-300 dark:border-error-700 text-error-700 dark:text-error-300 hover:bg-error-50 dark:hover:bg-error-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkSessionAction === 'revoke' ? 'Revoking...' : 'Revoke All'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void handleBulkSessionAction(false);
                  }}
                  disabled={userSessionsLoading || bulkSessionAction !== null || revokingSessionRowId !== null || isRateLimited}
                  className="px-2.5 py-1 text-xs rounded border border-success-300 dark:border-success-700 text-success-700 dark:text-success-300 hover:bg-success-50 dark:hover:bg-success-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkSessionAction === 'unrevoke' ? 'Updating...' : 'Unrevoke All'}
                </button>

                <button
                  type="button"
                  onClick={closeUserDetail}
                  className="px-2.5 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  aria-label="Close user session details"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto max-h-[calc(85vh-64px)]">
              {sessionToastMessage && (
                <div className="mb-3 rounded border border-success-300 dark:border-success-700 bg-success-50 dark:bg-success-900/20 px-3 py-2" role="status" aria-live="polite">
                  <p className="text-xs text-success-700 dark:text-success-300">{sessionToastMessage}</p>
                </div>
              )}

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
                        void loadUserSessions(selectedSessionUser.id, userSessionOffset, userSessionLimit);
                      }}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      Retry
                    </button>
                  )}
                </div>
              ) : userSessionRows.length === 0 ? (
                <div className="py-10 text-center border border-neutral-200 dark:border-neutral-700 rounded-lg">
                  <p className="text-xs text-secondary-500 dark:text-neutral-400">No session tickets found for this user.</p>
                </div>
              ) : (
                <>
                  <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                    <div className="overflow-auto">
                      <table className="w-full text-xs min-w-[760px]">
                        <thead>
                          <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
                            <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Device ID</th>
                            <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Refresh Token</th>
                            <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Status</th>
                            <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Expiry</th>
                            <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userSessionRows.map((row) => {
                            const statusKey = getStatusKey(row.status);
                            const isRevoking = revokingSessionRowId === row.rowId;
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
                                <td className="py-2.5 px-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void handleRevokeSession(row);
                                    }}
                                    disabled={isRevoking || bulkSessionAction !== null || isRateLimited}
                                    className="px-2.5 py-1 text-xs rounded border border-error-300 dark:border-error-700 text-error-700 dark:text-error-300 hover:bg-error-50 dark:hover:bg-error-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label={`${getStatusKey(row.status) === 'revoked' ? 'Unrevoke' : 'Revoke'} session for device ${row.deviceId}`}
                                  >
                                    {isRevoking ? 'Updating...' : (getStatusKey(row.status) === 'revoked' ? 'Unrevoke' : 'Revoke')}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <p className="text-xs text-secondary-500 dark:text-neutral-400">{userSessionRangeLabel}</p>

                    <div className="flex items-center gap-2">
                      <label htmlFor="user-session-limit" className="text-xs text-secondary-500 dark:text-neutral-400">Rows</label>
                      <select
                        id="user-session-limit"
                        value={userSessionLimit}
                        onChange={(event) => {
                          const nextLimit = Number(event.target.value);
                          void loadUserSessions(selectedSessionUser.id, 0, nextLimit);
                        }}
                        disabled={isRateLimited || userSessionsLoading}
                        className="px-2 py-1 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-secondary-700 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {SESSION_LIMIT_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          const nextOffset = Math.max(0, userSessionOffset - userSessionLimit);
                          void loadUserSessions(selectedSessionUser.id, nextOffset, userSessionLimit);
                        }}
                        disabled={!canUserSessionPrev || userSessionsLoading || isRateLimited}
                        className="px-2.5 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const nextOffset = userSessionOffset + userSessionLimit;
                          void loadUserSessions(selectedSessionUser.id, nextOffset, userSessionLimit);
                        }}
                        disabled={!canUserSessionNext || userSessionsLoading || isRateLimited}
                        className="px-2.5 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
