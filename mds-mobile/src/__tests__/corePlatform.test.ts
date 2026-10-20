/** @jest-environment node */
// Exercise the actual app adapter with Expo's native URL implementation rather
// than jsdom's window.location and synchronous browser storage.
const mockValues = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockValues.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { mockValues.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { mockValues.delete(key); }),
  },
}));

const originalURL = globalThis.URL;
const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
const originalDev = (globalThis as any).__DEV__;
let core: any;
beforeEach(() => {
  mockValues.clear();
  (globalThis as any).__DEV__ = false;
  // Expo SDK 54 installs this implementation during app initialization.
  globalThis.URL = require('whatwg-url-without-unicode').URL;
  (globalThis as any).window = globalThis;
  expect((globalThis as any).document).toBeUndefined();
  expect((globalThis as any).window.location).toBeUndefined();
});
afterEach(() => {
  core?.bannerService.destroy();
  (globalThis as any).__DEV__ = originalDev;
  globalThis.URL = originalURL;
  if (originalApiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
});

test.each([undefined, '', '   ', '  http://192.168.1.5:3000/api/  '])('mobile adapter supports API configuration %p without browser globals', async (configured) => {
  if (configured === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = configured;
  jest.isolateModules(() => { core = require('../core'); });
  const expectedBase = configured?.trim().replace(/\/+$/, '') || 'https://www.mdsystemtip.space';
  expect(core.axiosRequest.defaults.baseURL).toBe(expectedBase);
  await core.TokenStorage.setTokens('patient.payload.signature', '1:device:patient');
  const adapter = jest.fn(async (config: any) => ({ status: 200, config, data: {} }));
  const response = await core.axiosRequest.get('/auth/user', { adapter });
  expect(core.axiosRequest.getUri(response.config)).toBe(`${expectedBase}/auth/user`);
  expect(response.config.headers.Authorization).toBe('Bearer patient.payload.signature');
  expect(mockValues.has('patient_accessToken')).toBe(true);
  expect(mockValues.has('staff_accessToken')).toBe(false);
  const calls = adapter.mock.calls.length;
  await expect(core.axiosRequest.get('https://staff.mdsystemtip.space/auth/user', { adapter })).rejects.toThrow('configured API origin');
  expect(adapter).toHaveBeenCalledTimes(calls);
});
