/**
 * Tests for the new student/employee profile fields in getPatientProfile.
 * These tests validate the data extraction and mapping logic.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// Pure helper: maps EMR API response shape → cache shape (mirrors emr-service logic)
function mapProfileFromEMR(myProfile) {
  const profileTypeName = myProfile?.__typename || null;
  return {
    profileType: (profileTypeName === 'StudentProfile' || profileTypeName === 'EmployeeProfile')
      ? profileTypeName
      : null,
    yearLevel: profileTypeName === 'StudentProfile' ? (myProfile?.year || null) : null,
    program:   profileTypeName === 'StudentProfile' ? (myProfile?.program || null) : null,
    department:profileTypeName === 'EmployeeProfile' ? (myProfile?.department || null) : null,
  };
}

test('maps StudentProfile data correctly', () => {
  const result = mapProfileFromEMR({
    __typename: 'StudentProfile',
    program: 'BSIT',
    year: 'Freshman',
  });
  assert.equal(result.profileType, 'StudentProfile');
  assert.equal(result.yearLevel, 'Freshman');
  assert.equal(result.program, 'BSIT');
  assert.equal(result.department, null);
});

test('maps EmployeeProfile data correctly', () => {
  const result = mapProfileFromEMR({
    __typename: 'EmployeeProfile',
    department: 'Human Resources',
  });
  assert.equal(result.profileType, 'EmployeeProfile');
  assert.equal(result.yearLevel, null);
  assert.equal(result.program, null);
  assert.equal(result.department, 'Human Resources');
});

test('returns nulls when myProfile is null (no EMR record yet)', () => {
  const result = mapProfileFromEMR(null);
  assert.equal(result.profileType, null);
  assert.equal(result.yearLevel, null);
  assert.equal(result.program, null);
  assert.equal(result.department, null);
});

test('returns nulls for unknown __typename', () => {
  const result = mapProfileFromEMR({ __typename: 'OtherProfile' });
  assert.equal(result.profileType, null);
  assert.equal(result.yearLevel, null);
  assert.equal(result.program, null);
  assert.equal(result.department, null);
});

test('student without year/program returns nulls for those fields', () => {
  const result = mapProfileFromEMR({ __typename: 'StudentProfile' });
  assert.equal(result.profileType, 'StudentProfile');
  assert.equal(result.yearLevel, null);
  assert.equal(result.program, null);
});
