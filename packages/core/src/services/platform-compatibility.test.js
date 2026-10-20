/** @jest-environment node */
import axios, { AxiosError } from 'axios';
import { createAxiosRequestHandler } from './axios-request-handler';
import { createTokenService } from './token-service';
import { createApiBaseUrlProvider } from './api-base-url-provider';
import { createGoogleOAuthService } from './google-oauth-service';
import { createRecaptchaService } from './recaptcha-service';
import { normalizeApiBaseUrl } from '../internal/api-url';

const portals = [
  ['patient', 'https://www.mdsystemtip.space/dashboard', '', 'www.mdsystemtip.space'],
  ['staff', 'https://staff.mdsystemtip.space/dashboard', '', 'staff.mdsystemtip.space'],
  ['patient', 'https://www2.mdsystemtip.space/dashboard', '', 'www.mdsystemtip.space'],
  ['staff', 'https://staff2.mdsystemtip.space/dashboard', '', 'staff.mdsystemtip.space'],
  ['patient', 'http://localhost:5173/dashboard', '', 'www.mdsystemtip.space'],
  ['staff', 'http://localhost:5174/dashboard', '', 'staff.mdsystemtip.space'],
  ['staff', 'http://192.168.1.5:5174/dashboard', '', 'staff.mdsystemtip.space'],
  ['patient', null, '  https://www.mdsystemtip.space/  ', 'www.mdsystemtip.space'],
  ['patient', null, 'http://192.168.1.5:3000/', 'www.mdsystemtip.space'],
  ['patient', null, 'https://www.mdsystemtip.space/api/v1/', 'www.mdsystemtip.space'],
  ['staff', 'https://staff.mdsystemtip.space/dashboard', '/api/v1/', 'staff.mdsystemtip.space'],
];

const storage = () => {
  const values = new Map();
  return {
    values,
    getItem: jest.fn(async (key) => values.get(key) ?? null),
    setItem: jest.fn(async (key, value) => { values.set(key, value); }),
    removeItem: jest.fn(async (key) => { values.delete(key); }),
  };
};
const client = (base, tokens, forwardedHost) => createAxiosRequestHandler({
  getApiBaseUrl: () => base,
  getDevSubdomain: () => forwardedHost,
  tokenService: tokens,
  bannerConfig: { shouldShowBanner: () => false },
  requestLoggerForceEnabled: false,
});
const tokenService = (base, adapter, namespace = 'patient') => createTokenService({
  storage: adapter, tokenNamespace: namespace,
  navigator: { navigate: jest.fn() }, getApiBaseUrl: () => base,
});

afterEach(() => {
  delete global.window;
  jest.restoreAllMocks();
});

describe.each(portals)('%s client on %s with base %s', (portal, href, base, forwardedHost) => {
  test('uses the correct origin, portal header, token namespace, and normalized auth endpoints', async () => {
    if (href) global.window = { location: { href, hostname: new URL(href).hostname } };
    const store = storage();
    const tokens = tokenService(base, store, portal);
    await tokens.TokenStorage.setTokens(`${portal}.payload.signature`, '1:device:secret');
    const request = client(base, tokens, forwardedHost);
    const adapter = jest.fn(async (config) => ({ status: 200, data: {}, config }));
    const response = await request.get('/records', { adapter });
    const trusted = new URL(normalizeApiBaseUrl(base) || '/', href || undefined);
    expect(new URL(request.getUri(response.config), href || undefined).origin).toBe(trusted.origin);
    expect(response.config.headers.Authorization).toBe(`Bearer ${portal}.payload.signature`);
    expect(response.config.headers['X-Forwarded-Host']).toBe(forwardedHost);
    expect(store.values.has(`${portal}_accessToken`)).toBe(true);
    const absoluteUrl = new URL(request.getUri(response.config), href || undefined).href;
    await expect(request.get(absoluteUrl, { adapter })).resolves.toMatchObject({ status: 200 });
    if (href) {
      const provider = createApiBaseUrlProvider({
        getHostname: () => new URL(href).hostname,
        getEnv: () => portal === 'staff' ? 'staff' : 'www',
      });
      expect(provider.getDevSubdomain()).toBe(forwardedHost);
      expect(provider.getApiBaseUrl()).toBe('');
    }

    const post = jest.spyOn(axios, 'post').mockResolvedValue({ data: {
      ok: true, accessToken: 'rotated.payload.signature', refreshToken: '1:device:rotated',
    } });
    await tokens.refreshAccessToken();
    await tokens.logout(false);
    expect(post.mock.calls.map(([url]) => url)).toEqual([
      `${normalizeApiBaseUrl(base)}/auth/refresh`, `${normalizeApiBaseUrl(base)}/auth/logout`,
    ]);
    expect(store.values.size).toBe(0);
  });

  test('rejects cross-portal destinations and overrides before reading credentials or dispatching', async () => {
    if (href) global.window = { location: { href } };
    const tokens = { TokenStorage: { getAccessToken: jest.fn() } };
    const request = client(base, tokens, forwardedHost);
    const otherPortal = portal === 'staff' ? 'https://www.mdsystemtip.space' : 'https://staff.mdsystemtip.space';
    const adapter = jest.fn();
    for (const [url, config] of [
      [`${otherPortal}/records`, {}],
      ['/records', { baseURL: otherPortal }],
      ['//attacker.example/records', {}],
      ['https://www.mdsystemtip.space.attacker.example/records', {}],
    ]) {
      await expect(request.get(url, { ...config, adapter })).rejects.toThrow('configured API origin');
    }
    expect(tokens.TokenStorage.getAccessToken).not.toHaveBeenCalled();
    expect(adapter).not.toHaveBeenCalled();
  });
});

test('accepts absolute same-origin URLs and normalizes per-request base overrides', async () => {
  const tokens = { TokenStorage: { getAccessToken: async () => 'header.payload.signature' } };
  const request = client(' https://www.mdsystemtip.space/api/ ', tokens);
  const adapter = async (config) => ({ status: 200, config, data: {} });
  await expect(request.get('https://www.mdsystemtip.space/api/records', { adapter })).resolves.toMatchObject({ status: 200 });
  const result = await request.get('/records', { baseURL: ' https://www.mdsystemtip.space/api/ ', adapter });
  expect(request.getUri(result.config)).toBe('https://www.mdsystemtip.space/api/records');
});

test('does not refresh a refresh-endpoint 401 when a path prefix is configured', async () => {
  const tokens = { TokenStorage: { getAccessToken: async () => null }, refreshAccessToken: jest.fn() };
  const request = client('https://www.mdsystemtip.space/api/', tokens);
  const adapter = (config) => Promise.reject(new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, {}, { status: 401 }));
  await expect(request.post('/auth/refresh', {}, { adapter })).rejects.toThrow('Unauthorized');
  expect(tokens.refreshAccessToken).not.toHaveBeenCalled();
});

test.each(['ftp://www.mdsystemtip.space', '//www.mdsystemtip.space', 'api/v1', 'https:/bad', 'https://user:secret@www.mdsystemtip.space', 'https://www.mdsystemtip.space?token=secret', '/api#fragment', '/\\attacker.example', 42])('rejects malformed base URL %p before storage or HTTP access', (base) => {
  const store = storage();
  expect(() => tokenService(base, store)).toThrow('API base URL');
  expect(() => client(base, { TokenStorage: store })).toThrow('API base URL');
  expect(store.getItem).not.toHaveBeenCalled();
});

test('requires an absolute API URL when a browser location is unavailable', () => {
  expect(() => client('', {})).toThrow('absolute HTTP(S) API base URL');
  expect(() => client('/api', {})).toThrow('absolute HTTP(S) API base URL');
});

test('patient and staff tokens remain isolated even with one storage adapter', async () => {
  const store = storage();
  const patient = tokenService('https://www.mdsystemtip.space', store, 'patient');
  const staff = tokenService('https://staff.mdsystemtip.space', store, 'staff');
  await patient.TokenStorage.setTokens('patient.payload.signature', '1:device:patient');
  await staff.TokenStorage.setTokens('staff.payload.signature', '2:device:staff');
  await patient.TokenStorage.clearTokens();
  expect(await patient.isAuthenticated()).toBe(false);
  expect(await staff.isAuthenticated()).toBe(true);
});

test('native async storage rolls back a failed refresh write and keeps other portal sessions', async () => {
  const store = storage();
  const patient = tokenService('https://www.mdsystemtip.space/', store, 'patient');
  const staff = tokenService('https://staff.mdsystemtip.space/', store, 'staff');
  await patient.TokenStorage.setTokens('patient.payload.signature', '1:device:patient');
  await staff.TokenStorage.setTokens('staff.payload.signature', '2:device:staff');
  store.setItem.mockImplementationOnce(async (key, value) => { store.values.set(key, value); })
    .mockRejectedValueOnce(new Error('Async storage unavailable'));
  jest.spyOn(axios, 'post').mockResolvedValue({ data: {
    ok: true, accessToken: 'rotated.payload.signature', refreshToken: '1:device:rotated',
  } });
  await expect(patient.refreshAccessToken()).rejects.toThrow('Async storage unavailable');
  expect(await patient.isAuthenticated()).toBe(false);
  expect(await staff.isAuthenticated()).toBe(true);
});

test('native callers share an in-flight refresh and discard its result after a new login', async () => {
  const store = storage();
  const patient = tokenService('https://www.mdsystemtip.space', store);
  await patient.TokenStorage.setTokens('patient.payload.signature', '1:device:patient');
  let finish;
  let started;
  const dispatched = new Promise((resolve) => { started = resolve; });
  const post = jest.spyOn(axios, 'post').mockImplementation(() => new Promise((resolve) => { finish = resolve; started(); }));
  const first = patient.refreshAccessToken();
  const second = patient.refreshAccessToken();
  expect(second).toBe(first);
  const assertion = expect(first).rejects.toMatchObject({ code: 'AUTH_SESSION_CHANGED' });
  await dispatched;
  await patient.TokenStorage.setTokens('login.payload.signature', '3:device:login');
  finish({ data: { ok: true, accessToken: 'rotated.payload.signature', refreshToken: '1:device:rotated' } });
  await assertion;
  expect(post).toHaveBeenCalledTimes(1);
  expect(await patient.TokenStorage.getAccessToken()).toBe('login.payload.signature');
});

test('decodes base64url JWT expiry with asynchronous storage without browser globals', async () => {
  const store = storage();
  const tokens = tokenService('https://www.mdsystemtip.space', store);
  for (const exp of [Math.floor(Date.now() / 1000) + 3600, 1]) {
    const payload = Buffer.from(JSON.stringify({ name: 'José', exp })).toString('base64url');
    await tokens.TokenStorage.setTokens(`header.${payload}.signature`, '1:device:secret');
    expect(await tokens.isAccessTokenExpired()).toBe(exp === 1);
  }
});

test('browser-only authentication helpers can be imported without a DOM', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  expect(() => createGoogleOAuthService({ clientId: 'id', onSuccess: jest.fn(), onError: jest.fn() }).renderButton('google')).not.toThrow();
  await expect(createRecaptchaService({ siteKey: 'key' }).executeRecaptcha()).rejects.toThrow('script not loaded');
});
