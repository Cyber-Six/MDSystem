beforeEach(() => {
  delete global.DentalCleaningRange;
  jest.resetModules();
  require('./data.js');
});

afterEach(() => {
  delete global.DentalCleaningRange;
});

describe("DentalCleaningRange", () => {
  let DentalCleaningRange;
  beforeEach(() => { DentalCleaningRange = global.DentalCleaningRange; });
  test("contains the expected ranges", () => {
    expect(DentalCleaningRange).toEqual(["0-6", "7-12", "12-24", ">24"]);
  });

  test("has 4 ranges", () => {
    expect(DentalCleaningRange).toHaveLength(4);
  });

  test("first range is 0-6", () => {
    expect(DentalCleaningRange[0]).toBe("0-6");
  });

  test("last range is >24", () => {
    expect(DentalCleaningRange[3]).toBe(">24");
  });

  test("all ranges are strings", () => {
    DentalCleaningRange.forEach(range => {
      expect(typeof range).toBe("string");
    });
  });
});
