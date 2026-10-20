import { AxiosError } from 'axios';
import { createAxiosRequestHandler } from './axios-request-handler';
import * as bannerConfig from '../config/banner-config';

const unauthorized = (config) => {
  const response = { status: 401, data: {}, config };
  return Promise.reject(new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, {}, response));
};

const setup = (baseURL = '') => {
  const tokenService = {
    TokenStorage: { getAccessToken: jest.fn(() => 'old.token.value') },
    refreshAccessToken: jest.fn(async () => 'new.token.value'),
    logout: jest.fn(async () => {}),
  };
  const client = createAxiosRequestHandler({
    getApiBaseUrl: () => baseURL,
    getDevSubdomain: () => 'www.mdsystemtip.space',
    tokenService,
    bannerConfig,
    requestLoggerForceEnabled: false,
  });
  return { client, tokenService };
};

describe('authenticated HTTP requests', () => {
  test('a structured HTTP error produces a banner without refreshing the session', async () => {
    const tokenService = { TokenStorage: { getAccessToken: async () => null }, refreshAccessToken: jest.fn() };
    const onShowBanner = jest.fn();
    const client = createAxiosRequestHandler({ getApiBaseUrl: () => '', getDevSubdomain: () => '', tokenService, bannerConfig, onShowBanner, requestLoggerForceEnabled: false });
    const adapter = (config) => Promise.reject(new AxiosError('Forbidden', 'ERR_BAD_RESPONSE', config, {}, { status: 403, data: { error: 'ACCESS_DENIED', message: 'Access denied' } }));
    await expect(client.get('/records', { adapter })).rejects.toThrow('Forbidden');
    expect(onShowBanner).toHaveBeenCalledWith({ type: 'error', error: 'ACCESS_DENIED', message: 'Access denied' });
    expect(tokenService.refreshAccessToken).not.toHaveBeenCalled();
  });

  test('successful responses notify only when configured and network failures get a safe message', async () => {
    const tokenService = { TokenStorage: { getAccessToken: async () => null } };
    const onShowBanner = jest.fn();
    const client = createAxiosRequestHandler({ getApiBaseUrl: () => '', getDevSubdomain: () => '', tokenService, bannerConfig, onShowBanner, requestLoggerForceEnabled: false });
    await client.get('/records', { adapter: async (config) => ({ config, status: 200, data: {} }) });
    expect(onShowBanner).toHaveBeenLastCalledWith({ type: 'success', error: null, message: 'Success' });
    const network = new AxiosError('internal-network-secret', 'ERR_NETWORK', {}, {});
    await expect(client.get('/records', { adapter: () => Promise.reject(network) })).rejects.toBe(network);
    expect(onShowBanner).toHaveBeenLastCalledWith(expect.objectContaining({ error: 'NETWORK_ERROR', message: 'Unable to connect to server. Please check your internet connection.' }));
    expect(JSON.stringify(onShowBanner.mock.calls)).not.toContain('internal-network-secret');
  });

  test('a failed refresh rejects every queued request and permits a later request', async () => {
    const { client, tokenService } = setup();
    let failRefresh;
    let markDispatched;
    let markRefreshStarted;
    const dispatched = new Promise((resolve) => { markDispatched = resolve; });
    const refreshStarted = new Promise((resolve) => { markRefreshStarted = resolve; });
    tokenService.refreshAccessToken.mockImplementation(() => {
      markRefreshStarted();
      return new Promise((_resolve, reject) => { failRefresh = reject; });
    });
    let count = 0;
    const adapter = jest.fn((config) => {
      if (++count === 20) markDispatched();
      return unauthorized(config);
    });
    const results = Promise.allSettled(Array.from({ length: 20 }, (_, index) => client.get(`/records/${index}`, { adapter })));
    await Promise.all([dispatched, refreshStarted]);
    failRefresh(new Error('Refresh unavailable'));
    const settled = await results;
    expect(settled.every((result) => result.status === 'rejected' && result.reason.message === 'Refresh unavailable')).toBe(true);
    expect(tokenService.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(tokenService.logout).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledTimes(20);
    await expect(client.get('/healthy', { adapter: async (config) => ({ status: 200, data: {}, config }) }))
      .resolves.toMatchObject({ status: 200 });
  });

  test.each([400, 403, 404, 429, 500, 503])('does not refresh or log out on HTTP %s', async (status) => {
    const { client, tokenService } = setup();
    const error = new AxiosError('Request failed', 'ERR_BAD_RESPONSE', {}, {}, { status, data: {} });
    await expect(client.get('/records', { adapter: () => Promise.reject(error) })).rejects.toBe(error);
    expect(tokenService.refreshAccessToken).not.toHaveBeenCalled();
    expect(tokenService.logout).not.toHaveBeenCalled();
  });

  test.each([
    ['https://attacker.example/collect', {}],
    ['//attacker.example/collect', {}],
    ['/collect', { baseURL: 'https://attacker.example' }],
    ['https://localhost.attacker.example/collect', {}],
    ['/\\attacker.example/collect', {}],
    ['https://localhost@attacker.example/collect', {}],
  ])('blocks credentials and dispatch for untrusted URL %s', async (url, config) => {
    const { client, tokenService } = setup();
    const adapter = jest.fn();
    await expect(client.get(url, { ...config, adapter })).rejects.toThrow('configured API origin');
    expect(adapter).not.toHaveBeenCalled();
    expect(tokenService.TokenStorage.getAccessToken).not.toHaveBeenCalled();
  });

  test.each(['', 'https://api.example/v1'])('allows relative requests against base %s', async (baseURL) => {
    const { client } = setup(baseURL);
    const adapter = jest.fn(async (config) => ({ status: 200, data: {}, config }));
    await client.get('/records', { adapter });
    expect(adapter.mock.calls[0][0].headers.Authorization).toBe('Bearer old.token.value');
  });

  test('limits every concurrent 401 request to one retry', async () => {
    const { client, tokenService } = setup();
    let finishRefresh;
    tokenService.refreshAccessToken.mockImplementation(() => new Promise((resolve) => { finishRefresh = resolve; }));
    const adapter = jest.fn(unauthorized);
    const requests = Promise.allSettled([
      client.get('/first', { adapter }), client.get('/second', { adapter }),
    ]);
    // Wait for both original requests to reach the shared refresh queue.
    while (adapter.mock.calls.length < 2 || !finishRefresh) await new Promise((resolve) => setTimeout(resolve, 0));
    finishRefresh('new.token.value');
    const results = await requests;
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(adapter).toHaveBeenCalledTimes(4);
    expect(tokenService.refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  test('preserves a response error that has no request config', async () => {
    const { client } = setup();
    const error = { response: { status: 401 } };
    await expect(client.get('/records', { adapter: () => Promise.reject(error) })).rejects.toBe(error);
  });

  test('does not log out a replacement session when a refresh becomes stale', async () => {
    const { client, tokenService } = setup();
    tokenService.refreshAccessToken.mockRejectedValue(Object.assign(new Error('Session changed'), { code: 'AUTH_SESSION_CHANGED' }));
    await expect(client.get('/records', { adapter: unauthorized })).rejects.toThrow('Session changed');
    expect(tokenService.logout).not.toHaveBeenCalled();
  });

  test('finishes failed-refresh logout without leaving a delayed logout timer', async () => {
    const { client, tokenService } = setup();
    tokenService.refreshAccessToken.mockRejectedValue(new Error('Expired'));
    await expect(client.get('/records', { adapter: unauthorized })).rejects.toThrow('Expired');
    expect(tokenService.logout).toHaveBeenCalledWith(true);
  });
});
