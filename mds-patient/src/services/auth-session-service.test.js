jest.mock('../packages-core-adapter', () => ({ logout: jest.fn() }));

import { logout } from '../packages-core-adapter';
import { clearPatientSessionArtifacts, logoutPatientSession } from './auth-session-service';

describe('patient session cleanup', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('removes session data and both legacy lock keys', () => {
    localStorage.setItem('econsultation_session_id', 'session');
    sessionStorage.setItem('econsultation_initialized', 'true');
    localStorage.setItem('patient_role', 'Student');
    localStorage.setItem('patient_email', 'patient@example.test');
    localStorage.setItem('patient_inactive_reactivation_lock', 'old');
    localStorage.setItem('patient_refreshToken', 'user-1:token');
    localStorage.setItem('patient_inactive_reactivation_lock:user-1', 'new');

    clearPatientSessionArtifacts();

    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem('patient_refreshToken')).toBe('user-1:token');
    expect(sessionStorage).toHaveLength(0);
  });

  test('delegates successful logout with the redirect choice', async () => {
    logout.mockResolvedValue();
    await logoutPatientSession(false);
    expect(logout).toHaveBeenCalledWith(false);
  });

  test('logs logout failures and redirects only when requested', async () => {
    const error = new Error('logout failed');
    logout.mockRejectedValue(error);

    await logoutPatientSession(true);
    expect(console.error).toHaveBeenCalledWith('Logout error:', error);
    await logoutPatientSession(false);
    expect(logout).toHaveBeenLastCalledWith(false);
  });
});
