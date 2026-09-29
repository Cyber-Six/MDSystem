import { formatBranchLabel, getLocationsByBranch } from './branch-utils';

describe('staff branch utilities', () => {
  test.each([
    ['Manila', ['Arlegui', 'Casal']],
    ['QuezonCity', ['QuezonCity']],
    ['Both', ['Arlegui', 'Casal', 'QuezonCity']],
    ['Unknown', []],
    [null, []],
  ])('maps %p to allowed locations', (branch, expected) => {
    expect(getLocationsByBranch(branch)).toEqual(expected);
  });

  test.each([
    [null, {}, null],
    [undefined, { fallback: 'Unknown' }, 'Unknown'],
    [' ', { fallback: 'Unknown' }, 'Unknown'],
    ['both', {}, 'MLA & QC'],
    ['both', { includeBothSuffix: true }, 'MLA & QC (Both)'],
    [' QC ', {}, 'Quezon City'],
    ['manila', {}, 'Manila'],
    ['Satellite', {}, 'Satellite'],
  ])('formats %p with options %p', (branch, options, expected) => {
    expect(formatBranchLabel(branch, options)).toBe(expected);
  });
});
