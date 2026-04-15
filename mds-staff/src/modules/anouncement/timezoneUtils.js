const DATETIME_LOCAL_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const TIMEZONE_FORMATTER_CACHE = new Map();

const padDatePart = (value) => String(value).padStart(2, '0');

const isValidTimeZone = (timeZone) => {
  if (!timeZone || typeof timeZone !== 'string') return false;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch (error) {
    return false;
  }
};

const resolveTimeZone = (timeZone) => {
  if (isValidTimeZone(timeZone)) return timeZone;
  return getAnnouncementTimeZone();
};

const getFormatterForTimeZone = (timeZone) => {
  if (!TIMEZONE_FORMATTER_CACHE.has(timeZone)) {
    TIMEZONE_FORMATTER_CACHE.set(
      timeZone,
      new Intl.DateTimeFormat('en-CA', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    );
  }

  return TIMEZONE_FORMATTER_CACHE.get(timeZone);
};

const partsToDateObject = (parts) => {
  const valueMap = {};

  for (const part of parts) {
    if (part.type === 'literal') continue;
    valueMap[part.type] = Number(part.value);
  }

  return {
    year: valueMap.year,
    month: valueMap.month,
    day: valueMap.day,
    hour: valueMap.hour,
    minute: valueMap.minute,
    second: valueMap.second,
  };
};

const parseLocalDateTime = (value) => {
  if (typeof value !== 'string') return null;

  const match = value.trim().match(DATETIME_LOCAL_REGEX);
  if (!match) return null;

  const [, year, month, day, hour, minute, second = '00'] = match;

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
};

const toDateFromUtcInput = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const textValue = String(value).trim();
  if (!textValue) return null;

  const hasTimeZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(textValue);
  const normalizedValue = hasTimeZone ? textValue : `${textValue}Z`;
  const parsedDate = new Date(normalizedValue);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const getLocalDateParts = (utcDate, timeZone) => {
  const formatter = getFormatterForTimeZone(timeZone);
  return partsToDateObject(formatter.formatToParts(utcDate));
};

const getTimeZoneOffsetMs = (timeZone, utcMillis) => {
  const parts = getLocalDateParts(new Date(utcMillis), timeZone);
  const utcFromParts = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return utcFromParts - utcMillis;
};

const formatLocalInputValue = (parts) => (
  `${parts.year}-${padDatePart(parts.month)}-${padDatePart(parts.day)}T${padDatePart(parts.hour)}:${padDatePart(parts.minute)}`
);

export const getAnnouncementTimeZone = () => {
  const environmentTimeZone = (import.meta.env.VITE_ANNOUNCEMENT_TIMEZONE || '').trim();
  if (isValidTimeZone(environmentTimeZone)) {
    return environmentTimeZone;
  }

  const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (isValidTimeZone(detectedTimeZone)) {
    return detectedTimeZone;
  }

  return 'UTC';
};

export const toUTC = (localDate, clientTimeZone = getAnnouncementTimeZone()) => {
  if (localDate === null || localDate === undefined || localDate === '') {
    return null;
  }

  if (localDate instanceof Date) {
    return Number.isNaN(localDate.getTime()) ? null : localDate.toISOString();
  }

  const parsedLocalDate = parseLocalDateTime(String(localDate));
  if (!parsedLocalDate) {
    return null;
  }

  const timeZone = resolveTimeZone(clientTimeZone);

  const localAsUtc = Date.UTC(
    parsedLocalDate.year,
    parsedLocalDate.month - 1,
    parsedLocalDate.day,
    parsedLocalDate.hour,
    parsedLocalDate.minute,
    parsedLocalDate.second,
  );

  let utcMillis = localAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offset = getTimeZoneOffsetMs(timeZone, utcMillis);
    const nextUtcMillis = localAsUtc - offset;

    if (Math.abs(nextUtcMillis - utcMillis) < 1000) {
      utcMillis = nextUtcMillis;
      break;
    }

    utcMillis = nextUtcMillis;
  }

  // Prevent impossible local datetimes (for DST gaps) from being accepted.
  const roundTrip = getLocalDateParts(new Date(utcMillis), timeZone);
  const isSameMinute =
    roundTrip.year === parsedLocalDate.year &&
    roundTrip.month === parsedLocalDate.month &&
    roundTrip.day === parsedLocalDate.day &&
    roundTrip.hour === parsedLocalDate.hour &&
    roundTrip.minute === parsedLocalDate.minute;

  if (!isSameMinute) {
    return null;
  }

  return new Date(utcMillis).toISOString();
};

export const toLocal = (utcDate, clientTimeZone = getAnnouncementTimeZone()) => {
  const parsedDate = toDateFromUtcInput(utcDate);
  if (!parsedDate) return '';

  const timeZone = resolveTimeZone(clientTimeZone);
  const localParts = getLocalDateParts(parsedDate, timeZone);

  return formatLocalInputValue(localParts);
};

export const formatAnnouncementDate = (
  utcDate,
  clientTimeZone = getAnnouncementTimeZone(),
  options = { year: 'numeric', month: 'long', day: 'numeric' },
) => {
  const parsedDate = toDateFromUtcInput(utcDate);
  if (!parsedDate) return '';

  const timeZone = resolveTimeZone(clientTimeZone);
  return new Intl.DateTimeFormat('en-US', { timeZone, ...options }).format(parsedDate);
};

export const formatAnnouncementDateTime = (
  utcDate,
  clientTimeZone = getAnnouncementTimeZone(),
  options = { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
) => {
  const parsedDate = toDateFromUtcInput(utcDate);
  if (!parsedDate) return '';

  const timeZone = resolveTimeZone(clientTimeZone);
  return new Intl.DateTimeFormat('en-US', { timeZone, ...options }).format(parsedDate);
};

export const isPastLocalDateTime = (localDate, clientTimeZone = getAnnouncementTimeZone()) => {
  const utcDate = toUTC(localDate, clientTimeZone);
  if (!utcDate) return false;

  return new Date(utcDate).getTime() <= Date.now();
};

export const getLocalMinDateTime = (clientTimeZone = getAnnouncementTimeZone(), minutesFromNow = 1) => {
  const safeMinutes = Number.isFinite(minutesFromNow) ? minutesFromNow : 1;
  const nowInUtc = new Date(Date.now() + safeMinutes * 60 * 1000).toISOString();
  return toLocal(nowInUtc, clientTimeZone);
};
