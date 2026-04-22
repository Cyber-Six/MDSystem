import { logout } from '../packages-core-adapter';
import { clearStaffProfileCache } from '../hooks/use-staff-profile';

const STAFF_LOCAL_KEYS_TO_CLEAR = [
  'mds_patient_tabs',
  'health-chat-read-timestamps',
  'health-chat-needs-reply',
];

const STAFF_SESSION_KEYS_TO_CLEAR = [
  'staff_notifications',
  'staff_seen_inventory_alerts',
  'staff_health_chat_badge_count',
];

export const clearStaffSessionArtifacts = ({ clearTabs } = {}) => {
  if (typeof clearTabs === 'function') {
    clearTabs();
  }

  clearStaffProfileCache();

  for (const key of STAFF_LOCAL_KEYS_TO_CLEAR) {
    localStorage.removeItem(key);
  }

  for (const key of STAFF_SESSION_KEYS_TO_CLEAR) {
    sessionStorage.removeItem(key);
  }
};

export const logoutStaffSession = async ({ redirectToAuth = true, clearTabs } = {}) => {
  try {
    clearStaffSessionArtifacts({ clearTabs });
    await logout(false);
  } catch (error) {
    console.error('Staff logout error:', error);
  } finally {
    try {
      window.dispatchEvent(new CustomEvent('mds:auth-changed', { detail: { userId: null } }));
    } catch {
      // Ignore event dispatch failures during logout.
    }

    if (redirectToAuth) {
      window.location.assign('/auth/login');
    }
  }
};