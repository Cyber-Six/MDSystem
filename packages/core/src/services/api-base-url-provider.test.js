import { createApiBaseUrlProvider } from './api-base-url-provider';

describe('createApiBaseUrlProvider', () => {
  const provider = (hostname, portal) => createApiBaseUrlProvider({
    getHostname: () => hostname,
    getEnv: (key) => key === 'DEV_PORTAL' ? portal : undefined,
  });

  test.each([
    ['192.168.1.5', 'staff', 'staff.mdsystemtip.space'],
    ['192.168.1.5', 'www', 'www.mdsystemtip.space'],
    ['staff.mdsystemtip.space', 'staff', 'staff.mdsystemtip.space'],
    ['staff2.mdsystemtip.space', 'staff', 'staff.mdsystemtip.space'],
  ])('maps %s for %s portal to %s', (hostname, portal, expected) => {
    expect(provider(hostname, portal).getDevSubdomain()).toBe(expected);
  });
});
