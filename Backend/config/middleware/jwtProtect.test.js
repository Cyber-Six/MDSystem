// jwtProtect.test.js
jest.mock("jsonwebtoken", () => ({
  verify: jest.fn()
}));
jest.mock("../../utils/logger.js", () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));
jest.mock("../redis.js", () => ({
  getStaffAnchor: jest.fn(),
  getSessionBlacklist: jest.fn().mockResolvedValue(false)
}));
jest.mock("../query.js", () => ({
  isActiveMedicalPersonnel: jest.fn(),
  getCredentialLockStateByUserId: jest.fn().mockResolvedValue({ status: "Active" })
}));

const jwt = require("jsonwebtoken");
const logger = require("../../utils/logger.js");
const { getStaffAnchor, getSessionBlacklist } = require("../redis.js");
const { isActiveMedicalPersonnel } = require("../query.js");
const { jwtProtect } = require("./jwtProtect.js");

function mockReqRes(authHeader = null) {
  const req = {
    path: "/test",
    ip: "127.0.0.1",
    headers: authHeader ? { authorization: authHeader } : {},
    user: null
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
  const next = jest.fn();
  return { req, res, next };
}

describe("jwtProtect middleware", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns 401 if Authorization header missing", async () => {
    const { req, res, next } = mockReqRes();
    await jwtProtect()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "TOKEN_REQUIRED" }));
    expect(next).not.toHaveBeenCalled();
  });

  test("returns 401 if Bearer token missing", async () => {
    const { req, res, next } = mockReqRes("Bearer");
    await jwtProtect()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "TOKEN_REQUIRED" }));
  });

  test("returns 401 if token payload incomplete", async () => {
    jwt.verify.mockReturnValue({}); // missing id and role
    const { req, res, next } = mockReqRes("Bearer faketoken");
    await jwtProtect()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "INVALID_TOKEN" }));
  });

  test("returns 403 if role mismatch", async () => {
    jwt.verify.mockReturnValue({ id: 1, role: "staff" });
    const { req, res, next } = mockReqRes("Bearer faketoken");
    await jwtProtect("patient")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "FORBIDDEN" }));
  });

  test("returns 401 if medical role missing sid", async () => {
    jwt.verify.mockReturnValue({ id: 1, role: "medical" });
    const { req, res, next } = mockReqRes("Bearer faketoken");
    await jwtProtect("medical")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "INVALID_SESSION" }));
  });

  test("returns 401 if medical session invalid", async () => {
    jwt.verify.mockReturnValue({ id: 1, role: "medical", sid: "abc" });
    getStaffAnchor.mockResolvedValue("different");
    const { req, res, next } = mockReqRes("Bearer faketoken");
    await jwtProtect("medical")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "INVALID_SESSION" }));
  });

  test("returns 403 if medical identity not active", async () => {
    jwt.verify.mockReturnValue({ id: 1, role: "medical", sid: "abc" });
    getStaffAnchor.mockResolvedValue("abc");
    isActiveMedicalPersonnel.mockResolvedValue(false);
    const { req, res, next } = mockReqRes("Bearer faketoken");
    await jwtProtect("medical")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "FORBIDDEN" }));
  });

  test("calls next if token valid and role allowed", async () => {
    jwt.verify.mockReturnValue({ id: 1, role: "patient" });
    const { req, res, next } = mockReqRes("Bearer faketoken");
    await jwtProtect("patient")(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 1, role: "patient" });
  });

  test("accepts a medical token with a matching active session and personnel record", async () => {
    jwt.verify.mockReturnValue({ id: 7, role: "medical", sid: "session-7" });
    getStaffAnchor.mockResolvedValue("session-7");
    isActiveMedicalPersonnel.mockResolvedValue(true);
    const { req, res, next } = mockReqRes("Bearer valid-medical-token");
    await jwtProtect("medical")(req, res, next);
    expect(getStaffAnchor).toHaveBeenCalledWith(7);
    expect(isActiveMedicalPersonnel).toHaveBeenCalledWith(7);
    expect(req.user).toMatchObject({ id: 7, role: "medical" });
    expect(next).toHaveBeenCalled();
  });

  test("returns 401 if token expired", async () => {
    jwt.verify.mockImplementation(() => { throw { name: "TokenExpiredError" }; });
    const { req, res, next } = mockReqRes("Bearer faketoken");
    await jwtProtect()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "TOKEN_EXPIRED" }));
  });

  test("returns 401 if jwt verification fails", async () => {
    jwt.verify.mockImplementation(() => { throw new Error("bad token"); });
    const { req, res, next } = mockReqRes("Bearer faketoken");
    await jwtProtect()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "INVALID_TOKEN" }));
  });
});

test('rejects blacklisted JWTs immediately but accepts legacy tokens without revocation metadata', async () => {
  jwt.verify.mockReturnValue({ id: 12, role: 'patient', jti: 'revoked-jwt' });
  getSessionBlacklist.mockResolvedValueOnce(true);
  let state = mockReqRes('Bearer signed');
  await jwtProtect()(state.req, state.res, state.next);
  expect(state.res.status).toHaveBeenCalledWith(401);
  expect(state.res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'TOKEN_INVALID' }));
  expect(state.next).not.toHaveBeenCalled();
  jwt.verify.mockReturnValue({ id: 12, role: 'patient' });
  state = mockReqRes('Bearer legacy');
  await jwtProtect()(state.req, state.res, state.next);
  expect(state.next).toHaveBeenCalled();
});

test.each(['Basic token', 'Bearer token extra'])('rejects malformed Authorization header %s', async header => {
  const state = mockReqRes(header);
  await jwtProtect('all')(state.req, state.res, state.next);
  expect(state.res.status).toHaveBeenCalledWith(401);
  expect(state.next).not.toHaveBeenCalled();
});
test.each([null, 0, -1, '12:another-key', '9007199254740992'])('rejects invalid authenticated user ID %j', async id => {
  jwt.verify.mockReturnValue({ id, role: 'patient' });
  const state = mockReqRes('Bearer token');
  await jwtProtect('all')(state.req, state.res, state.next);
  expect(state.res.status).toHaveBeenCalledWith(401);
  expect(state.next).not.toHaveBeenCalled();
});
test('locked accounts cannot continue using a previously issued access token', async () => {
  require('../query').getCredentialLockStateByUserId.mockResolvedValueOnce({ status: 'Locked' });
  jwt.verify.mockReturnValue({ id: 12, role: 'patient' });
  const state = mockReqRes('Bearer token');
  await jwtProtect('all')(state.req, state.res, state.next);
  expect(state.res.status).toHaveBeenCalledWith(403);
  expect(state.next).not.toHaveBeenCalled();
});
