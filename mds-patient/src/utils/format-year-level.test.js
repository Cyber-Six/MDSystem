import { YEAR_LEVEL_LABELS, formatYearLevel } from './format-year-level';

describe('formatYearLevel', () => {
  it.each([
    ['Grade11', 'Grade 11'],
    ['Masteral', 'Masters'],
    ['Doctorate', 'Doctorate'],
    ['UnknownYear', 'UnknownYear'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatYearLevel(value)).toBe(expected);
  });

  it.each([null, undefined, ''])('returns null for an absent year level (%p)', (value) => {
    expect(formatYearLevel(value)).toBeNull();
  });

  it('exposes an immutable enum-to-label mapping', () => {
    expect(Object.isFrozen(YEAR_LEVEL_LABELS)).toBe(true);
    expect(YEAR_LEVEL_LABELS.Senior).toBe('Senior');
  });
});
