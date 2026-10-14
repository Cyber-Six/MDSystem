const {
  decodeOralApplianceNotes,
  encodeOralApplianceNotes,
  employeeCategoryFromRole,
  roleForStorage,
} = require('./custom-choice-storage');

describe('oral appliance custom-choice storage', () => {
  test('preserves ordinary notes when no custom value is present', () => {
    expect(encodeOralApplianceNotes('Routine checkup')).toBe('Routine checkup');
    expect(decodeOralApplianceNotes('Routine checkup')).toEqual({
      notes: 'Routine checkup',
      otherDescription: null,
      otherArch: null,
    });
  });

  test('round-trips notes, custom description, and custom location', () => {
    const encoded = encodeOralApplianceNotes('Follow-up needed', {
      otherDescription: 'Custom retainer',
      otherArch: 'Upper',
    });

    expect(decodeOralApplianceNotes(encoded)).toEqual({
      notes: 'Follow-up needed',
      otherDescription: 'Custom retainer',
      otherArch: 'Upper',
    });
  });

  test('keeps legacy values and malformed metadata readable', () => {
    expect(decodeOralApplianceNotes(null)).toEqual({
      notes: null,
      otherDescription: null,
      otherArch: null,
    });
    expect(decodeOralApplianceNotes('ORAL_APPLIANCE_META::{invalid')).toEqual({
      notes: 'ORAL_APPLIANCE_META::{invalid',
      otherDescription: null,
      otherArch: null,
    });
  });
});

describe('employee custom employment category storage', () => {
  test('stores a custom category in the role field only for Other', () => {
    expect(roleForStorage('Other', 'Research officer')).toBe('Research officer');
    expect(roleForStorage('Non-Teaching', 'Research officer')).toBe('Non-Teaching');
    expect(roleForStorage('Other', '   ')).toBe('Other');
  });

  test('reads legacy custom roles while keeping known roles as enum categories', () => {
    expect(employeeCategoryFromRole('Research officer')).toBe('Research officer');
    expect(employeeCategoryFromRole('Non-Teaching')).toBeNull();
    expect(employeeCategoryFromRole('')).toBeNull();
    expect(employeeCategoryFromRole(null)).toBeNull();
  });
});
