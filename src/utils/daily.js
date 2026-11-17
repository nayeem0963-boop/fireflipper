/**
 * Daily challenge helpers. Everyone who plays on the same UTC date gets the
 * same seeded track, so scores are comparable.
 */

/** UTC calendar date as 'YYYY-MM-DD'. */
export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** The previous UTC calendar date. */
export function yesterdayKey(date = new Date()) {
  return todayKey(new Date(date.getTime() - 86400000));
}

/** Stable 32-bit seed for a date key (FNV-1a hash). */
export function seedForKey(key) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
