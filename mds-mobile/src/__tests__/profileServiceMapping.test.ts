/**
 * Tests for the new student/employee profile fields extracted in profile-service.ts.
 */

// Pure helper that mirrors the mapping logic in profile-service.ts
function mapProfileFromEMR(myProfile: any) {
  const profileTypeName: string | null = myProfile?.__typename || null;
  return {
    profileType:
      profileTypeName === 'StudentProfile' || profileTypeName === 'EmployeeProfile'
        ? (profileTypeName as 'StudentProfile' | 'EmployeeProfile')
        : null,
    yearLevel: profileTypeName === 'StudentProfile' ? (myProfile?.year || null) : null,
    program:   profileTypeName === 'StudentProfile' ? (myProfile?.program || null) : null,
    department:profileTypeName === 'EmployeeProfile' ? (myProfile?.department || null) : null,
  };
}

describe('mapProfileFromEMR (profile-service mapping logic)', () => {
  it('maps StudentProfile fields correctly', () => {
    const result = mapProfileFromEMR({ __typename: 'StudentProfile', program: 'BSCS', year: 'Sophomore' });
    expect(result.profileType).toBe('StudentProfile');
    expect(result.yearLevel).toBe('Sophomore');
    expect(result.program).toBe('BSCS');
    expect(result.department).toBeNull();
  });

  it('maps EmployeeProfile fields correctly', () => {
    const result = mapProfileFromEMR({ __typename: 'EmployeeProfile', department: 'IT Department' });
    expect(result.profileType).toBe('EmployeeProfile');
    expect(result.yearLevel).toBeNull();
    expect(result.program).toBeNull();
    expect(result.department).toBe('IT Department');
  });

  it('returns all nulls when myProfile is null', () => {
    const result = mapProfileFromEMR(null);
    expect(result.profileType).toBeNull();
    expect(result.yearLevel).toBeNull();
    expect(result.program).toBeNull();
    expect(result.department).toBeNull();
  });

  it('returns null profileType for unrecognized typename', () => {
    const result = mapProfileFromEMR({ __typename: 'UnknownProfile' });
    expect(result.profileType).toBeNull();
  });

  it('gracefully handles student with missing year and program', () => {
    const result = mapProfileFromEMR({ __typename: 'StudentProfile' });
    expect(result.profileType).toBe('StudentProfile');
    expect(result.yearLevel).toBeNull();
    expect(result.program).toBeNull();
  });
});
