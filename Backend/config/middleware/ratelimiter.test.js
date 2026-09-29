// ipRateLimiter.test.js
jest.mock("../redis.js", () => ({
  rateLimitIP: jest.fn(),
  getIPRateLimitTTL: jest.fn(),
  rateLimitIPCount: jest.fn()
}));
jest.mock("../../utils/validator.js", () => ({
  detectRoleFromEmail: jest.fn()
}));
jest.mock("../../utils/security.js", () => ({
  delayRandom: jest.fn()
}));
jest.mock("../../utils/portal.js", () => ({
  detectPortalFromSubdomain: jest.fn()
}));
jest.mock("../../utils/logger.js", () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const { rateLimitIP, getIPRateLimitTTL, rateLimitIPCount } = require("../redis.js");
const { detectRoleFromEmail } = require("../../utils/validator.js");
const { delayRandom } = require("../../utils/security.js");
const { detectPortalFromSubdomain } = require("../../utils/portal.js");
const { ipRateLimiter, roleBasedIpRateLimiter, portalBasedIpRateLimiter } = require("./ratelimiter.js");

function mockReqRes(ip = "127.0.0.1", body = {}) {
  const req = { ip, body };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
  const next = jest.fn();
  return { req, res, next };
}

describe("ipRateLimiter", () => {
  beforeEach(() => jest.clearAllMocks());

  test("throws error if profile does not exist", () => {
    expect(() => ipRateLimiter("nonexistent")).toThrow(/does not exist/);
  });

  test("calls next if not rate limited", async () => {
    rateLimitIP.mockResolvedValue(false);
    const { req, res, next } = mockReqRes();
    await ipRateLimiter("genericLimiter")(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test("uses the generic limiter profile when no profile name is supplied", async () => {
    rateLimitIP.mockResolvedValue(false);
    const { req, res, next } = mockReqRes();
    await ipRateLimiter()(req, res, next);
    expect(rateLimitIP).toHaveBeenCalledWith("127.0.0.1", "r", expect.any(Number), expect.any(Number));
    expect(next).toHaveBeenCalled();
  });

  test("returns 429 if rate limited", async () => {
    rateLimitIP.mockResolvedValue(true);
    getIPRateLimitTTL.mockResolvedValue(30);
    rateLimitIPCount.mockResolvedValue(5);
    const { req, res, next } = mockReqRes();
    await ipRateLimiter("genericLimiter")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: "RATE_LIMITED",
      retryAfterSeconds: 30
    }));
    expect(delayRandom).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});

describe("roleBasedIpRateLimiter", () => {
  beforeEach(() => jest.clearAllMocks());

  test("skips if no email", () => {
    const { req, res, next } = mockReqRes();
    roleBasedIpRateLimiter()(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test("skips if role not mapped", () => {
    detectRoleFromEmail.mockReturnValue("UnknownRole");
    const { req, res, next } = mockReqRes("127.0.0.1", { email: "foo@bar.com" });
    roleBasedIpRateLimiter()(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test("applies limiter if role mapped", async () => {
    detectRoleFromEmail.mockReturnValue("Student");
    rateLimitIP.mockResolvedValue(false);
    const { req, res, next } = mockReqRes("127.0.0.1", { email: "student@example.com" });
    await roleBasedIpRateLimiter()(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe("portalBasedIpRateLimiter", () => {
  beforeEach(() => jest.clearAllMocks());

  test("applies PatientAuthentication profile for patient portal", async () => {
    detectPortalFromSubdomain.mockReturnValue("patient");
    rateLimitIP.mockResolvedValue(false);
    const { req, res, next } = mockReqRes();
    await portalBasedIpRateLimiter()(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test("applies staffAuthentication profile for staff portal", async () => {
    detectPortalFromSubdomain.mockReturnValue("staff");
    rateLimitIP.mockResolvedValue(false);
    const { req, res, next } = mockReqRes();
    await portalBasedIpRateLimiter()(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
