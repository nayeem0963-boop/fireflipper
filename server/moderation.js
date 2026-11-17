import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';

/**
 * Display-name rules for the leaderboard.
 *
 *  1. Shape: 3-16 letters/numbers/spaces/_/-, at least two letters or numbers.
 *     NFKC normalisation first, so full-width and similar look-alike forms count as plain text.
 *  2. Reserved names that could pass for the game's staff or site.
 *  3. Profanity/slur detection (the `obscenity` English dataset: handles leetspeak, repeated
 *     letters and common evasions, and avoids "Scunthorpe"-style false positives). The name is
 *     also checked with separators removed, so "f u c k" and "f_u_c_k" are caught.
 *
 * The error for a blocked name is deliberately generic, so it doesn't reveal what matched.
 * This is a first line of defence, not a guarantee: filters miss things and flag a few innocent
 * names, so removal of an existing row by hand is still needed for the rest.
 */
const SHAPE = /^[\p{L}\p{N} _-]{3,16}$/u;
const RESERVED = [
  'admin',
  'administrator',
  'moderator',
  'mod',
  'staff',
  'support',
  'official',
  'fireflipper',
  'system',
  'server',
];
const BLOCKED_MESSAGE = 'That name is not allowed. Please pick another.';

const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });

const squash = (s) => s.toLowerCase().replace(/[\s_-]+/g, '');

/** Returns { ok: true, name } with the cleaned name, or { ok: false, error }. */
export function validateName(raw) {
  if (typeof raw !== 'string')
    return { ok: false, error: 'Name must be 3-16 letters, numbers, spaces, _ or -' };
  const name = raw.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!SHAPE.test(name) || (name.match(/[\p{L}\p{N}]/gu) ?? []).length < 2) {
    return { ok: false, error: 'Name must be 3-16 letters, numbers, spaces, _ or -' };
  }
  const flat = squash(name);
  if (RESERVED.includes(flat)) return { ok: false, error: BLOCKED_MESSAGE };
  if (matcher.hasMatch(name) || matcher.hasMatch(flat)) return { ok: false, error: BLOCKED_MESSAGE };
  return { ok: true, name };
}
