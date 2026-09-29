import { getDateRangeForPeriod } from '../analytics-service';

describe('analytics loading regression', () => {
  afterEach(() => jest.useRealTimers());

  it('always returns a bounded date range for an unknown period', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-26T12:00:00.000Z'));

    expect(getDateRangeForPeriod('unknown')).toEqual({
      startDate: '2026-03-26',
      endDate: '2026-09-26',
    });
  });
});
