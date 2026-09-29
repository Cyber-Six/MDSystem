const { mapRoleToProfile, rateLimitMatrix } = require("./matrix.js");

describe("rateLimitMatrix", () => {
  test("PatientAuthentication defaults are set correctly", () => {
    expect(rateLimitMatrix.PatientAuthentication.ipWindow).toBe(60);
    expect(rateLimitMatrix.PatientAuthentication.ipMax).toBe(8);
    expect(rateLimitMatrix.PatientAuthentication.emailCooldown_2fa).toBe(30);
    expect(rateLimitMatrix.PatientAuthentication.emailAttemptMax_2fa).toBe(2);
    expect(rateLimitMatrix.PatientAuthentication.emailCooldown_resetpw).toBe(30);
    expect(rateLimitMatrix.PatientAuthentication.penaltyCooldown_resetpw).toBe(300);
  });

  test("staffAuthentication defaults are set correctly", () => {
    expect(rateLimitMatrix.staffAuthentication.ipWindow).toBe(60);
    expect(rateLimitMatrix.staffAuthentication.ipMax).toBe(3);
    expect(rateLimitMatrix.staffAuthentication.emailCooldown_2fa).toBe(30);
    expect(rateLimitMatrix.staffAuthentication.emailAttemptMax_2fa).toBe(2);
    expect(rateLimitMatrix.staffAuthentication.emailCooldown_resetpw).toBe(30);
    expect(rateLimitMatrix.staffAuthentication.penaltyCooldown_resetpw).toBe(300);
  });

  test("strictLimiter defaults are set correctly", () => {
    expect(rateLimitMatrix.strictLimiter.ipWindow).toBe(60);
    expect(rateLimitMatrix.strictLimiter.ipMax).toBe(5);
  });

  test("genericLimiter defaults are set correctly", () => {
    expect(rateLimitMatrix.genericLimiter.ipWindow).toBe(60);
    expect(rateLimitMatrix.genericLimiter.ipMax).toBe(30);
  });
});

describe("mapRoleToProfile", () => {
  test("maps Student to PatientAuthentication", () => {
    expect(mapRoleToProfile("Student")).toBe("PatientAuthentication");
  });

  test("maps Employee to PatientAuthentication", () => {
    expect(mapRoleToProfile("Employee")).toBe("PatientAuthentication");
  });

  test("maps Superior to staffAuthentication", () => {
    expect(mapRoleToProfile("Superior")).toBe("staffAuthentication");
  });

  test("maps Medical to staffAuthentication", () => {
    expect(mapRoleToProfile("Medical")).toBe("staffAuthentication");
  });

  test("returns null for unknown role", () => {
    expect(mapRoleToProfile("UnknownRole")).toBeNull();
  });
});
