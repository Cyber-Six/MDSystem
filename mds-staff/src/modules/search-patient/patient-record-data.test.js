import { GQL_FULL_RECORD, GQL_PERSONAL_PROFILE, MOCK_PATIENT_RECORDS, STATUS_BANNER } from './patient-record-data';

describe('patient record query data', () => {
  test('exports the full and personal GraphQL queries', () => {
    expect(GQL_FULL_RECORD).toContain('query GetFullPatientRecord');
    expect(GQL_PERSONAL_PROFILE).toContain('query GetUserPersonalProfile');
  });

  test('provides status metadata and complete mock patient records', () => {
    expect(STATUS_BANNER.Pending.label).toMatch(/approval/i);
    expect(MOCK_PATIENT_RECORDS['mock-2310346'].personal.branch).toBe('Manila');
    expect(MOCK_PATIENT_RECORDS['mock-2310345'].type).toBe('Employee');
  });
});
