const STORAGE_PREFIX = 'mds:patient-record-draft:v2:';
const LEGACY_STORAGE_PREFIX = 'mds:patient-record-draft:v1:';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const VALID_USER_ID = /^[a-zA-Z0-9_-]{1,128}$/;

const clearLegacyDrafts = (sessionStore) => {
  if (!sessionStore) return;
  for (let index = sessionStore.length - 1; index >= 0; index -= 1) {
    const key = sessionStore.key(index);
    if (key?.startsWith(LEGACY_STORAGE_PREFIX)) sessionStore.removeItem(key);
  }
};

const getStorageKey = (flow, localStore) => {
  if (!/^[a-z0-9-]+$/i.test(flow)) return null;
  const refreshToken = localStore?.getItem('patient_refreshToken') || '';
  const userId = refreshToken.split(':')[0];
  if (!VALID_USER_ID.test(userId)) return null;
  return `${STORAGE_PREFIX}${userId}:${flow}`;
};

const getBrowserStorage = (name) => {
  try {
    return typeof window === 'undefined' ? null : window[name];
  } catch {
    return null;
  }
};

export const readRecordFormDraft = (flow, { localStore = getBrowserStorage('localStorage'), sessionStore = getBrowserStorage('sessionStorage'), now = Date.now() } = {}) => {
  try {
    clearLegacyDrafts(sessionStore);
    const key = getStorageKey(flow, localStore);
    if (!key || !sessionStore) return null;
    const raw = sessionStore.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (draft?.version !== 1 || !Number.isFinite(draft.savedAt) || now - draft.savedAt > DRAFT_TTL_MS || now < draft.savedAt || !draft.data || typeof draft.data !== 'object') {
      sessionStore.removeItem(key);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
};

export const saveRecordFormDraft = (flow, data, { localStore = getBrowserStorage('localStorage'), sessionStore = getBrowserStorage('sessionStorage'), now = Date.now() } = {}) => {
  try {
    clearLegacyDrafts(sessionStore);
    const key = getStorageKey(flow, localStore);
    if (!key || !sessionStore || !data || typeof data !== 'object') return false;
    sessionStore.setItem(key, JSON.stringify({ version: 1, savedAt: now, data }));
    return true;
  } catch {
    // Storage can be unavailable or full; the form remains usable without it.
    return false;
  }
};

export const clearRecordFormDraft = (flow, { localStore = getBrowserStorage('localStorage'), sessionStore = getBrowserStorage('sessionStorage') } = {}) => {
  try {
    const key = getStorageKey(flow, localStore);
    if (key && sessionStore) sessionStore.removeItem(key);
  } catch {
    // Ignore storage errors during cleanup.
  }
};

export const clearPatientRecordFormDrafts = (sessionStore = getBrowserStorage('sessionStorage')) => {
  try {
    if (!sessionStore) return;
    for (let index = sessionStore.length - 1; index >= 0; index -= 1) {
      const key = sessionStore.key(index);
      if (key?.startsWith(STORAGE_PREFIX) || key?.startsWith(LEGACY_STORAGE_PREFIX)) sessionStore.removeItem(key);
    }
  } catch {
    // Ignore storage errors during logout cleanup.
  }
};

export const RECORD_FORM_DRAFT_TTL_MS = DRAFT_TTL_MS;
