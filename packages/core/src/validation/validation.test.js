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

describe('shared validation utilities', () => {
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
