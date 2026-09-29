import {
  SUPERIOR_DETAILS_DENIED_CUE,
  canExpandPatientDetails,
  isSuperiorPatient,
} from './superior-access';

describe('superior patient access', () => {
  test('identifies superior profiles case-insensitively', () => {
    expect(isSuperiorPatient({ profile_type: 'Superior' })).toBe(true);
    expect(isSuperiorPatient({ profile_type: 'SUPERIOR' })).toBe(true);
    expect(isSuperiorPatient({ profile_type: 'Student' })).toBe(false);
    expect(isSuperiorPatient(null)).toBe(false);
    expect(SUPERIOR_DETAILS_DENIED_CUE).toMatch(/not allowed/i);
  });

  test.each([
    [{ profile_type: 'Student' }, false, true],
    [{ profile_type: 'Superior' }, false, false],
    [{ profile_type: 'Superior' }, true, true],
    [{ profile_type: 'Superior', access_denied: false }, true, true],
    [{ profile_type: 'Superior', access_denied: true }, true, false],
  ])('returns %p for local permission %p', (patient, allowed, expected) => {
    expect(canExpandPatientDetails(patient, allowed)).toBe(expected);
  });
});
