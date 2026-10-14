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
  test('keeps free-text categories out of the enum role field', () => {
    expect(roleForStorage('Other')).toBe('Other');
    expect(roleForStorage('Teaching')).toBe('NonStaff');
    expect(roleForStorage('Teaching (Officer)')).toBe('NonStaffOfficer');
    expect(roleForStorage('Non-Teaching')).toBe('Staff');
    expect(roleForStorage('Non-Teaching (Officer)')).toBe('StaffOfficer');
  });

  test('reads the custom category column and keeps known roles as enum categories', () => {
    expect(employeeCategoryFromRole('Other', 'Research officer')).toBe('Research officer');
    expect(employeeCategoryFromRole('Research officer')).toBe('Research officer');
    expect(employeeCategoryFromRole('Staff')).toBe('Non-Teaching');
    expect(employeeCategoryFromRole('')).toBeNull();
    expect(employeeCategoryFromRole(null)).toBeNull();
  });
});
