// activeCredential.test.js
jest.mock("../query.js", () => ({
  query: jest.fn()
}));
jest.mock("../../utils/logger.js", () => ({
  warn: jest.fn(),
  debug: jest.fn(),
  error: jest.fn()
}));

const db = require("../query.js");
const logger = require("../../utils/logger.js");
const { checkCredentialsStatus, checkCredentialsStatusWith } = require("./activeCredential.js");

function mockReqRes(userId = 1) {
  const req = { user: userId ? { id: userId } : null, path: "/test", ip: "127.0.0.1" };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
  const next = jest.fn();
  return { req, res, next };
}

describe("checkCredentialsStatus", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns 401 if no userId", async () => {
    const { req, res, next } = mockReqRes(null);
    await checkCredentialsStatus(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "UNAUTHORIZED" }));
    expect(next).not.toHaveBeenCalled();
  });

  test("returns 403 if credentials not found", async () => {
    db.query.mockResolvedValue({ rows: [] });
    const { req, res, next } = mockReqRes(1);
    await checkCredentialsStatus(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "CREDENTIALS_NOT_FOUND" }));
  });

  test("returns 403 if credentials incomplete", async () => {
    db.query.mockResolvedValue({ rows: [{ credentials_status: "Pending" }] });
    const { req, res, next } = mockReqRes(1);
    await checkCredentialsStatus(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "CREDENTIALS_INCOMPLETE" }));
  });

  test("calls next if credentials active", async () => {
    db.query.mockResolvedValue({ rows: [{ credentials_status: "Active" }] });
    const { req, res, next } = mockReqRes(1);
    await checkCredentialsStatus(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.credentialsStatus).toBe("Active");
  });

  test("returns 500 on error", async () => {
    db.query.mockRejectedValue(new Error("DB error"));
    const { req, res, next } = mockReqRes(1);
    await checkCredentialsStatus(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "SERVER_ERROR" }));
  });
});

describe("checkCredentialsStatusWith", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns 403 if status not allowed", async () => {
    db.query.mockResolvedValue({ rows: [{ credentials_status: "Inactive" }] });
    const middleware = checkCredentialsStatusWith(["Active"]);
    const { req, res, next } = mockReqRes(1);
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "CREDENTIALS_STATUS_NOT_ALLOWED" }));
  });

  test("calls next if status allowed", async () => {
    db.query.mockResolvedValue({ rows: [{ credentials_status: "Pending" }] });
    const middleware = checkCredentialsStatusWith(["Active", "Pending"]);
    const { req, res, next } = mockReqRes(1);
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.credentialsStatus).toBe("Pending");
  });

  test("rejects missing identities and absent credential rows", async () => {
    const middleware = checkCredentialsStatusWith();
    let { req, res, next } = mockReqRes(null);
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();

    db.query.mockResolvedValueOnce({ rows: [] });
    ({ req, res, next } = mockReqRes(2));
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "CREDENTIALS_NOT_FOUND" }));
  });

  test("maps database errors to a server response", async () => {
    db.query.mockRejectedValueOnce(new Error("database unavailable"));
    const { req, res, next } = mockReqRes(3);
    await checkCredentialsStatusWith()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "SERVER_ERROR" }));
    expect(logger.error).toHaveBeenCalled();
  });
});
