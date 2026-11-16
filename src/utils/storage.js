/**
 * Safe localStorage wrapper. Storage can be unavailable (private mode,
 * blocked cookies, embedded webviews), so every access is guarded and the
 * game keeps working with in-memory defaults.
 */
const PREFIX = 'fireflipper:';
/** Prefix used before the project was renamed; values are migrated once on read. */
const LEGACY_PREFIX = 'fireflapper:';

export function loadValue(key, fallback) {
  try {
    const store = window.localStorage;
    let raw = store.getItem(PREFIX + key);
    if (raw === null) {
      const legacy = store.getItem(LEGACY_PREFIX + key);
      if (legacy !== null) {
        store.setItem(PREFIX + key, legacy);
        store.removeItem(LEGACY_PREFIX + key);
        raw = legacy;
      }
    }
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveValue(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable: ignore */
  }
}
