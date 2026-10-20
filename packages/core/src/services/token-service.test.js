import axios from 'axios';
import { createTokenService } from './token-service';

const access = 'header.payload.signature';
const refresh = '1:device:secret';
const rotated = { data: { ok: true, accessToken: 'new.payload.signature', refreshToken: '1:device:rotated' } };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const setup = () => {
  const data = new Map([['patient_accessToken', access], ['patient_refreshToken', refresh]]);
  const storage = {
    getItem: jest.fn((key) => data.get(key) ?? null),
    setItem: jest.fn((key, value) => data.set(key, value)),
    removeItem: jest.fn((key) => data.delete(key)),
  };
  const navigator = { navigate: jest.fn() };
  const service = createTokenService({ storage, navigator, getApiBaseUrl: () => '', tokenNamespace: 'patient' });
  return { data, storage, navigator, ...service };
};

afterEach(() => jest.restoreAllMocks());

describe('token lifecycle', () => {
  test('logout during a pending refresh-token read prevents HTTP dispatch', async () => {
    const service = setup();
    const read = deferred();
    const started = deferred();
    service.storage.getItem.mockImplementationOnce(() => { started.resolve(); return read.promise; });
    const post = jest.spyOn(axios, 'post').mockResolvedValue({});
    const pending = service.refreshAccessToken();
    const assertion = expect(pending).rejects.toMatchObject({ code: 'AUTH_SESSION_CHANGED' });
    await started.promise;
    await service.logout(false);
    read.resolve(refresh);
    await assertion;
    expect(post.mock.calls.every(([url]) => url.endsWith('/logout'))).toBe(true);
    expect(service.data.size).toBe(0);
  });

  test('a rejected async token read fails closed and clears both stored tokens', async () => {
    const service = setup();
    service.storage.getItem.mockRejectedValueOnce(new Error('Keychain locked'));
    const post = jest.spyOn(axios, 'post');
    await expect(service.refreshAccessToken()).rejects.toThrow('Keychain locked');
    expect(post).not.toHaveBeenCalled();
    expect(service.data.size).toBe(0);
  });

  test('preserves a structured server refresh error after local session cleanup', async () => {
    const service = setup();
    jest.spyOn(axios, 'post').mockRejectedValue({ response: {
      status: 403, data: { error: 'SESSION_REVOKED', message: 'Session revoked' },
    } });
    await expect(service.refreshAccessToken()).rejects.toMatchObject({ code: 'SESSION_REVOKED', status: 403, message: 'Session revoked' });
    expect(service.data.size).toBe(0);
  });

  test.each([
    ['login', 'clear', 'login'], ['clear', 'login', 'clear'],
    ['login', 'login', 'clear'], ['clear', 'clear', 'login'],
  ])('queued async storage honors command order: %s → %s → %s', async (...commands) => {
    const service = setup();
    service.storage.setItem.mockImplementation(async (key, value) => {
      await Promise.resolve();
      service.data.set(key, value);
    });
    const work = commands.map((command, index) => command === 'clear'
      ? service.TokenStorage.clearTokens()
      : service.TokenStorage.setTokens(`login${index}.payload.signature`, `${index}:device:login`));
    await Promise.all(work);
    if (commands[commands.length - 1] === 'clear') expect(service.data.size).toBe(0);
    else {
      expect(service.data.get('patient_accessToken')).toBe('login2.payload.signature');
      expect(service.data.get('patient_refreshToken')).toBe('2:device:login');
    }
  });

  test.each([
    null, {}, { ok: false },
    { ok: true, accessToken: access },
    { ok: true, accessToken: 'invalid', refreshToken: refresh },
    { ok: true, accessToken: access, refreshToken: 'invalid' },
  ])('clears the session after an unusable refresh response %p', async (data) => {
    const service = setup();
    jest.spyOn(axios, 'post').mockResolvedValue({ data });
    await expect(service.refreshAccessToken()).rejects.toThrow(/Invalid/);
    expect(service.data.size).toBe(0);
  });

  test('failed storage mutation does not block a later valid login', async () => {
    const service = setup();
    service.storage.setItem.mockImplementationOnce(() => { throw new Error('Storage full'); });
    await expect(service.TokenStorage.setTokens(access, refresh)).rejects.toThrow('Storage full');
    await service.TokenStorage.setTokens('login.payload.signature', '2:device:login');
    expect(await service.isAuthenticated()).toBe(true);
    expect(service.data.get('patient_refreshToken')).toBe('2:device:login');
  });

  test('network refresh failure settles all callers and permits refresh after a new login', async () => {
    const service = setup();
    const post = jest.spyOn(axios, 'post')
      .mockRejectedValueOnce(Object.assign(new Error('Offline'), { request: {} }))
      .mockResolvedValueOnce(rotated);
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => service.refreshAccessToken()));
    expect(results.every((result) => result.status === 'rejected' && result.reason.code === 'NETWORK_ERROR')).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
    expect(service.data.size).toBe(0);
    await service.TokenStorage.setTokens(access, refresh);
    await expect(service.refreshAccessToken()).resolves.toBe(rotated.data.accessToken);
    expect(post).toHaveBeenCalledTimes(2);
  });

  test('logout clears local tokens and navigates even when server revocation fails', async () => {
    const service = setup();
    jest.spyOn(axios, 'post').mockRejectedValue(new Error('Offline'));
    await service.logout();
    expect(service.data.size).toBe(0);
    expect(service.navigator.navigate).toHaveBeenCalledWith('/auth');
    expect(service.navigator.navigate).toHaveBeenCalledTimes(1);
  });

  test('logout attempts both removals when reading the stored session fails', async () => {
    const service = setup();
    service.storage.getItem.mockImplementationOnce(() => { throw new Error('Storage locked'); });
    const post = jest.spyOn(axios, 'post');
    await expect(service.logout()).rejects.toThrow('Storage locked');
    expect(service.data.size).toBe(0);
    expect(post).not.toHaveBeenCalled();
    expect(service.navigator.navigate).not.toHaveBeenCalled();
  });

  test.each([
    [{}, true], [{ exp: '9999999999' }, true], [{ exp: null }, true],
    [{ exp: 1060 }, true], [{ exp: 1061 }, false], [{ exp: 1000 }, true],
  ])('handles missing, mistyped, and buffer-boundary JWT claims %p', async (payload, expired) => {
    const service = setup();
    jest.spyOn(Date, 'now').mockReturnValue(1000 * 1000);
    service.data.set('patient_accessToken', `header.${btoa(JSON.stringify(payload))}.signature`);
    expect(await service.isAccessTokenExpired()).toBe(expired);
  });

  test('shares one rotating refresh across independent callers', async () => {
    const service = setup();
    const post = jest.spyOn(axios, 'post').mockResolvedValue(rotated);
    const result = await Promise.all([service.refreshAccessToken(), service.refreshAccessToken(), service.refreshAccessToken()]);
    expect(result).toEqual(Array(3).fill(rotated.data.accessToken));
    expect(post).toHaveBeenCalledTimes(1);
    expect(service.data.get('patient_refreshToken')).toBe('1:device:rotated');
  });

  test('keeps sharing the refresh while async token writes are pending', async () => {
    const service = setup();
    const write = deferred();
    const started = deferred();
    service.storage.setItem.mockImplementation(async (key, value) => {
      started.resolve();
      await write.promise;
      service.data.set(key, value);
    });
    const post = jest.spyOn(axios, 'post').mockResolvedValue(rotated);
    const first = service.refreshAccessToken();
    await started.promise;
    const second = service.refreshAccessToken();
    expect(second).toBe(first);
    write.resolve();
    await Promise.all([first, second]);
    expect(post).toHaveBeenCalledTimes(1);
  });

  test('treats a non-finite JWT expiry as invalid', async () => {
    const service = setup();
    service.data.set('patient_accessToken', `header.${btoa('{"exp":1e400}')}.signature`);
    expect(await service.isAccessTokenExpired()).toBe(true);
  });

  test.each(['resolve', 'reject'])('a late refresh %s cannot overwrite or clear a new login', async (outcome) => {
    const service = setup();
    const response = deferred();
    const started = deferred();
    jest.spyOn(axios, 'post').mockImplementation(() => { started.resolve(); return response.promise; });
    const pending = service.refreshAccessToken();
    const assertion = expect(pending).rejects.toMatchObject({ code: 'AUTH_SESSION_CHANGED' });
    await started.promise;
    await service.TokenStorage.setTokens('login.payload.signature', '2:other:login');
    if (outcome === 'resolve') response.resolve(rotated);
    else response.reject(new Error('Expired old session'));
    await assertion;
    expect(service.data.get('patient_accessToken')).toBe('login.payload.signature');
    expect(service.data.get('patient_refreshToken')).toBe('2:other:login');
  });

  test('a refresh finishing after logout cannot restore authentication', async () => {
    const service = setup();
    const response = deferred();
    const started = deferred();
    jest.spyOn(axios, 'post').mockImplementation((url) => {
      if (url.endsWith('/logout')) return Promise.resolve({});
      started.resolve();
      return response.promise;
    });
    const pending = service.refreshAccessToken();
    const assertion = expect(pending).rejects.toMatchObject({ code: 'AUTH_SESSION_CHANGED' });
    await started.promise;
    await service.logout(false);
    response.resolve(rotated);
    await assertion;
    expect(await service.isAuthenticated()).toBe(false);
    expect(service.data.size).toBe(0);
  });

  test('logout does not clear or redirect a subsequent login', async () => {
    const service = setup();
    const response = deferred();
    const started = deferred();
    jest.spyOn(axios, 'post').mockImplementation(() => { started.resolve(); return response.promise; });
    const pending = service.logout();
    const login = service.TokenStorage.setTokens('login.payload.signature', '2:other:login');
    await started.promise;
    await login;
    response.resolve({});
    await pending;
    expect(service.data.get('patient_accessToken')).toBe('login.payload.signature');
    expect(service.data.get('patient_refreshToken')).toBe('2:other:login');
    expect(service.navigator.navigate).not.toHaveBeenCalled();
  });

  test.each([{}, '1::secret', ':device:secret', '1:device:', 'invalid'])('rejects malformed stored refresh token %p before dispatch', async (token) => {
    const service = setup();
    service.data.set('patient_refreshToken', token);
    const post = jest.spyOn(axios, 'post');
    await expect(service.refreshAccessToken()).rejects.toThrow('Invalid refresh token format');
    expect(post).not.toHaveBeenCalled();
    expect(service.data.size).toBe(0);
  });

  test('rolls back a partially written token pair', async () => {
    const service = setup();
    service.storage.setItem.mockImplementation((key, value) => {
      if (key.endsWith('refreshToken')) throw new Error('Storage full');
      service.data.set(key, value);
    });
    await expect(service.TokenStorage.setTokens('new.payload.signature', '1:device:new')).rejects.toThrow('Storage full');
    expect(service.data.size).toBe(0);
  });

  test('clears refresh tokens even if access token removal fails', async () => {
    const service = setup();
    service.storage.removeItem.mockImplementation((key) => {
      if (key.endsWith('accessToken')) throw new Error('Storage failure');
      service.data.delete(key);
    });
    await expect(service.TokenStorage.clearTokens()).rejects.toThrow('Storage failure');
    expect(service.data.has('patient_refreshToken')).toBe(false);
  });

  test('serializes async writes with logout cleanup', async () => {
    const service = setup();
    const write = deferred();
    service.storage.setItem.mockImplementation(async (key, value) => { await write.promise; service.data.set(key, value); });
    const storing = service.TokenStorage.setTokens('new.payload.signature', '1:device:new');
    const clearing = service.TokenStorage.clearTokens();
    write.resolve();
    await Promise.all([storing, clearing]);
    expect(service.data.size).toBe(0);
  });

  test.each(['header.bad payload.signature', 'header.payload.signature\n', 'not-a-jwt', 123])('rejects malformed JWT %p', (token) => {
    expect(setup().TokenStorage.validateToken(token)).toBe(false);
  });
});
