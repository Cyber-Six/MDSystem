import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatStudentYearLevel,
  getPatientYearLevelLabel,
  getPatientProfileLabel,
} from '../patient-year-level.js';

describe('formatStudentYearLevel', () => {
  test('maps canonical DB enum values', () => {
    const cases = [
      ['Grade11', 'Grade 11'],
      ['Grade12', 'Grade 12'],
      ['Freshman', 'Freshman'],
      ['Sophomore', 'Sophomore'],
      ['Junior', 'Junior'],
      ['Senior', 'Senior'],
      ['Masteral', 'Masters'],
      ['Doctorate', 'Doctorate'],
    ];

    for (const [input, expected] of cases) {
      assert.equal(formatStudentYearLevel(input), expected);
    }
  });

  test('supports alias permutations for undergraduate and graduate levels', () => {
    const cases = [
      ['first', 'Freshman'],
      ['FIRST YEAR', 'Freshman'],
      ['1st-year', 'Freshman'],
      ['year_1', 'Freshman'],
      ['second', 'Sophomore'],
      ['SECOND YEAR', 'Sophomore'],
      ['2nd-year', 'Sophomore'],
      ['year_2', 'Sophomore'],
      ['third', 'Junior'],
      ['THIRD YEAR', 'Junior'],
      ['3rd-year', 'Junior'],
      ['year_3', 'Junior'],
      ['fourth', 'Senior'],
      ['FOURTH YEAR', 'Senior'],
      ['4th-year', 'Senior'],
      ['year_4', 'Senior'],
      ['master', 'Masters'],
      ['masters', 'Masters'],
      ['masteral', 'Masters'],
      ['doctoral', 'Doctorate'],
      ['doctorate', 'Doctorate'],
      ['phd', 'Doctorate'],
    ];

    for (const [input, expected] of cases) {
      assert.equal(formatStudentYearLevel(input), expected, `Failed for input: ${input}`);
    }
  });

  test('returns empty string for blank-like values', () => {
    const cases = ['', '   ', null, undefined];
    for (const value of cases) {
      assert.equal(formatStudentYearLevel(value), '');
    }
  });

  test('passes unknown values through without destroying input text', () => {
    assert.equal(formatStudentYearLevel('Midyear Irregular'), 'Midyear Irregular');
    assert.equal(formatStudentYearLevel('custom-level-x'), 'custom-level-x');
  });
});

describe('getPatientYearLevelLabel', () => {
  test('returns Employee for any employee profile', () => {
    const cases = [
      { profile_type: 'Employee', year: 'Freshman' },
      { profile_type: 'employee', year: '' },
      { profile_type: 'Employee', year: null },
    ];

    for (const patient of cases) {
      assert.equal(getPatientYearLevelLabel(patient), 'Employee');
    }
  });

  test('returns normalized year labels for students', () => {
    const cases = [
      [{ profile_type: 'Student', year: 'Freshman' }, 'Freshman'],
      [{ profile_type: 'Student', year: 'first year' }, 'Freshman'],
      [{ profile_type: 'student', year: 'MASTERAL' }, 'Masters'],
      [{ profile_type: 'Student', year: 'Doctoral' }, 'Doctorate'],
      [{ profile_type: 'Student', year: 'UnknownLevel' }, 'UnknownLevel'],
      [{ profile_type: 'Student', year: '' }, 'Student'],
      [{ profile_type: 'Student' }, 'Student'],
    ];

    for (const [patient, expected] of cases) {
      assert.equal(getPatientYearLevelLabel(patient), expected);
    }
  });

  test('falls back to profile_type for non-student/employee identities', () => {
    assert.equal(getPatientYearLevelLabel({ profile_type: 'Superior' }), 'Superior');
    assert.equal(getPatientYearLevelLabel({ profile_type: 'Visitor' }), 'Visitor');
    assert.equal(getPatientYearLevelLabel({}), '');
  });
});

describe('getPatientProfileLabel', () => {
  test('combines program and year for student profiles when both are present', () => {
    const value = getPatientProfileLabel({
      profile_type: 'Student',
      program: 'BSIT',
      year: 'FIRST YEAR',
    });

    assert.equal(value, 'BSIT · Freshman');
  });

  test('handles all student combinations of program/year availability', () => {
    const combinations = [
      [{ profile_type: 'Student', program: 'BSCS', year: 'second year' }, 'BSCS · Sophomore'],
      [{ profile_type: 'Student', program: 'BSN', year: '' }, 'BSN'],
      [{ profile_type: 'Student', program: 'BSA', year: null }, 'BSA'],
      [{ profile_type: 'Student', year: 'Doctoral' }, 'Doctorate'],
      [{ profile_type: 'Student', year: 'UnknownLevel' }, 'UnknownLevel'],
      [{ profile_type: 'Student' }, 'Student'],
    ];

    for (const [patient, expected] of combinations) {
      assert.equal(getPatientProfileLabel(patient), expected);
    }
  });

  test('always labels employee profiles as Employee', () => {
    const combinations = [
      { profile_type: 'Employee', department: 'HR', role: 'Manager' },
      { profile_type: 'employee', department: 'IT', role: 'Staff' },
      { profile_type: 'Employee' },
    ];

    for (const patient of combinations) {
      assert.equal(getPatientProfileLabel(patient), 'Employee');
    }
  });

  test('falls back to raw profile type for non-student/employee identities', () => {
    assert.equal(getPatientProfileLabel({ profile_type: 'Superior' }), 'Superior');
    assert.equal(getPatientProfileLabel({ profile_type: 'Visitor' }), 'Visitor');
    assert.equal(getPatientProfileLabel({}), '');
  });
});
