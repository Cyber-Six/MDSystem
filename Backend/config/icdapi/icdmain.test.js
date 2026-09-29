// icdmain.test.js
// The production module reads this once at load time; keep freshness tests
// deterministic without relying on a developer's Backend/.env.
process.env.ICD_RELEASE = "2020-01-01T00:00:00.000Z";

jest.mock("./icddb.js", () => ({
  getIcdToTitle: jest.fn(),
  getTitleToIcd: jest.fn(),
  createICDLookup: jest.fn(),
  updateICDLookup: jest.fn(),
  getICDLookupById: jest.fn()
}));

jest.mock("./icdapi.js", () => ({
  icdFetch: jest.fn(),
  titleToicdCode: jest.fn(),
  icdCodeToTitle: jest.fn()
}));

const {
  getIcdToTitle,
  getTitleToIcd,
  createICDLookup,
  updateICDLookup,
  getICDLookupById
} = require("./icddb.js");

const {
  icdFetch,
  titleToicdCode,
  icdCodeToTitle
} = require("./icdapi.js");

const { GetIcd, GetTitle, getIcdDetails } = require("./icdmain.js");

describe("GetIcd", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns DB records when fresh", async () => {
    const rec = { id: 1, code: "X123", title: "Condition", updated_at: "9999-12-31T00:00:00.000Z" };
    getTitleToIcd.mockResolvedValue([rec]);

    const result = await GetIcd("Condition");
    expect(result).toEqual([{ id: 1, code: "X123", title: "Condition" }]);
  });

  test("queries API when DB empty", async () => {
    getTitleToIcd.mockResolvedValue([]);
    titleToicdCode.mockResolvedValue([{ code: "X999", title: "New Condition", stemId: "https://stem" }]);
    createICDLookup.mockResolvedValue({ id: 2 });

    const result = await GetIcd("New Condition");
    expect(titleToicdCode).toHaveBeenCalledWith("New Condition");
    expect(createICDLookup).toHaveBeenCalled();
    expect(result[0]).toEqual({ id: 2, code: "X999", title: "New Condition" });
  });

  test("updates stale DB record", async () => {
    const oldRec = { id: 3, code: "X111", title: "Old", updated_at: "2000-01-01" };
    getTitleToIcd.mockResolvedValue([oldRec]);
    icdFetch.mockResolvedValue({ code: "X111", title: "Updated", stemId: "https://stem" });
    updateICDLookup.mockResolvedValue({ id: 3, code: "X111", title: "Updated" });

    const result = await GetIcd("Old");
    expect(updateICDLookup).toHaveBeenCalled();
    expect(result[0].title).toBe("Updated");
  });

  test("returns [{}] on error", async () => {
    getTitleToIcd.mockRejectedValue(new Error("DB error"));
    const result = await GetIcd("Bad");
    expect(result).toEqual([{}]);
  });

  test("returns fallback for API empty results and preserves stale rows when refresh has no match", async () => {
    getTitleToIcd.mockResolvedValueOnce([]);
    titleToicdCode.mockResolvedValueOnce([]);
    await expect(GetIcd("Unknown")).resolves.toEqual([{}]);
    getTitleToIcd.mockResolvedValueOnce([{ id: 4, code: "X4", title: "Old", updated_at: "2000-01-01" }]);
    icdFetch.mockResolvedValueOnce(null);
    await expect(GetIcd("Old")).resolves.toEqual([]);
  });
});

describe("GetTitle", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns DB records when fresh", async () => {
    const rec = { id: 1, code: "X123", title: "Condition", updated_at: "9999-12-31T00:00:00.000Z" };
    getIcdToTitle.mockResolvedValue([rec]);

    const result = await GetTitle("X123");
    expect(result).toEqual([{ id: 1, code: "X123", title: "Condition" }]);
  });

  test("queries API when DB empty", async () => {
    getIcdToTitle.mockResolvedValue([]);
    icdCodeToTitle.mockResolvedValue({ code: "X999", title: "New Condition", stemId: "https://stem" });
    createICDLookup.mockResolvedValue({ id: 2 });

    const result = await GetTitle("X999");
    expect(icdCodeToTitle).toHaveBeenCalledWith("X999");
    expect(result[0]).toEqual({ id: 2, code: "X999", title: "New Condition" });
  });

  test("updates stale DB record", async () => {
    const oldRec = { id: 3, code: "X111", title: "Old", stemData: "https://stem", updated_at: "2000-01-01" };
    getIcdToTitle.mockResolvedValue([oldRec]);
    icdFetch.mockResolvedValue({ code: "X111", title: "Updated", stemId: "https://stem" });
    updateICDLookup.mockResolvedValue({ id: 3, code: "X111", title: "Updated" });

    const result = await GetTitle("X111");
    expect(updateICDLookup).toHaveBeenCalled();
    expect(result[0].title).toBe("Updated");
  });

  test("returns [{}] on error", async () => {
    getIcdToTitle.mockRejectedValue(new Error("DB error"));
    const result = await GetTitle("Bad");
    expect(result).toEqual([{}]);
  });

  test("returns fallback for a missing API result and ignores unmatched stale entries", async () => {
    getIcdToTitle.mockResolvedValueOnce([]);
    icdCodeToTitle.mockResolvedValueOnce(null);
    await expect(GetTitle("missing")).resolves.toEqual([{}]);
    getIcdToTitle.mockResolvedValueOnce([{ id: 5, code: "X5", title: "Old", stemData: "stem", updated_at: "2000-01-01" }]);
    icdFetch.mockResolvedValueOnce(null);
    await expect(GetTitle("X5")).resolves.toEqual([]);
  });
});

describe("getIcdDetails", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns null if no DB record", async () => {
    getICDLookupById.mockResolvedValue(null);
    const result = await getIcdDetails(99);
    expect(result).toBeNull();
  });

  test("fetches details from API if DB record exists", async () => {
    getICDLookupById.mockResolvedValue({ id: 1, stemData: "https://stem" });
    icdFetch.mockResolvedValue({ code: "X123", title: "Condition" });

    const result = await getIcdDetails(1);
    expect(icdFetch).toHaveBeenCalledWith("https://stem");
    expect(result).toEqual({ code: "X123", title: "Condition" });
  });

  test("returns null on error", async () => {
    getICDLookupById.mockRejectedValue(new Error("DB error"));
    const result = await getIcdDetails(1);
    expect(result).toBeNull();
  });
});
