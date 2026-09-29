// chatbotProxy.test.js
jest.mock("http", () => ({ request: jest.fn() }));
jest.mock("https", () => ({ request: jest.fn() }));
jest.mock("../../utils/logger.js", () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

let http;
let chatbotProxy;
let mapPath;

function mockReqRes(path = "/foo", method = "GET", body = null, headers = {}) {
  const req = {
    path,
    url: path,
    method,
    headers,
    body,
    ip: "127.0.0.1",
    protocol: "http",
    originalUrl: "/econsultation/chat" + path,
    on: jest.fn()
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    headersSent: false
  };
  return { req, res };
}

describe("mapPath", () => {
  beforeEach(() => {
    process.env.CHATBOT_URL = "http://chatbot.local";
    process.env.CHATBOT_API_KEY = "secret";
    jest.resetModules();
    http = require("http");
    ({ chatbotProxy, mapPath } = require("./chatbotProxy.js"));
  });
  test("maps staff route", () => {
    expect(mapPath("/staff/chat")).toBe("/api/staff/chat");
  });
  test("maps health route", () => {
    expect(mapPath("/health")).toBe("/api/health");
  });
  test("maps patient route", () => {
    expect(mapPath("/foo")).toBe("/api/patient/foo");
  });
});

describe("chatbotProxy", () => {
  beforeEach(() => {
    process.env.CHATBOT_URL = "http://chatbot.local";
    process.env.CHATBOT_API_KEY = "secret";
    jest.resetModules();
    http = require("http");
    ({ chatbotProxy, mapPath } = require("./chatbotProxy.js"));
    jest.clearAllMocks();
  });

  test("returns 503 if env vars missing", () => {
    delete process.env.CHATBOT_URL;
    delete process.env.CHATBOT_API_KEY;
    jest.resetModules();
    ({ chatbotProxy } = require("./chatbotProxy.js"));
    const { req, res } = mockReqRes();
    chatbotProxy(req, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: "SERVICE_UNAVAILABLE"
    }));
  });

  test("proxies request successfully", () => {
    const { req, res } = mockReqRes();
    const fakeProxyRes = {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      pipe: jest.fn()
    };
    const fakeRequest = { on: jest.fn(), end: jest.fn(), write: jest.fn() };
    http.request.mockImplementation((opts, cb) => {
      cb(fakeProxyRes);
      return fakeRequest;
    });

    chatbotProxy(req, res);

    expect(http.request).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(fakeProxyRes.pipe).toHaveBeenCalledWith(res);
  });

  test("handles SSE streaming headers", () => {
    const { req, res } = mockReqRes();
    const fakeProxyRes = {
      statusCode: 200,
      headers: { "content-type": "text/event-stream" },
      pipe: jest.fn()
    };
    const fakeRequest = { on: jest.fn(), end: jest.fn() };
    http.request.mockImplementation((opts, cb) => {
      cb(fakeProxyRes);
      return fakeRequest;
    });

    chatbotProxy(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache, no-transform");
    expect(res.setHeader).toHaveBeenCalledWith("X-Accel-Buffering", "no");
    expect(res.flushHeaders).toHaveBeenCalled();
  });

  test("handles timeout", () => {
    const { req, res } = mockReqRes();
    let onError;
    let onTimeout;
    const fakeRequest = {
      on: jest.fn((event, cb) => {
        if (event === "timeout") onTimeout = cb;
        if (event === "error") onError = cb;
      }),
      end: jest.fn(() => onTimeout()),
      destroy: jest.fn((error) => onError(error))
    };
    http.request.mockReturnValue(fakeRequest);

    chatbotProxy(req, res);

    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: "CHATBOT_TIMEOUT"
    }));
  });

  test("handles proxy error", () => {
    const { req, res } = mockReqRes();
    const fakeRequest = {
      on: jest.fn((event, cb) => { if (event === "error") cb(new Error("fail")); }),
      end: jest.fn()
    };
    http.request.mockReturnValue(fakeRequest);

    chatbotProxy(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: "CHATBOT_UNAVAILABLE"
    }));
  });

  test("serializes body for POST", () => {
    const { req, res } = mockReqRes("/foo", "POST", { hello: "world" });
    const fakeProxyRes = { statusCode: 200, headers: {}, pipe: jest.fn() };
    const fakeRequest = { on: jest.fn(), end: jest.fn(), write: jest.fn() };
    http.request.mockImplementation((opts, cb) => {
      cb(fakeProxyRes);
      return fakeRequest;
    });

    chatbotProxy(req, res);

    expect(fakeRequest.write).toHaveBeenCalledWith(Buffer.from(JSON.stringify({ hello: "world" })));
  });

  test('forwards HTTPS requests, optional identity headers, query/body, and respects response header state', () => {
    process.env.CHATBOT_URL = 'https://chatbot.example.test';
    jest.resetModules();
    const httpsClient = require('https');
    ({ chatbotProxy } = require('./chatbotProxy.js'));
    const { req, res } = mockReqRes('/staff/chat', 'PUT', { value: 2 }, {
      'content-type': 'application/custom', authorization: 'Bearer user-token', origin: 'https://app.example.test',
    });
    req.url = '/staff/chat?session=abc';
    req.user = { id: 27 };
    let onClose;
    req.on.mockImplementation((event, callback) => { if (event === 'close') onClose = callback; });
    const listeners = {};
    const fakeRequest = {
      on: jest.fn((event, callback) => { listeners[event] = callback; }),
      end: jest.fn(), write: jest.fn(), destroy: jest.fn(),
    };
    const fakeProxyRes = {
      statusCode: 201,
      headers: { 'content-type': 'application/json', 'transfer-encoding': 'chunked', connection: 'keep-alive' },
      pipe: jest.fn(),
    };
    httpsClient.request.mockImplementation((options, callback) => { callback(fakeProxyRes); return fakeRequest; });

    chatbotProxy(req, res);

    const options = httpsClient.request.mock.calls[0][0];
    expect(options).toMatchObject({ hostname: 'chatbot.example.test', port: 443, path: '/api/staff/chat?session=abc', method: 'PUT' });
    expect(options.headers).toMatchObject({
      'Content-Type': 'application/custom', Authorization: 'Bearer user-token', Origin: 'https://app.example.test',
      'X-Staff-Id': '27', 'X-Staff-Role': 'medical',
    });
    expect(fakeRequest.write).toHaveBeenCalledWith(Buffer.from(JSON.stringify({ value: 2 })));
    expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
    expect(res.setHeader).not.toHaveBeenCalledWith('transfer-encoding', expect.anything());
    expect(res.setHeader).not.toHaveBeenCalledWith('connection', expect.anything());
    expect(req.on).toHaveBeenCalledWith('close', expect.any(Function));
    onClose?.();
    expect(fakeRequest.destroy).toHaveBeenCalledTimes(1);
    res.headersSent = true;
    const statusCalls = res.status.mock.calls.length;
    listeners.error(new Error('late failure'));
    expect(res.status).toHaveBeenCalledTimes(statusCalls);
  });
});
