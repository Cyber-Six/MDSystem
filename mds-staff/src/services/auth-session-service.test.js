jest.mock('../packages-core-adapter', () => ({ logout: jest.fn() }));
jest.mock('../hooks/use-staff-profile', () => ({ clearStaffProfileCache: jest.fn() }));

import { logout } from '../packages-core-adapter';
import { clearStaffProfileCache } from '../hooks/use-staff-profile';
import { clearStaffSessionArtifacts, logoutStaffSession } from './auth-session-service';

describe('staff session service', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('clears staff browser artifacts, profile cache, and caller tabs', () => {
    localStorage.setItem('mds_patient_tabs', 'tabs');
    localStorage.setItem('health-chat-read-timestamps', 'read');
    localStorage.setItem('health-chat-needs-reply', 'reply');
    sessionStorage.setItem('staff_notifications', 'notifications');
    sessionStorage.setItem('staff_seen_inventory_alerts', 'inventory');
    sessionStorage.setItem('staff_health_chat_badge_count', 'badge');
    const clearTabs = jest.fn();

    clearStaffSessionArtifacts({ clearTabs });

    expect(clearTabs).toHaveBeenCalledTimes(1);
    expect(clearStaffProfileCache).toHaveBeenCalledTimes(1);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  test('logs out without redirect when requested and broadcasts auth state', async () => {
    const dispatchEvent = jest.spyOn(window, 'dispatchEvent');
    logout.mockResolvedValue();

    await logoutStaffSession({ redirectToAuth: false, clearTabs: jest.fn() });

    expect(logout).toHaveBeenCalledWith(false);
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'mds:auth-changed' }));
  });

  test('contains logout errors while still sending the auth-state event', async () => {
    const error = new Error('logout failed');
    const dispatchEvent = jest.spyOn(window, 'dispatchEvent');
    logout.mockRejectedValue(error);

    await expect(logoutStaffSession({ redirectToAuth: false })).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith('Staff logout error:', error);
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'mds:auth-changed' }));
  });
});
