/**
 * Reads a JSON-encoded value from localStorage and validates it.
 * Falls back safely when storage is unavailable or value is invalid.
 */
export const readPersistedViewState = (storageKey, fallbackValue, isValid) => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw == null) return fallbackValue;
    const parsed = JSON.parse(raw);

    if (typeof isValid === 'function' && !isValid(parsed)) {
      return fallbackValue;
    }

    return parsed;
  } catch {
    return fallbackValue;
  }
};

/**
 * Writes a JSON-encoded value to localStorage.
 */
export const writePersistedViewState = (storageKey, value) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Ignore write failures (e.g. private mode or storage quota)
  }
};
