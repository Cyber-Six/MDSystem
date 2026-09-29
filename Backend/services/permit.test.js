jest.mock('../config/db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../utils/logger', () => ({ error: jest.fn(), info: jest.fn(), debug: jest.fn(), warn: jest.fn() }));

const permit = require('./permit');

test('normalizes flat and grouped document permissions with explicit child precedence', () => {
  const result = permit.normalizeTemplatePermissionsInput({
    defaultBranch: 'Manila',
    permissionsList: [{ key: 'document_allow_view', enabled: false }, null],
    permissionGroups: [{ groupId: 'documents', enabled: true, branch: 'Both', children: [{ key: 'document_allow_view', enabled: false, branch: 'QuezonCity' }] }],
  });
  expect(result).toEqual(expect.arrayContaining([
    { key: 'document_allow_view', enabled: false, branch: 'QuezonCity' },
    { key: 'document_allow_manage', enabled: true, branch: 'Both' },
  ]));
  expect(permit.buildPermissionGroups(result)).toEqual([expect.objectContaining({ id: 'documents', enabled: true, fullyEnabled: false, childCount: 3 })]);
});

test('rejects invalid permission and group assignments and resolves overlapping module permissions', () => {
  expect(() => permit.normalizeTemplatePermissionsInput({ permissionsList: [{ key: 'no_such_permission' }] })).toThrow('Invalid permission key');
  expect(() => permit.normalizeTemplatePermissionsInput({ permissionGroups: [{ groupId: 'unknown' }] })).toThrow('Invalid permission group');
  expect(() => permit.normalizeTemplatePermissionsInput({ permissionGroups: [{ groupId: 'documents', children: [{ key: 'is_admin', enabled: true }] }] })).toThrow('is not part of group');
  const resolved = permit.resolveModulePermissions([{ moduleId: 'patientSearch', enabled: true }, { moduleId: 'medicalRecords', enabled: false }]);
  expect(resolved.find(permission => permission.key === 'emr_allow_view').enabled).toBe(true);
  expect(permit.MODULE_LABELS.documents).toBe('Documents');
});
