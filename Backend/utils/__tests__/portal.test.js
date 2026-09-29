const { detectPortalFromSubdomain } = require('../portal');

describe('detectPortalFromSubdomain', () => {
  it.each([
    [{ 'x-forwarded-host': 'staff.localhost', host: 'patient.localhost' }, 'Medical'],
    [{ host: 'staff.example.test' }, 'Medical'],
    [{ host: 'patient.example.test' }, 'Patient'],
    [{}, 'Patient'],
  ])('maps request hosts to the expected portal', (headers, expected) => {
    const req = { get: jest.fn((name) => headers[name]) };
    expect(detectPortalFromSubdomain(req)).toBe(expected);
  });
});
