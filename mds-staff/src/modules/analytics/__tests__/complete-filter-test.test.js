import { ACADEMIC_PROGRAM_FILTER_OPTIONS, SEX_FILTER_OPTIONS } from '../analytics-service';

describe('analytics filter regression', () => {
  it('ships the required canonical filter values', () => {
    expect(ACADEMIC_PROGRAM_FILTER_OPTIONS).toContain('BS Computer Science');
    expect(SEX_FILTER_OPTIONS).toEqual(['Male', 'Female']);
  });
});
