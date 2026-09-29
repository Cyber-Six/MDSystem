// tokenauth.test.js
jest.mock("../redis.js", () => ({
  setKey: jest.fn(),
  getKey: jest.fn()
}));

const redis = require("../redis.js");

// Mock global fetch
global.fetch = jest.fn();

const { fetchAccessToken, getAccessToken } = require("./tokenauth.js");

describe("fetchAccessToken", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("fetches token and caches it", async () => {
    const fakeToken = "abc123";
    const fakeResponse = {
      json: jest.fn().mockResolvedValue({ access_token: fakeToken })
    };
    fetch.mockResolvedValue(fakeResponse);

    const result = await fetchAccessToken();

    expect(fetch).toHaveBeenCalledWith(
      "https://icdaccessmanagement.who.int/connect/token",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      })
    );
    expect(redis.setKey).toHaveBeenCalledWith("icd_api_token", fakeToken);
    expect(result).toBe(fakeToken);
  });

  test("throws if fetch fails", async () => {
    fetch.mockRejectedValue(new Error("Network error"));
    await expect(fetchAccessToken()).rejects.toThrow("Network error");
  });
});

describe("getAccessToken", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns cached token if present", async () => {
    redis.getKey.mockResolvedValue("cachedToken");
    const result = await getAccessToken();
    expect(result).toBe("cachedToken");
    expect(fetch).not.toHaveBeenCalled();
  });

  test("calls fetchAccessToken if no cached token", async () => {
    redis.getKey.mockResolvedValue(null);
    const fakeToken = "newToken";
    const fakeResponse = {
      json: jest.fn().mockResolvedValue({ access_token: fakeToken })
    };
    fetch.mockResolvedValue(fakeResponse);
    redis.setKey.mockResolvedValue();

    const result = await getAccessToken();
    expect(fetch).toHaveBeenCalled();
    expect(redis.setKey).toHaveBeenCalledWith("icd_api_token", fakeToken);
    expect(result).toBe(fakeToken);
  });
});
