/**
 * Safe localStorage wrapper. Storage can be unavailable (private mode,
 * blocked cookies, embedded webviews), so every access is guarded and the
 * game keeps working with in-memory defaults.
 */
const PREFIX = 'fireflapper:';

export function loadValue(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveValue(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable — ignore */
  }
}
