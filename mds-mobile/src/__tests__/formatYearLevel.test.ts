import { formatYearLevel, YEAR_LEVEL_LABELS } from '../utils/formatYearLevel';

describe('formatYearLevel', () => {
  it('returns null for empty/nullish values', () => {
    expect(formatYearLevel(null)).toBeNull();
    expect(formatYearLevel(undefined)).toBeNull();
    expect(formatYearLevel('')).toBeNull();
  });

  it('maps all STUDENT_YEAR enum values to display labels', () => {
    const cases: Array<[string, string]> = [
      ['Grade11',   'Grade 11'],
      ['Grade12',   'Grade 12'],
      ['Freshman',  'Freshman'],
      ['Sophomore', 'Sophomore'],
      ['Junior',    'Junior'],
      ['Senior',    'Senior'],
      ['Masteral',  'Masters'],
      ['Doctorate', 'Doctorate'],
      ['Transferee','Transferee'],
      ['Returnee',  'Returnee'],
    ];
    for (const [input, expected] of cases) {
      expect(formatYearLevel(input)).toBe(expected);
    }
  });

  it('passes through unrecognized values unchanged', () => {
    expect(formatYearLevel('CustomLevel')).toBe('CustomLevel');
  });
});

describe('YEAR_LEVEL_LABELS', () => {
  it('contains entries for all 10 STUDENT_YEAR enum values', () => {
    expect(Object.keys(YEAR_LEVEL_LABELS)).toHaveLength(10);
  });
});
