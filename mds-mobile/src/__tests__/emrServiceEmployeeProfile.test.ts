/**
 * Tests for buildBatchInputs employee vs student profile differentiation.
 *
 * Verifies that the correct profile type is built depending on whether
 * the user is an employee (has `department`) or a student (has `programId`).
 */

jest.mock('../services/graphql-client', () => ({
  sendGraphQLRequest: jest.fn(),
}));
jest.mock('../core', () => ({
  axiosRequest: jest.fn(),
}));
jest.mock('expo-file-system/legacy', () => ({}));

import { buildBatchInputs, createEmptyFormData, type AllCatalogs } from '../services/emr-service';

const EMPTY_CATALOGS: AllCatalogs = {
  medicalConditionCatalog: [],
  hospitalizationCatalog: [],
  operationCatalog: [],
  medicationCatalog: [],
  immunizationCatalog: [],
  allergenCatalog: [],
  oralApplianceCatalog: [],
  visualAcuityCatalog: [],
  dentalProcedureCatalog: [],
};

const NO_PHOTOS = { upperTeethFileId: null, lowerTeethFileId: null };

function makeStudentFormData(overrides: Record<string, any> = {}) {
  const fd = createEmptyFormData();
  fd.personalInfo = {
    ...fd.personalInfo,
    programId: 'prog-001',
    program: 'BSCS',
    studentCategory: 'Sophomore',
    studentNumber: '2022-00001',
    ...overrides,
  };
  return fd;
}

function makeEmployeeFormData(overrides: Record<string, any> = {}) {
  const fd = createEmptyFormData();
  fd.personalInfo = {
    ...fd.personalInfo,
    employeeId: 'EMP-001',
    department: 'Information Technology',
    employmentCategory: 'Teaching',
    employmentStatus: 'Full time',
    position: 'Instructor',
    ...overrides,
  };
  return fd;
}

// ─── Student profile ──────────────────────────────────────────────────────────

describe('buildBatchInputs — student profile', () => {
  it('builds studentProfile when programId is set and department is empty', () => {
    const inputs = buildBatchInputs(makeStudentFormData(), NO_PHOTOS, EMPTY_CATALOGS);
    expect(inputs.studentProfile).toBeDefined();
    expect(inputs.employeeProfile).toBeUndefined();
  });

  it('studentProfile contains programId and year', () => {
    const inputs = buildBatchInputs(makeStudentFormData(), NO_PHOTOS, EMPTY_CATALOGS);
    expect(inputs.studentProfile.programId).toBe('prog-001');
    expect(inputs.studentProfile.year).toBeTruthy(); // mapped from studentCategory
  });

  it('maps Sophomore studentCategory to Sophomore year enum', () => {
    const inputs = buildBatchInputs(makeStudentFormData({ studentCategory: 'Sophomore' }), NO_PHOTOS, EMPTY_CATALOGS);
    expect(inputs.studentProfile.year).toBe('Sophomore');
  });

  it('maps Grade11 studentCategory to Grade11 year enum', () => {
    const inputs = buildBatchInputs(makeStudentFormData({ studentCategory: 'Grade11' }), NO_PHOTOS, EMPTY_CATALOGS);
    expect(inputs.studentProfile.year).toBe('Grade11');
  });

  it('does not build studentProfile when programId is missing', () => {
    const inputs = buildBatchInputs(makeStudentFormData({ programId: '' }), NO_PHOTOS, EMPTY_CATALOGS);
    expect(inputs.studentProfile).toBeUndefined();
  });
});

// ─── Employee profile ─────────────────────────────────────────────────────────

describe('buildBatchInputs — employee profile', () => {
  it('builds employeeProfile when department is set', () => {
    const inputs = buildBatchInputs(makeEmployeeFormData(), NO_PHOTOS, EMPTY_CATALOGS);
    expect(inputs.employeeProfile).toBeDefined();
    expect(inputs.studentProfile).toBeUndefined();
  });

  it('employeeProfile contains department, role, and position', () => {
    const inputs = buildBatchInputs(makeEmployeeFormData(), NO_PHOTOS, EMPTY_CATALOGS);
    expect(inputs.employeeProfile.department).toBe('Information Technology');
    expect(inputs.employeeProfile.role).toBeTruthy();
    expect(inputs.employeeProfile.position).toBe('Instructor');
  });

  it('maps Teaching employment category to Faculty role', () => {
    const inputs = buildBatchInputs(makeEmployeeFormData({ employmentCategory: 'Teaching' }), NO_PHOTOS, EMPTY_CATALOGS);
    expect(inputs.employeeProfile.role).toBe('Faculty');
  });

  it('maps Teaching (Officer) to AcademicHead role', () => {
    const inputs = buildBatchInputs(makeEmployeeFormData({ employmentCategory: 'Teaching (Officer)' }), NO_PHOTOS, EMPTY_CATALOGS);
    expect(inputs.employeeProfile.role).toBe('AcademicHead');
  });

  it('maps Non-Teaching to Staff role', () => {
    const inputs = buildBatchInputs(makeEmployeeFormData({ employmentCategory: 'Non-Teaching' }), NO_PHOTOS, EMPTY_CATALOGS);
    expect(inputs.employeeProfile.role).toBe('Staff');
  });

  it('maps Non-Teaching (Officer) to AcademicHead role', () => {
    const inputs = buildBatchInputs(makeEmployeeFormData({ employmentCategory: 'Non-Teaching (Officer)' }), NO_PHOTOS, EMPTY_CATALOGS);
    expect(inputs.employeeProfile.role).toBe('AcademicHead');
  });

  it('maps Other category to Other role', () => {
    const inputs = buildBatchInputs(makeEmployeeFormData({ employmentCategory: 'Other' }), NO_PHOTOS, EMPTY_CATALOGS);
    expect(inputs.employeeProfile.role).toBe('Other');
  });

  it('uses employmentCategoryOther as raw category when category is Other', () => {
    // When category is 'Other', the ROLE_MAP uses employmentCategoryOther as the raw category key.
    // 'Consultant' is not in the ROLE_MAP, so it falls back to 'Employee'.
    const inputs = buildBatchInputs(
      makeEmployeeFormData({ employmentCategory: 'Other', employmentCategoryOther: 'Consultant' }),
      NO_PHOTOS,
      EMPTY_CATALOGS,
    );
    expect(inputs.employeeProfile.role).toBe('Employee');
  });

  it('falls back to Employee role for unknown category', () => {
    const inputs = buildBatchInputs(makeEmployeeFormData({ employmentCategory: 'Unknown' }), NO_PHOTOS, EMPTY_CATALOGS);
    expect(inputs.employeeProfile.role).toBe('Employee');
  });

  it('position is empty string when not provided', () => {
    const inputs = buildBatchInputs(makeEmployeeFormData({ position: '' }), NO_PHOTOS, EMPTY_CATALOGS);
    expect(inputs.employeeProfile.position).toBe('');
  });
});

// ─── Mutual exclusivity ───────────────────────────────────────────────────────

describe('buildBatchInputs — student vs employee mutual exclusivity', () => {
  it('does not build employeeProfile for students even when programId is set', () => {
    const inputs = buildBatchInputs(makeStudentFormData(), NO_PHOTOS, EMPTY_CATALOGS);
    expect(inputs.employeeProfile).toBeUndefined();
  });

  it('does not build studentProfile for employees even when programId is accidentally set', () => {
    // If both department and programId are somehow set, employee takes precedence
    const inputs = buildBatchInputs(
      makeEmployeeFormData({ programId: 'prog-001' }),
      NO_PHOTOS,
      EMPTY_CATALOGS,
    );
    // department is set, so employee profile should be built
    expect(inputs.employeeProfile).toBeDefined();
    // programId AND department means student profile is NOT built (department guard)
    expect(inputs.studentProfile).toBeUndefined();
  });

  it('builds neither profile when both programId and department are missing', () => {
    const fd = createEmptyFormData(); // all empty
    const inputs = buildBatchInputs(fd, NO_PHOTOS, EMPTY_CATALOGS);
    expect(inputs.studentProfile).toBeUndefined();
    expect(inputs.employeeProfile).toBeUndefined();
  });
});

// ─── createEmptyFormData ─────────────────────────────────────────────────────

describe('createEmptyFormData — employee fields initialization', () => {
  it('initializes all employee fields to empty string', () => {
    const fd = createEmptyFormData();
    expect(fd.personalInfo.employeeId).toBe('');
    expect(fd.personalInfo.department).toBe('');
    expect(fd.personalInfo.employmentCategory).toBe('');
    expect(fd.personalInfo.employmentCategoryOther).toBe('');
    expect(fd.personalInfo.employmentStatus).toBe('');
    expect(fd.personalInfo.position).toBe('');
  });

  it('still initializes student fields as before', () => {
    const fd = createEmptyFormData();
    expect(fd.personalInfo.studentNumber).toBe('');
    expect(fd.personalInfo.studentCategory).toBe('');
    expect(fd.personalInfo.programId).toBe('');
    expect(fd.personalInfo.program).toBe('');
  });
});
