// icdapi.test.js
const fetch = require("node-fetch");
const { Response } = jest.requireActual("node-fetch");

jest.mock("node-fetch");
jest.mock("./tokenauth.js", () => ({
  getAccessToken: jest.fn(),
  fetchAccessToken: jest.fn()
}));
jest.mock("../../utils/logger.js", () => ({
  info: jest.fn(),
  error: jest.fn()
}));

const { getAccessToken, fetchAccessToken } = require("./tokenauth.js");
const logger = require("../../utils/logger.js");
const { icdFetch, titleToicdCode, icdCodeToTitle } = require("./icdapi.js");

describe("icdFetch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns JSON when response is ok", async () => {
    getAccessToken.mockResolvedValue("token123");
    fetch.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));

    const result = await icdFetch("http://fakeurl");
    expect(result).toEqual({ success: true });
  });

  test("fetches new token on 401", async () => {
    getAccessToken.mockResolvedValue("expiredToken");
    fetchAccessToken.mockResolvedValue("newToken");

    // First call returns 401, second call returns ok
    fetch
      .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

    const result = await icdFetch("http://fakeurl");
    expect(logger.info).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  test("returns null on 404", async () => {
    getAccessToken.mockResolvedValue("token123");
    fetch.mockResolvedValue(new Response("Not found", { status: 404 }));

    const result = await icdFetch("http://fakeurl");
    expect(result).toBeNull();
  });

  test("throws error on other failures", async () => {
    getAccessToken.mockResolvedValue("token123");
    fetch.mockResolvedValue(new Response("Bad request", { status: 400 }));

    await expect(icdFetch("http://fakeurl")).rejects.toThrow("ICD API request failed with status 400");
    expect(logger.error).toHaveBeenCalled();
  });
});

describe("titleToicdCode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns exact match entity", async () => {
    getAccessToken.mockResolvedValue("token123");
    fetch.mockResolvedValue(new Response(JSON.stringify({
      destinationEntities: [
        { theCode: "8A61.41", title: "Progressive myoclonic epilepsy", stemId: "http://stemid" }
      ]
    }), { status: 200 }));

    const result = await titleToicdCode("Progressive myoclonic epilepsy");
    expect(result[0].code).toBe("8A61.41");
    expect(result[0].title).toBe("Progressive myoclonic epilepsy");
    expect(result[0].stemId).toBe("https://stemid");
  });

  test("returns candidates when no exact match", async () => {
    getAccessToken.mockResolvedValue("token123");
    fetch.mockResolvedValue(new Response(JSON.stringify({
      destinationEntities: [
        { theCode: "X123", title: "Some other condition", stemId: "http://stemid" }
      ]
    }), { status: 200 }));

    const result = await titleToicdCode("Unrelated");
    expect(result[0].code).toBe("X123");
    expect(result[0].title).toBe("Some other condition");
  });
});

describe("icdCodeToTitle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns null if no data", async () => {
    getAccessToken.mockResolvedValue("token123");
    fetch.mockResolvedValue(new Response("", { status: 404 }));

    const result = await icdCodeToTitle("X999");
    expect(result).toBeNull();
  });

  test("returns title when stemId exists", async () => {
    getAccessToken.mockResolvedValue("token123");

    // First call returns codeinfo with stemId
    fetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ stemId: "http://stemid" }), { status: 200 }))
      // Second call returns entity data
      .mockResolvedValueOnce(new Response(JSON.stringify({ title: { "@value": "Condition Title" } }), { status: 200 }));

    const result = await icdCodeToTitle("8A61.41");
    expect(result.code).toBe("8A61.41");
    expect(result.title).toBe("Condition Title");
    expect(result.stemId).toBe("https://stemid");
  });
});

test("titleToicdCode handles empty input", async () => {
  getAccessToken.mockResolvedValue("token123");
  fetch.mockResolvedValue(new Response(JSON.stringify({ destinationEntities: [] }), { status: 200 }));

  const result = await titleToicdCode("");
  expect(result).toEqual([]);
});

test("titleToicdCode strips HTML from titles", async () => {
  getAccessToken.mockResolvedValue("token123");
  fetch.mockResolvedValue(new Response(JSON.stringify({
    destinationEntities: [
      { theCode: "X111", title: "<b>Epilepsy</b>", stemId: "http://stemid" }
    ]
  }), { status: 200 }));

  const result = await titleToicdCode("Epilepsy");
  expect(result[0].title).toBe("Epilepsy");
});

test("icdCodeToTitle returns null if entity has no title", async () => {
  getAccessToken.mockResolvedValue("token123");
  fetch
    .mockResolvedValueOnce(new Response(JSON.stringify({ stemId: "http://stemid" }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

  const result = await icdCodeToTitle("X999");
  expect(result.title).toBeNull();
});

test("handles missing entity lists, stem IDs, and code metadata", async () => {
  getAccessToken.mockResolvedValue("token123");
  fetch.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
  await expect(titleToicdCode("Unknown")).resolves.toEqual([]);

  fetch.mockResolvedValueOnce(new Response(JSON.stringify({ destinationEntities: [{ theCode: "X1", title: "Other" }] }), { status: 200 }));
  await expect(titleToicdCode("Unknown")).resolves.toEqual([{ code: "X1", title: "Other", stemId: null }]);

  fetch.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
  await expect(icdCodeToTitle("X1")).resolves.toBeNull();
});
