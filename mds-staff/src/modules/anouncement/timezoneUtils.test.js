import {
  formatAnnouncementDate,
  formatAnnouncementDateTime,
  getAnnouncementTimeZone,
  getLocalMinDateTime,
  isPastLocalDateTime,
  toLocal,
  toUTC,
} from './timezoneUtils';

describe('staff announcement timezone utilities', () => {
  const timeZone = 'Asia/Singapore';

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-01T00:00:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('chooses a valid announcement timezone', () => {
    expect(getAnnouncementTimeZone()).toEqual(expect.any(String));
  });

  it('round-trips local values through UTC', () => {
    const utc = toUTC('2026-05-01T08:30', timeZone);
    expect(utc).toBe('2026-05-01T00:30:00.000Z');
    expect(toLocal(utc, timeZone)).toBe('2026-05-01T08:30');
  });

  it('handles Date inputs, malformed values, and invalid timezone fallbacks', () => {
    expect(toUTC(new Date('2026-05-01T00:00:00.000Z'))).toBe('2026-05-01T00:00:00.000Z');
    expect(toUTC('bad input', timeZone)).toBeNull();
    expect(toLocal('bad input', timeZone)).toBe('');
    expect(toLocal('2026-05-01T00:00:00Z', 'invalid/timezone')).toMatch(/^2026-05-01T/);
  });

  it('formats dates and checks past local values', () => {
    expect(formatAnnouncementDate('2026-05-01T00:00:00Z', timeZone)).toBe('May 1, 2026');
    expect(formatAnnouncementDateTime('2026-05-01T00:00:00Z', timeZone)).toMatch(/May 1, 2026/);
    expect(formatAnnouncementDate('invalid', timeZone)).toBe('');
    expect(isPastLocalDateTime('2026-05-01T08:00', timeZone)).toBe(true);
    expect(isPastLocalDateTime('2026-05-01T08:01', timeZone)).toBe(false);
  });

  it('calculates a timezone-local minimum datetime', () => {
    expect(getLocalMinDateTime(timeZone, 30)).toBe('2026-05-01T08:30');
    expect(getLocalMinDateTime(timeZone, Number.NaN)).toBe('2026-05-01T08:01');
  });
});
