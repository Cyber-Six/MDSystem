// icddb.test.js
jest.mock("../query.js", () => ({
  query: jest.fn()
}));
jest.mock("../../utils/logger.js", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const db = require("../query.js");
const logger = require("../../utils/logger.js");
const {
  createICDLookup,
  getTitleToIcd,
  getIcdToTitle,
  getICDLookupById,
  getAllICDLookups,
  updateICDLookup,
  deleteICDLookup
} = require("./icddb.js");

describe("ICD Lookup CRUD", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("createICDLookup inserts and returns row", async () => {
    const fakeRow = { id: 1, code: "X123", title: "Condition", stemData: "data", release: "2026" };
    db.query.mockResolvedValue({ rows: [fakeRow] });

    const result = await createICDLookup("X123", "Condition", "data", "2026");
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO"), ["X123", "Condition", "data", "2026"]);
    expect(logger.info).toHaveBeenCalled();
    expect(result).toEqual(fakeRow);
  });

  test("getTitleToIcd runs LIKE search", async () => {
    const fakeRows = [{ id: 1, title: "Condition" }];
    db.query.mockResolvedValue({ rows: fakeRows });

    const result = await getTitleToIcd("Cond", 5);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("ILIKE"), ["%Cond%", 5]);
    expect(result).toEqual(fakeRows);
  });

  test("getIcdToTitle runs LIKE search", async () => {
    const fakeRows = [{ id: 1, code: "X123" }];
    db.query.mockResolvedValue({ rows: fakeRows });

    const result = await getIcdToTitle("X", 3);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("ILIKE"), ["%X%", 3]);
    expect(result).toEqual(fakeRows);
  });

  test("getICDLookupById returns row or null", async () => {
    db.query.mockResolvedValue({ rows: [{ id: 1 }] });
    expect(await getICDLookupById(1)).toEqual({ id: 1 });

    db.query.mockResolvedValue({ rows: [] });
    expect(await getICDLookupById(99)).toBeNull();
  });

  test("getAllICDLookups paginates", async () => {
    const fakeRows = [{ id: 1 }];
    db.query.mockResolvedValue({ rows: fakeRows });

    const result = await getAllICDLookups(10, 5);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("ORDER BY"), [10, 5]);
    expect(result).toEqual(fakeRows);
  });

  test("updateICDLookup updates and returns row", async () => {
    const fakeRow = { id: 1, code: "X123" };
    db.query.mockResolvedValue({ rows: [fakeRow] });

    const result = await updateICDLookup(1, "X123", "Condition", "data", "2026");
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE"), ["X123", "Condition", "data", "2026", 1]);
    expect(logger.info).toHaveBeenCalled();
    expect(result).toEqual(fakeRow);
  });

  test("updateICDLookup returns null if not found", async () => {
    db.query.mockResolvedValue({ rows: [] });
    const result = await updateICDLookup(99, "X", "T", "D", "R");
    expect(logger.warn).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  test("deleteICDLookup deletes and returns id", async () => {
    db.query.mockResolvedValue({ rows: [{ id: 1 }] });
    const result = await deleteICDLookup(1);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("DELETE"), [1]);
    expect(logger.info).toHaveBeenCalled();
    expect(result).toEqual({ id: 1 });
  });

  test("deleteICDLookup returns null if not found", async () => {
    db.query.mockResolvedValue({ rows: [] });
    const result = await deleteICDLookup(99);
    expect(logger.warn).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  test("logs and rethrows database failures from each CRUD operation", async () => {
    const operations = [
      () => createICDLookup("X", "title", "stem", "release"),
      () => getTitleToIcd("title"),
      () => getIcdToTitle("X"),
      () => getICDLookupById(1),
      () => getAllICDLookups(),
      () => updateICDLookup(1, "X", "title", "stem", "release"),
      () => deleteICDLookup(1),
    ];
    for (const operation of operations) {
      db.query.mockRejectedValueOnce(new Error("database unavailable"));
      await expect(operation()).rejects.toThrow("database unavailable");
    }
    expect(logger.error).toHaveBeenCalledTimes(operations.length);
  });
});
