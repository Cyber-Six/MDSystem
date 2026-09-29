import {
  formatStudentYearLevel,
  getPatientProfileLabel,
  getPatientYearLevelLabel,
} from './patient-year-level';

describe('patient year-level helpers', () => {
  it.each([
    ['Grade11', 'Grade 11'],
    [' first year ', 'Freshman'],
    ['2nd-year', 'Sophomore'],
    ['PHD', 'Doctorate'],
    ['Unknown', 'Unknown'],
    [null, ''],
  ])('formats %p as %p', (year, expected) => {
    expect(formatStudentYearLevel(year)).toBe(expected);
  });

  it.each([
    [{ profile_type: 'employee' }, 'Employee'],
    [{ profile_type: 'student', year: 'YEAR3' }, 'Junior'],
    [{ profile_type: 'student' }, 'Student'],
    [{ profile_type: 'Visitor' }, 'Visitor'],
    [null, ''],
  ])('gets a patient year label', (patient, expected) => {
    expect(getPatientYearLevelLabel(patient)).toBe(expected);
  });

  it.each([
    [{ profile_type: 'student', program: 'BSCS', year: 'Senior' }, 'BSCS · Senior'],
    [{ profile_type: 'student', program: 'BSN' }, 'BSN'],
    [{ profile_type: 'student' }, 'Student'],
    [{ profile_type: 'employee' }, 'Employee'],
    [{ profile_type: 'visitor' }, 'visitor'],
  ])('gets a patient profile label', (patient, expected) => {
    expect(getPatientProfileLabel(patient)).toBe(expected);
  });
});
