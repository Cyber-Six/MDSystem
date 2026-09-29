import {
  CODE_TO_ENUM,
  ENUM_TO_CODE,
  LEGENDS,
  ORAL_FINDINGS,
  TOOTH_LAYOUT,
  getLegend,
} from './tooth-chart-constants';

describe('tooth chart constants', () => {
  it('looks up each configured legend and leaves unknown codes absent', () => {
    for (const legend of LEGENDS) {
      expect(getLegend(legend.code)).toBe(legend);
    }
    expect(getLegend('UNKNOWN')).toBeUndefined();
  });

  it('keeps the FDI layout complete and non-overlapping', () => {
    const teeth = Object.values(TOOTH_LAYOUT).flatMap((arch) => Object.values(arch).flat());
    expect(teeth).toHaveLength(32);
    expect(new Set(teeth).size).toBe(32);
    expect(teeth).toEqual(expect.arrayContaining([11, 18, 21, 28, 31, 38, 41, 48]));
  });

  it('maintains reciprocal oral-status mappings and the oral-finding catalogue', () => {
    for (const [code, enumValue] of Object.entries(CODE_TO_ENUM)) {
      expect(ENUM_TO_CODE[enumValue]).toBe(code);
    }
    expect(ORAL_FINDINGS).toEqual(expect.arrayContaining(['CALCULUS', 'GINGIVITIS']));
  });
});
