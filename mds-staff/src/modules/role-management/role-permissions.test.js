import {
  DEFAULT_ROLE_TEMPLATES,
  MODULE_PERMISSION_MAP,
  allKeys,
  allModules,
  clonePermissions,
  detectRole,
  expandModulePermissions,
  getModuleState,
  hasCustomPermissions,
  normalizePermissions,
  setModuleKeys,
} from './role-permissions';

describe('role permission helpers', () => {
  it('creates maps for every mapped permission key', () => {
    const enabled = allKeys(true);
    expect(Object.keys(enabled)).toEqual(expect.arrayContaining(MODULE_PERMISSION_MAP.patientSearch));
    expect(Object.values(enabled)).toEqual(expect.arrayContaining([true]));
    expect(allModules(false)).toEqual(allKeys(false));
  });

  it('expands module switches without overwriting a shared enabled key', () => {
    const permissions = expandModulePermissions({ patientSearch: true, medicalRecords: false });
    expect(permissions.profile_allow_view).toBe(true);
    expect(permissions.emr_allow_view).toBe(true);
    expect(permissions.emr_allow_edit).toBe(false);
  });

  it.each([
    [{}, 'patientSearch', 'off'],
    [{ profile_allow_view: true }, 'patientSearch', 'partial'],
    [Object.fromEntries(MODULE_PERMISSION_MAP.patientSearch.map((key) => [key, true])), 'patientSearch', 'on'],
    [{}, 'missing', 'off'],
  ])('reports module state %s', (permissions, moduleId, state) => {
    expect(getModuleState(permissions, moduleId)).toBe(state);
  });

  it('sets only the selected module keys', () => {
    const base = { unrelated: true, emr_allow_view: false };
    const updated = setModuleKeys(base, 'medicalRecords', true);
    expect(base.emr_allow_view).toBe(false);
    expect(updated.unrelated).toBe(true);
    expect(MODULE_PERMISSION_MAP.medicalRecords.every((key) => updated[key])).toBe(true);
    expect(setModuleKeys(base, 'unknown', false)).toEqual(base);
  });

  it('clones without retaining nested references', () => {
    const original = { nested: { enabled: true } };
    const cloned = clonePermissions(original);
    cloned.nested.enabled = false;
    expect(original.nested.enabled).toBe(true);
  });

  it('identifies template, custom, and missing-role permissions', () => {
    const doctor = DEFAULT_ROLE_TEMPLATES.find((role) => role.id === 'doctor');
    expect(detectRole(doctor.permissions)).toBe('doctor');
    expect(hasCustomPermissions(doctor.permissions, 'doctor')).toBe(false);
    expect(hasCustomPermissions({ ...doctor.permissions, emr_allow_view: false }, 'doctor')).toBe(true);
    expect(hasCustomPermissions({}, 'unknown')).toBe(true);
    expect(detectRole({})).toBe('custom');
  });

  it('normalizes known and arbitrary permission values to booleans', () => {
    const permissions = normalizePermissions({ emr_allow_view: 1, custom_key: 'yes' });
    expect(permissions.emr_allow_view).toBe(true);
    expect(permissions.custom_key).toBe(true);
    expect(permissions.emr_allow_edit).toBe(false);
    expect(normalizePermissions({}, true).emr_allow_edit).toBe(true);
  });
});
