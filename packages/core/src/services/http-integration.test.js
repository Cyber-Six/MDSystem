/** @jest-environment node */
import http from 'node:http';
import axios from 'axios';
import { createAxiosRequestHandler } from './axios-request-handler';
import { createTokenService } from './token-service';

// Real Axios transport against an ephemeral loopback server. No production calls.
describe('HTTP authentication integration', () => {
  let server, baseURL, received, values, tokens, request;
  let previousProxy;
  beforeAll(() => {
    previousProxy = axios.defaults.proxy;
    // Keep synthetic test credentials on loopback even in environments with HTTP_PROXY.
    axios.defaults.proxy = false;
  });
  afterAll(() => {
    if (previousProxy === undefined) delete axios.defaults.proxy;
    else axios.defaults.proxy = previousProxy;
  });
  beforeEach(async () => {
    received = [];
    values = new Map();
    server = http.createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      received.push({ path: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() });
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/api/auth/refresh') {
        res.end(JSON.stringify({ ok: true, accessToken: 'rotated.payload.signature', refreshToken: '1:device:rotated' }));
      } else if (req.url === '/api/auth/logout') {
        res.end('{}');
      } else if (req.headers.authorization === 'Bearer rotated.payload.signature') {
        res.end(JSON.stringify({ ok: true }));
      } else {
        res.statusCode = 401;
        res.end('{}');
      }
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    baseURL = `http://127.0.0.1:${server.address().port}/api/`;
    tokens = createTokenService({
      storage: {
        getItem: async (key) => values.get(key) ?? null,
        setItem: async (key, value) => { values.set(key, value); },
        removeItem: async (key) => { values.delete(key); },
      },
      navigator: { navigate: jest.fn() }, getApiBaseUrl: () => baseURL, tokenNamespace: 'patient',
    });
    request = createAxiosRequestHandler({
      getApiBaseUrl: () => baseURL, getDevSubdomain: () => 'www.mdsystemtip.space',
      tokenService: tokens, bannerConfig: { shouldShowBanner: () => false }, requestLoggerForceEnabled: false,
    });
    await tokens.TokenStorage.setTokens('old.payload.signature', '1:device:old');
  });

  afterEach(async () => {
    if (server?.listening) {
      const closed = new Promise((resolve) => server.close(resolve));
      server.closeAllConnections();
      await closed;
    }
    jest.restoreAllMocks();
  });

  test('refreshes and retries through the real transport while preserving the API mount', async () => {
    await expect(request.get('/records')).resolves.toMatchObject({ status: 200, data: { ok: true } });
    expect(received.map(({ path }) => path)).toEqual(['/api/records', '/api/auth/refresh', '/api/records']);
    expect(JSON.parse(received[1].body)).toEqual({ refreshToken: '1:device:old' });
    expect(received[1].headers.authorization).toBeUndefined();
    expect(received[2].headers.authorization).toBe('Bearer rotated.payload.signature');
    expect(received[2].headers['x-forwarded-host']).toBe('www.mdsystemtip.space');
    await tokens.logout(false);
    expect(received[3].path).toBe('/api/auth/logout');
    expect(JSON.parse(received[3].body)).toEqual({ refreshToken: '1:device:rotated' });
    expect(values.size).toBe(0);
  });

  test('rejects an origin override before token lookup or real transport', async () => {
    const lookup = jest.spyOn(tokens.TokenStorage, 'getAccessToken');
    await expect(request.get('/collect', { baseURL: 'http://localhost:1' })).rejects.toThrow('configured API origin');
    expect(lookup).not.toHaveBeenCalled();
    expect(received).toEqual([]);
  });

  test('an already-aborted request does not reach the server or trigger refresh', async () => {
    const controller = new AbortController();
    controller.abort();
    const refresh = jest.spyOn(tokens, 'refreshAccessToken');
    await expect(request.get('/records', { signal: controller.signal })).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    expect(refresh).not.toHaveBeenCalled();
    expect(received).toEqual([]);
  });

  test('network connection failures reject without an authentication retry', async () => {
    await new Promise((resolve) => server.close(resolve));
    const refresh = jest.spyOn(tokens, 'refreshAccessToken');
    const error = await request.get('/records').catch((failure) => failure);
    expect(error).toMatchObject({ code: 'ECONNREFUSED' });
    expect(axios.isAxiosError(error)).toBe(true);
    expect(refresh).not.toHaveBeenCalled();
  });
});
