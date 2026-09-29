const {
  PatientRoleFromEmail, ValidateBranchbyUserBranch, ValidateLocationDesignation,
  ValidateUserBranchbyUserBranch, deduceRoleFromEmail, detectRoleFromEmail,
  generateDomainCodes, getStudentBranchFromEmail, isEmployeeEmail, isMedicalEmail,
  isStudentEmail, isSuperiorEmail, isUserStaff, isValidEmail, normalizeName,
  normalizeNumber, validatePassword,
} = require('../validator');

describe('identity and email validation', () => {
  test('classifies supported account addresses and rejects invalid addresses', () => {
    expect(isStudentEmail('mabc123@tip.edu.ph')).toBe(true);
    expect(isStudentEmail('bad')).toBe(false);
    expect(isEmployeeEmail('jane.doe@tip.edu.ph')).toBe(true);
    expect(isEmployeeEmail('jane@tip.edu.ph')).toBe(false);
    expect(isMedicalEmail('jane.mds@tip.edu.ph')).toBe(true);
    expect(isMedicalEmail('jane@tip.edu.ph')).toBe(false);
    expect(isSuperiorEmail('jane.superior@tip.edu.ph')).toBe(true);
    expect(isSuperiorEmail('jane@tip.edu.ph')).toBe(false);
    expect(detectRoleFromEmail('mabc123@tip.edu.ph')).toBe('Student');
    expect(detectRoleFromEmail('jane.doe@tip.edu.ph')).toBe('Employee');
    expect(detectRoleFromEmail('jane.doe.superior@tip.edu.ph')).toBe('Superior');
    expect(detectRoleFromEmail('jane.doe.mds@tip.edu.ph')).toBe('Medical');
    expect(detectRoleFromEmail('invalid')).toBeNull();
    expect(deduceRoleFromEmail('mabc123@tip.edu.ph')).toBe('Student');
    expect(deduceRoleFromEmail('jane.doe@tip.edu.ph')).toBe('Employee');
    expect(deduceRoleFromEmail('invalid')).toBeNull();
    expect(PatientRoleFromEmail('jane.mds@tip.edu.ph')).toBe('Employee');
    expect(PatientRoleFromEmail('jane.doe.superior@tip.edu.ph')).toBe('Superior');
    expect(PatientRoleFromEmail('jane.doe.mds@tip.edu.ph')).toBe('Employee');
    expect(PatientRoleFromEmail('mabc123@tip.edu.ph')).toBe('Student');
    expect(PatientRoleFromEmail('invalid')).toBeNull();
    expect(isValidEmail('jane_doe@tip.edu.ph')).toBe(true);
    expect(isValidEmail('bad@email.com')).toBe(false);
  });

  test('handles staff, passwords, branches, and normalizers', () => {
    expect(isUserStaff('Medical')).toBe(true);
    expect(isUserStaff('Patient')).toBe(false);
    expect(validatePassword('12345678')).toBe(true);
    expect(validatePassword('x'.repeat(64))).toBe(true);
    expect(validatePassword('short')).toBe(false);
    expect(validatePassword(null)).toBe(false);
    expect(validatePassword('x'.repeat(65))).toBe(false);
    expect(getStudentBranchFromEmail('qabc123@tip.edu.ph')).toBe('QuezonCity');
    expect(getStudentBranchFromEmail('bad@example.test')).toBeNull();
    expect(getStudentBranchFromEmail('mabc123@tip.edu.ph')).toBe('Manila');
    expect(getStudentBranchFromEmail('mbranch1@tip.edu.ph')).toBe('Manila');
    expect(normalizeName('  jANE   dOE ')).toBe('Jane Doe');
    expect(normalizeNumber('0917-123-4567')).toBe('+639171234567');
    expect(normalizeNumber('+63 (917) 123-4567')).toBe('+639171234567');
    expect(normalizeNumber('')).toBe('+');
  });

  test('generates domain codes and enforces branch access rules', () => {
    expect(generateDomainCodes(['High Blood Pressure', 'A&B'], 'Medical Conditions')).toEqual(['medical_conditions_high_blood_pressure', 'medical_conditions_ab']);
    expect(() => generateDomainCodes(null, 'domain')).toThrow('Domain and names array are required');
    expect(() => generateDomainCodes([], '')).toThrow('Domain and names array are required');
    expect(() => generateDomainCodes([''], 'domain')).toThrow('Name is required to generate code');
    expect(generateDomainCodes(['!'.repeat(80)], 'X'.repeat(80))[0]).toHaveLength(50);
    expect(ValidateLocationDesignation('Both')).toBe(true);
    expect(ValidateLocationDesignation(undefined)).toBe(false);
    expect(ValidateLocationDesignation(3)).toBe(false);
    expect(ValidateLocationDesignation('Other')).toBe(false);
    expect(ValidateBranchbyUserBranch('Manila', 'Arlegui')).toBe(true);
    expect(ValidateBranchbyUserBranch('Manila', 'Casal')).toBe(true);
    expect(ValidateBranchbyUserBranch('QuezonCity', 'QuezonCity')).toBe(true);
    expect(ValidateBranchbyUserBranch('Both', 'anything')).toBe(true);
    expect(ValidateBranchbyUserBranch('QuezonCity', 'Casal')).toBe(false);
    expect(ValidateUserBranchbyUserBranch('Both', 'Manila')).toBe(true);
    expect(ValidateUserBranchbyUserBranch('Manila', 'Manila')).toBe(true);
    expect(ValidateUserBranchbyUserBranch('QuezonCity', 'QuezonCity')).toBe(true);
    expect(ValidateUserBranchbyUserBranch('Manila', 'Both')).toBe(true);
    expect(ValidateUserBranchbyUserBranch('Manila', 'QuezonCity')).toBe(false);
  });
});
