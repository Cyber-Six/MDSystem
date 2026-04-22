import { logout } from '../packages-core-adapter';

const INACTIVE_REACTIVATION_LOCK_LEGACY_KEY = 'patient_inactive_reactivation_lock';

export const clearPatientSessionArtifacts = () => {
  localStorage.removeItem('econsultation_session_id');
  sessionStorage.removeItem('econsultation_initialized');
  localStorage.removeItem('patient_role');
  localStorage.removeItem('patient_email');
  localStorage.removeItem(INACTIVE_REACTIVATION_LOCK_LEGACY_KEY);

  try {
    const refreshToken = localStorage.getItem('patient_refreshToken') || '';
    const [userId] = refreshToken.split(':');
    if (userId) {
      localStorage.removeItem(`${INACTIVE_REACTIVATION_LOCK_LEGACY_KEY}:${userId}`);
    }
  } catch {
    // Ignore storage parsing errors during logout cleanup.
  }
};

export const logoutPatientSession = async (redirectToAuth = true) => {
  try {
    clearPatientSessionArtifacts();
    await logout(redirectToAuth);
  } catch (error) {
    console.error('Logout error:', error);
    if (redirectToAuth) {
      window.location.assign('/auth');
    }
  }
};
