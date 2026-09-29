import {
  formatAnnouncementDate,
  formatAnnouncementDateTime,
  getLocalMinDateTime,
  isPastLocalDateTime,
  toLocal,
  toUTC,
} from './timezoneUtils';

describe('announcement timezone utilities', () => {
  const timeZone = 'Asia/Singapore';

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-01T00:00:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  test('round trips a local datetime through UTC in the supplied timezone', () => {
    const utc = toUTC('2026-05-01T08:30', timeZone);
    expect(utc).toBe('2026-05-01T00:30:00.000Z');
    expect(toLocal(utc, timeZone)).toBe('2026-05-01T08:30');
  });

  test('handles date inputs, invalid values, and a fallback timezone', () => {
    expect(toUTC(new Date('2026-05-01T00:00:00.000Z'))).toBe('2026-05-01T00:00:00.000Z');
    expect(toUTC('invalid', timeZone)).toBeNull();
    expect(toLocal('invalid', timeZone)).toBe('');
    expect(toLocal('2026-05-01T00:00:00Z', 'invalid/timezone')).toMatch(/^2026-05-01T/);
  });

  test('formats announcement dates and identifies past local datetimes', () => {
    expect(formatAnnouncementDate('2026-05-01T00:00:00Z', timeZone)).toBe('May 1, 2026');
    expect(formatAnnouncementDateTime('2026-05-01T00:00:00Z', timeZone)).toMatch(/May 1, 2026/);
    expect(formatAnnouncementDate('invalid', timeZone)).toBe('');
    expect(isPastLocalDateTime('2026-05-01T08:00', timeZone)).toBe(true);
    expect(isPastLocalDateTime('2026-05-01T08:01', timeZone)).toBe(false);
  });

  test('returns a timezone-local minimum datetime', () => {
    expect(getLocalMinDateTime(timeZone, 30)).toBe('2026-05-01T08:30');
    expect(getLocalMinDateTime(timeZone, Number.NaN)).toBe('2026-05-01T08:01');
  });
});
