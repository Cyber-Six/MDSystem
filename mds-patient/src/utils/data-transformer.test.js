import {
  formatDate,
  logDataStructure,
  sanitizeFormData,
  validateFormData,
} from './data-transformer';

describe('validateFormData', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  test('reports missing required sections and fields', () => {
    expect(validateFormData({})).toEqual({
      isValid: false,
      errors: ['Missing personalInfo section', 'Need at least 2 emergency contacts'],
      warnings: ['Missing medicalHistory section', 'Missing medicalBackground section', 'Missing dentalHistory section'],
    });
  });

  test('keeps personal-field diagnostics while a complete form is valid', () => {
    const incompletePersonal = validateFormData({
      personalInfo: { emergencyContacts: [{}, {}] },
      medicalHistory: {}, medicalBackground: {}, dentalHistory: {},
    });
    expect(incompletePersonal.errors).toEqual([
      'Missing surname', 'Missing firstName', 'Missing birthday', 'Missing gender',
    ]);
    expect(incompletePersonal.isValid).toBe(true);

    expect(validateFormData({
      personalInfo: { surname: 'Doe', firstName: 'Jane', birthday: '2000-01-01', gender: 'Female', emergencyContacts: [{}, {}] },
      medicalHistory: {}, medicalBackground: {}, dentalHistory: {},
    })).toEqual({ isValid: true, errors: [], warnings: [] });
  });
});

describe('sanitizeFormData and date helpers', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  test('creates required sections without mutating the source and normalizes lifestyle flags', () => {
    const source = { medicalBackground: { smoker: true, alcoholDrinker: 'no', vaper: false } };
    const sanitized = sanitizeFormData(source);

    expect(sanitized).not.toBe(source);
    expect(source.personalInfo).toBeUndefined();
    expect(sanitized.personalInfo.emergencyContacts).toHaveLength(2);
    expect(sanitized.medicalHistory).toEqual({ self: {}, family: {} });
    expect(sanitized.medicalBackground).toEqual({ smoker: 'yes', alcoholDrinker: 'no', vaper: 'no' });
    expect(sanitized.dentalHistory).toEqual({});
    expect(sanitized.obgyne).toEqual({});
    expect(sanitized.certification).toEqual({});
  });

  test.each([
    [null, null],
    ['', null],
    ['invalid', null],
    ['2026-05-01T12:00:00.000Z', '2026-05-01'],
  ])('formatDate(%p) returns %p', (input, expected) => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(formatDate(input)).toBe(expected);
    jest.restoreAllMocks();
  });

  test('logs a labelled data structure', () => {
    const group = jest.spyOn(console, 'group').mockImplementation(() => {});
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const groupEnd = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});
    logDataStructure({ id: 1 }, 'Patient form');
    expect(group).toHaveBeenCalledWith('[Data Transformer] Patient form');
    expect(log).toHaveBeenCalledWith('Keys:', ['id']);
    expect(groupEnd).toHaveBeenCalled();
  });
});
