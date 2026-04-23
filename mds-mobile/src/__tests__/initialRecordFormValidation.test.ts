/**
 * Tests for validatePersonalInfoFields — the exported pure validation helper
 * that determines which fields are required for students vs employees.
 */

// Mock all modules that are imported at module level by InitialRecordFormScreen
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}));
jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ isDark: false }),
  colors: {
    neutral: {}, primary: {}, secondary: {}, error: { 500: '#ff0000' }, success: {},
  },
}));
jest.mock('../context/RecordStatusContext', () => ({
  useRecordStatus: () => ({ refreshRecordStatus: jest.fn(), recordStatus: null, isRecordLoading: false }),
}));
jest.mock('../components/ui/ProgressStepper', () => ({ ProgressStepper: () => null }));
jest.mock('../components/layout/TopBar', () => ({ TopBar: () => null }));
jest.mock('../navigation/drawer-utils', () => ({ toggleAppDrawer: jest.fn() }));
jest.mock('../screens/record-forms/steps/PersonalInfoStep', () => () => null);
jest.mock('../screens/record-forms/steps/MedicalHistoryStep', () => () => null);
jest.mock('../screens/record-forms/steps/MedicalBackgroundStep', () => () => null);
jest.mock('../screens/record-forms/steps/DentalHistoryStep', () => () => null);
jest.mock('../screens/record-forms/steps/ObGyneStep', () => () => null);
jest.mock('../screens/record-forms/steps/ReviewStep', () => () => null);
jest.mock('../services/emr-service', () => ({
  createEmptyFormData: () => ({
    personalInfo: {
      surname: '', firstName: '', middleName: '', suffix: '',
      birthday: '', age: '', gender: '', civilStatus: '',
      nationality: '', religion: '', address: '', provinceAddress: '',
      contactNumber: '', program: '', programId: '', programOther: '',
      studentNumber: '', studentCategory: '', drugTestDone: '',
      lastSchoolAttended: '',
      employeeId: '', department: '', employmentCategory: '',
      employmentCategoryOther: '', employmentStatus: '', position: '',
      emergencyContacts: [
        { name: '', relationship: '', contactNumber: '', address: '' },
        { name: '', relationship: '', contactNumber: '', address: '' },
      ],
    },
    medicalHistory: { self: {}, family: {}, familyWhoHasIt: {}, selfOther: '', selfOtherChecked: false, familyOther: '', familyOtherWhoHasIt: '', familyOtherChecked: false },
    medicalBackground: { immunizations: {}, immunizationDetails: {}, immunizationOther: '', hasAllergies: '', allergies: {}, allergyOther: '', allergyNotes: '', hasHospitalization: '', hospitalizationConditions: {}, hospitalizationDates: {}, hospitalizationDate: '', hospitalizationDischargeDate: '', hospitalizationNotes: '', hasOperation: '', operationConditions: {}, operationDates: {}, operationDate: '', operationNotes: '', hasMedications: '', selectedMedications: {}, medicationReason: '', medicationNotes: '', medicationDescription: '', smoker: 'no', smokerSticksPerDay: '', smokerYears: '', alcoholDrinker: 'no', alcoholFrequency: '', vaper: 'no', vapeType: '', vapeFrequency: '', yearsVaping: '', eyeglasses: false, contactLenses: false, gradeOD: '', gradeOS: '', visualAcuityDate: '' },
    dentalHistory: { firstTimeDentist: '', lastDentalConsultation: '', lastDentalCleaning: '', purpose: '', hasIntraOralAppliance: '', intraOralAppliances: {}, applianceOther: '', applianceLocation: '', selectedDentalProcedures: {}, procedureDates: {}, upperTeethPhoto: null, lowerTeethPhoto: null },
    obgyne: { lastMenstrualPeriod: '', menstruationDuration: '', menarcheYearAge: '', padsPerDay: '', dysmenorrhea: '' },
    certification: { verified: false, fullName: '', date: '' },
  }),
  fetchAllCatalogs: jest.fn().mockResolvedValue({}),
  createInitialMedicalRecord: jest.fn(),
  submitUpdateRecord: jest.fn(),
  fetchRevisionPrefill: jest.fn().mockResolvedValue(null),
  ensureUpdateTicket: jest.fn().mockResolvedValue(null),
  getUpdateTicketStatus: jest.fn().mockResolvedValue(null),
}));
jest.mock('../services/profile-service', () => ({
  getPatientProfile: jest.fn().mockResolvedValue({ identity: 'Student' }),
}));

import { validatePersonalInfoFields } from '../screens/record-forms/InitialRecordFormScreen';
import type { FormData } from '../services/emr-service';

type PersonalInfo = FormData['personalInfo'];

const VALID_CONTACTS: PersonalInfo['emergencyContacts'] = [
  { name: 'Jane Doe', relationship: 'Mother', contactNumber: '09171234567', address: '' },
  { name: 'John Doe', relationship: 'Father', contactNumber: '09171234568', address: '' },
];

function makeStudentPersonalInfo(overrides: Partial<PersonalInfo> = {}): PersonalInfo {
  return {
    surname: 'Dela Cruz', firstName: 'Juan', middleName: '', suffix: '',
    birthday: '2000-01-01', age: '24', gender: 'Male', civilStatus: 'Single',
    nationality: 'Filipino', religion: '', address: '123 Main St', provinceAddress: 'Batangas',
    contactNumber: '09171234567',
    program: 'BSCS', programId: 'prog-001', programOther: '',
    studentNumber: '2022-00001', studentCategory: 'Sophomore',
    drugTestDone: '', lastSchoolAttended: '',
    employeeId: '', department: '', employmentCategory: '',
    employmentCategoryOther: '', employmentStatus: '', position: '',
    emergencyContacts: VALID_CONTACTS,
    ...overrides,
  };
}

function makeEmployeePersonalInfo(overrides: Partial<PersonalInfo> = {}): PersonalInfo {
  return {
    surname: 'Reyes', firstName: 'Maria', middleName: '', suffix: '',
    birthday: '1985-06-15', age: '39', gender: 'Female', civilStatus: 'Married',
    nationality: 'Filipino', religion: '', address: '456 Maple Ave', provinceAddress: 'Laguna',
    contactNumber: '09171234567',
    program: '', programId: '', programOther: '',
    studentNumber: '', studentCategory: '',
    drugTestDone: '', lastSchoolAttended: '',
    employeeId: 'EMP-001', department: 'Information Technology',
    employmentCategory: 'Teaching', employmentCategoryOther: '', employmentStatus: 'Full time',
    position: 'Instructor',
    emergencyContacts: VALID_CONTACTS,
    ...overrides,
  };
}

const STUDENT_OPTS = { isEmployee: false, isUpdate: false, isRevision: false };
const EMPLOYEE_OPTS = { isEmployee: true, isUpdate: false, isRevision: false };
const UPDATE_OPTS_STUDENT = { isEmployee: false, isUpdate: true, isRevision: false };
const UPDATE_OPTS_EMPLOYEE = { isEmployee: true, isUpdate: true, isRevision: false };

// ─── Student validation ───────────────────────────────────────────────────────

describe('validatePersonalInfoFields — student (initial record)', () => {
  it('passes with valid complete student data', () => {
    expect(validatePersonalInfoFields(makeStudentPersonalInfo(), STUDENT_OPTS)).toHaveLength(0);
  });

  it('requires studentNumber', () => {
    const errors = validatePersonalInfoFields(makeStudentPersonalInfo({ studentNumber: '' }), STUDENT_OPTS);
    expect(errors).toContain('Student number is required');
  });

  it('rejects studentNumber with special characters', () => {
    const errors = validatePersonalInfoFields(makeStudentPersonalInfo({ studentNumber: '2022/00001!' }), STUDENT_OPTS);
    expect(errors).toContain('Student number must contain only letters, numbers, and dashes');
  });

  it('requires programId for non-revision initial records', () => {
    const errors = validatePersonalInfoFields(makeStudentPersonalInfo({ programId: '' }), STUDENT_OPTS);
    expect(errors).toContain('Program is required - please select one from the search results');
  });

  it('requires studentCategory', () => {
    const errors = validatePersonalInfoFields(makeStudentPersonalInfo({ studentCategory: '' }), STUDENT_OPTS);
    expect(errors).toContain('Student category is required');
  });

  it('requires valid contact number', () => {
    const errors = validatePersonalInfoFields(makeStudentPersonalInfo({ contactNumber: '12345' }), STUDENT_OPTS);
    expect(errors).toContain('Contact number must be a valid PH number (e.g. 09171234567)');
  });

  it('accepts +63 format contact number', () => {
    const errors = validatePersonalInfoFields(makeStudentPersonalInfo({ contactNumber: '+639171234567' }), STUDENT_OPTS);
    expect(errors).not.toContain('Contact number must be a valid PH number (e.g. 09171234567)');
  });
});

// ─── Employee validation ──────────────────────────────────────────────────────

describe('validatePersonalInfoFields — employee (initial record)', () => {
  it('passes with valid complete employee data', () => {
    expect(validatePersonalInfoFields(makeEmployeePersonalInfo(), EMPLOYEE_OPTS)).toHaveLength(0);
  });

  it('requires employeeId', () => {
    const errors = validatePersonalInfoFields(makeEmployeePersonalInfo({ employeeId: '' }), EMPLOYEE_OPTS);
    expect(errors).toContain('Employee ID number is required');
  });

  it('requires department', () => {
    const errors = validatePersonalInfoFields(makeEmployeePersonalInfo({ department: '' }), EMPLOYEE_OPTS);
    expect(errors).toContain('Department is required');
  });

  it('requires employmentCategory', () => {
    const errors = validatePersonalInfoFields(makeEmployeePersonalInfo({ employmentCategory: '' }), EMPLOYEE_OPTS);
    expect(errors).toContain('Employment category is required');
  });

  it('requires employmentCategoryOther when category is Other', () => {
    const errors = validatePersonalInfoFields(
      makeEmployeePersonalInfo({ employmentCategory: 'Other', employmentCategoryOther: '' }),
      EMPLOYEE_OPTS,
    );
    expect(errors).toContain('Please specify employment category');
  });

  it('passes when category is Other and employmentCategoryOther is filled', () => {
    const errors = validatePersonalInfoFields(
      makeEmployeePersonalInfo({ employmentCategory: 'Other', employmentCategoryOther: 'Consultant' }),
      EMPLOYEE_OPTS,
    );
    expect(errors).not.toContain('Please specify employment category');
  });

  it('requires employmentStatus', () => {
    const errors = validatePersonalInfoFields(makeEmployeePersonalInfo({ employmentStatus: '' }), EMPLOYEE_OPTS);
    expect(errors).toContain('Employment status is required');
  });
});

// ─── Cross-contamination — student vs employee field isolation ────────────────

describe('validatePersonalInfoFields — no cross-contamination', () => {
  it('does NOT require studentNumber for employees', () => {
    const errors = validatePersonalInfoFields(makeEmployeePersonalInfo({ studentNumber: '' }), EMPLOYEE_OPTS);
    expect(errors).not.toContain('Student number is required');
  });

  it('does NOT require programId for employees', () => {
    const errors = validatePersonalInfoFields(makeEmployeePersonalInfo({ programId: '' }), EMPLOYEE_OPTS);
    expect(errors).not.toContain('Program is required - please select one from the search results');
    expect(errors).not.toContain('Program is required');
  });

  it('does NOT require studentCategory for employees', () => {
    const errors = validatePersonalInfoFields(makeEmployeePersonalInfo({ studentCategory: '' }), EMPLOYEE_OPTS);
    expect(errors).not.toContain('Student category is required');
  });

  it('does NOT require employeeId for students', () => {
    const errors = validatePersonalInfoFields(makeStudentPersonalInfo({ employeeId: '' }), STUDENT_OPTS);
    expect(errors).not.toContain('Employee ID number is required');
  });

  it('does NOT require department for students', () => {
    const errors = validatePersonalInfoFields(makeStudentPersonalInfo({ department: '' }), STUDENT_OPTS);
    expect(errors).not.toContain('Department is required');
  });

  it('does NOT require employmentCategory for students', () => {
    const errors = validatePersonalInfoFields(makeStudentPersonalInfo({ employmentCategory: '' }), STUDENT_OPTS);
    expect(errors).not.toContain('Employment category is required');
  });
});

// ─── Update mode ─────────────────────────────────────────────────────────────

describe('validatePersonalInfoFields — update mode (isUpdate=true)', () => {
  it('skips personal info fields for students in update mode', () => {
    const errors = validatePersonalInfoFields(makeStudentPersonalInfo({ surname: '', firstName: '' }), UPDATE_OPTS_STUDENT);
    expect(errors).not.toContain('Surname is required');
    expect(errors).not.toContain('First name is required');
  });

  it('skips personal info fields for employees in update mode', () => {
    const errors = validatePersonalInfoFields(makeEmployeePersonalInfo({ surname: '', firstName: '', employeeId: '' }), UPDATE_OPTS_EMPLOYEE);
    expect(errors).not.toContain('Surname is required');
    expect(errors).not.toContain('Employee ID number is required');
  });

  it('still requires program for student updates (via pi.program)', () => {
    const errors = validatePersonalInfoFields(makeStudentPersonalInfo({ program: '' }), UPDATE_OPTS_STUDENT);
    expect(errors).toContain('Program is required');
  });

  it('still requires studentCategory for student updates', () => {
    const errors = validatePersonalInfoFields(makeStudentPersonalInfo({ studentCategory: '' }), UPDATE_OPTS_STUDENT);
    expect(errors).toContain('Student category is required');
  });
});

// ─── Revision mode ───────────────────────────────────────────────────────────

describe('validatePersonalInfoFields — revision mode (isRevision=true)', () => {
  it('uses pi.program (not programId) for revision validation', () => {
    const revisionOpts = { isEmployee: false, isUpdate: false, isRevision: true };
    // programId missing but program present — should not error on programId
    const errors = validatePersonalInfoFields(
      makeStudentPersonalInfo({ programId: '', program: 'BSCS' }),
      revisionOpts,
    );
    expect(errors).not.toContain('Program is required - please select one from the search results');
    expect(errors).not.toContain('Program is required');
  });

  it('errors if program is also missing in revision', () => {
    const revisionOpts = { isEmployee: false, isUpdate: false, isRevision: true };
    const errors = validatePersonalInfoFields(
      makeStudentPersonalInfo({ programId: '', program: '' }),
      revisionOpts,
    );
    expect(errors).toContain('Program is required');
  });
});
