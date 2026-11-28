import {
  detectRoleFromEmail,
  isEmployeeEmail,
  isMedicalEmail,
  isStudentEmail,
  isValidEmailFormat,
  isValidTipEmail,
} from './email-validation';
import { getPasswordError, passwordsMatch, validatePassword } from './password-validation';
import { isUserStaff, isValidStatus, USER_STATUS_VALUES } from './user-constants';
import { detectRoleFromHostname } from '../utils/role-detection';
import { calculateAgeFromDateOfBirth, getDateOfBirthBounds, getDateOfBirthError, getPersonalInfoLengthErrors } from './personal-info';

describe('shared validation utilities', () => {
  it('validates birth dates and calculates age at the birthday boundary', () => {
    const now = new Date(2026, 10, 29);
    expect(getDateOfBirthBounds(now)).toEqual({ min: '1901-11-29', max: '2026-11-29' });
    expect(getDateOfBirthError('', now)).toBe('');
    for (const value of [123, 'bad', '2024-02-30']) expect(getDateOfBirthError(value, now)).toBe('Enter a valid date of birth.');
    expect(getDateOfBirthError('2026-11-30', now)).toContain('future');
    expect(getDateOfBirthError('1901-11-28', now)).toContain('125 years');
    expect(calculateAgeFromDateOfBirth('bad', now)).toBe('');
    expect(calculateAgeFromDateOfBirth('', now)).toBe('');
    expect(calculateAgeFromDateOfBirth('2000-11-30', now)).toBe(25);
    expect(calculateAgeFromDateOfBirth('2000-11-29', now)).toBe(26);
    expect(calculateAgeFromDateOfBirth('2000-12-01', now)).toBe(25);
  });

  it('checks profile, employee and emergency contact length limits', () => {
    expect(getPersonalInfoLengthErrors({})).toEqual([]);
    expect(getPersonalInfoLengthErrors({ surname: 'a'.repeat(51), department: 'b'.repeat(51), emergencyContacts: [null, { contactNumber: '1'.repeat(16) }] }, { isEmployee: true }).map(e => e.field)).toEqual(['surname', 'department', 'emergencyContact2ContactNumber']);
    expect(getPersonalInfoLengthErrors({ surname: 'a'.repeat(51), position: 'b'.repeat(51) }, { includeProfile: false, isEmployee: true }).map(e => e.field)).toEqual(['position']);
  });
  it.each([
    ['msmith@tip.edu.ph', 'Student'],
    ['john.doe@tip.edu.ph', 'Employee'],
    ['doctor.mds@tip.edu.ph', 'Medical'],
    ['invalid@example.com', null],
  ])('classifies %s', (email, role) => {
    expect(detectRoleFromEmail(email)).toBe(role);
  });

  it('validates supported and invalid email shapes', () => {
    expect(isStudentEmail('qstudent12@tip.edu.ph')).toBe(true);
    expect(isEmployeeEmail('first.last@tip.edu.ph')).toBe(true);
    expect(isMedicalEmail('doctor.mds@tip.edu.ph')).toBe(true);
    expect(isValidTipEmail('USER@tip.edu.ph')).toBe(true);
    expect(isValidEmailFormat('user@example.com')).toBe(true);
    expect(isValidEmailFormat('bad-email')).toBe(false);
  });

  it('validates password boundaries and messages', () => {
    expect(validatePassword(12345678)).toBe(false);
    expect(validatePassword('short')).toBe(false);
    expect(validatePassword('a'.repeat(65))).toBe(false);
    expect(validatePassword('a'.repeat(8))).toBe(true);
    expect(getPasswordError(42)).toBe('Password must be a valid string.');
    expect(getPasswordError('short')).toContain('at least');
    expect(getPasswordError('a'.repeat(65))).toContain('not exceed');
    expect(getPasswordError('a'.repeat(8))).toBeNull();
    expect(passwordsMatch('password123', 'password123')).toBe(true);
    expect(passwordsMatch('password123', 'different')).toBe(false);
  });

  it('recognizes user status and host roles', () => {
    expect(USER_STATUS_VALUES).toEqual(['Student', 'Employee', 'Medical']);
    expect(isUserStaff('Medical')).toBe(true);
    expect(isUserStaff('Student')).toBe(false);
    expect(isValidStatus('Employee')).toBe(true);
    expect(isValidStatus('Other')).toBe(false);
    expect(detectRoleFromHostname('STAFF.mdsystemtip.space')).toBe('medical');
    expect(detectRoleFromHostname('www.mdsystemtip.space')).toBe('patient');
    expect(detectRoleFromHostname()).toBe('patient');
  });
});
