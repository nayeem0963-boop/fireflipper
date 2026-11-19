import { newlyUnlocked } from '../skins/skins.js';

/**
 * Progression: lifetime stats, achievements, a daily goal and the "next goal" shown between runs.
 * Pure functions, no React, unit-testable (scripts/progression-test.mjs). Everything here is rewards and
 * bookkeeping: nothing in it feeds back into the simulation.
 *
 * A run is { score, distance, orbs, bestStreak, nearMisses } (the sim's results()).
 * Lifetime stats are { runs, totalDistance, totalOrbs, totalNearMisses, bestDistance, bestStreak,
 * bestNearMisses, bestOrbs, personalBests } and only ever grow.
 */
export const EMPTY_STATS = Object.freeze({
  runs: 0,
  totalDistance: 0,
  totalOrbs: 0,
  totalNearMisses: 0,
  bestDistance: 0,
  bestStreak: 0,
  bestNearMisses: 0,
  bestOrbs: 0,
  /** How many times the personal best score has been beaten (after the first score). */
  personalBests: 0,
});

export const CATEGORIES = Object.freeze([
  { id: 'distance', name: 'Distance' },
  { id: 'collection', name: 'Collection' },
  { id: 'nearMiss', name: 'Near misses' },
  { id: 'streak', name: 'Streaks' },
  { id: 'records', name: 'Records' },
]);

/** [category, id, name, description, stat, target] */
const ROWS = [
  ['distance', 'dist-100', 'First Flight', 'Fly 100 m in one run', 'bestDistance', 100],
  ['distance', 'dist-250', 'Ember Runner', 'Fly 250 m in one run', 'bestDistance', 250],
  ['distance', 'dist-500', 'Valley Crosser', 'Fly 500 m in one run', 'bestDistance', 500],
  ['distance', 'dist-1000', 'Long Haul', 'Fly 1,000 m in one run', 'bestDistance', 1000],
  ['distance', 'dist-2000', 'Skyburner', 'Fly 2,000 m in one run', 'bestDistance', 2000],
  ['distance', 'dist-5000', 'Halfway There', 'Fly 5,000 m in one run', 'bestDistance', 5000],
  ['distance', 'dist-10000', 'Celestial Arrival', 'Reach the Celestial City: fly 10,000 m in one run', 'bestDistance', 10000],
  ['collection', 'orbs-50', 'Spark Collector', 'Collect 50 fire orbs in total', 'totalOrbs', 50],
  ['collection', 'orbs-250', 'Orb Hoarder', 'Collect 250 fire orbs in total', 'totalOrbs', 250],
  ['collection', 'orbs-1000', 'Inferno Keeper', 'Collect 1,000 fire orbs in total', 'totalOrbs', 1000],
  ['collection', 'orbs-run-20', 'Full Pockets', 'Collect 20 orbs in one run', 'bestOrbs', 20],
  ['nearMiss', 'near-3', 'Close Call', '3 near misses in one run', 'bestNearMisses', 3],
  ['nearMiss', 'near-10', 'Daredevil', '10 near misses in one run', 'bestNearMisses', 10],
  ['nearMiss', 'near-50', 'Razor Wing', '50 near misses in total', 'totalNearMisses', 50],
  ['streak', 'streak-5', 'On a Roll', 'Collect 5 orbs in a row', 'bestStreak', 5],
  ['streak', 'streak-10', 'Hot Streak', 'Collect 10 orbs in a row', 'bestStreak', 10],
  ['streak', 'streak-25', 'Unbroken', 'Collect 25 orbs in a row', 'bestStreak', 25],
  ['records', 'best-500', 'Rising Flame', 'Score 500 in one run', 'bestScore', 500],
  ['records', 'best-1500', 'Blazing Trail', 'Score 1,500 in one run', 'bestScore', 1500],
  ['records', 'best-4000', 'Firestorm', 'Score 4,000 in one run', 'bestScore', 4000],
  ['records', 'pb-3', 'Record Breaker', 'Beat your personal best 3 times', 'personalBests', 3],
];

export const ACHIEVEMENTS = Object.freeze(
  ROWS.map(([category, id, name, desc, stat, target]) => Object.freeze({ category, id, name, desc, stat, target })),
);

/** Current value of an achievement's stat. `bestScore` is the player's best score, kept outside `stats`. */
export function statValue(stats, bestScore, stat) {
  return stat === 'bestScore' ? bestScore : (stats[stat] ?? 0);
}

export function achievementProgress(a, stats, bestScore) {
  const value = Math.min(statValue(stats, bestScore, a.stat), a.target);
  return { value, target: a.target, ratio: value / a.target, done: value >= a.target };
}

/** Fold a finished run into the lifetime stats. `isNewBest` / `hadBest` say whether it beat an earlier best. */
export function applyRun(stats, run, { isNewBest = false, hadBest = false } = {}) {
  return {
    runs: stats.runs + 1,
    totalDistance: stats.totalDistance + run.distance,
    totalOrbs: stats.totalOrbs + run.orbs,
    totalNearMisses: stats.totalNearMisses + run.nearMisses,
    bestDistance: Math.max(stats.bestDistance, run.distance),
    bestStreak: Math.max(stats.bestStreak, run.bestStreak),
    bestNearMisses: Math.max(stats.bestNearMisses, run.nearMisses),
    bestOrbs: Math.max(stats.bestOrbs, run.orbs),
    personalBests: stats.personalBests + (isNewBest && hadBest ? 1 : 0),
  };
}

/** Achievements newly completed by moving from (before, bestBefore) to (after, bestAfter). */
export function newlyEarned(before, bestBefore, after, bestAfter) {
  return ACHIEVEMENTS.filter(
    (a) =>
      !achievementProgress(a, before, bestBefore).done && achievementProgress(a, after, bestAfter).done,
  );
}

/** Skins that a best score newly unlocks (the cosmetic milestones). */
export function newlyUnlockedSkinNames(previousBest, newBest, themeId) {
  return newlyUnlocked(previousBest, newBest, themeId).map((s) => s.name);
}

/**
 * The goal to suggest for the next run: the unfinished achievement that is nearest to done (highest ratio), so
 * there is always something within reach. Null when everything is complete.
 * `{ id, name, text, ratio }`; `text` reads like "Fly 250 m in one run (180 m so far)".
 */
export function nextGoal(stats, bestScore) {
  let best = null;
  for (const a of ACHIEVEMENTS) {
    const p = achievementProgress(a, stats, bestScore);
    if (p.done) continue;
    if (!best || p.ratio > best.ratio) best = { id: a.id, name: a.name, text: a.desc, ratio: p.ratio, value: p.value, target: a.target };
  }
  return best;
}

/* ------------------------------------------------------------------ daily goal */

/** One goal per UTC day: a stat and a target for a single run. */
const DAILY_POOL = [
  { id: 'distance', text: (n) => `Fly ${n.toLocaleString()} m in one run`, stat: 'distance', targets: [150, 200, 250, 300] },
  { id: 'orbs', text: (n) => `Collect ${n} orbs in one run`, stat: 'orbs', targets: [8, 10, 12, 15] },
  { id: 'near', text: (n) => `${n} near misses in one run`, stat: 'nearMisses', targets: [2, 3, 4, 5] },
  { id: 'streak', text: (n) => `Collect ${n} orbs in a row`, stat: 'bestStreak', targets: [3, 4, 5, 6] },
  { id: 'score', text: (n) => `Score ${n.toLocaleString()} in one run`, stat: 'score', targets: [250, 350, 450, 600] },
];

export function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic daily goal for a date key like '2026-11-18': the same for every player that day. */
export function dailyGoalFor(key) {
  const h = hash(`fireflipper:${key}`);
  const kind = DAILY_POOL[h % DAILY_POOL.length];
  const target = kind.targets[(h >>> 8) % kind.targets.length];
  return { key, kind: kind.id, stat: kind.stat, target, text: kind.text(target) };
}

export function dailyMet(goal, run) {
  return (run[goal.stat] ?? 0) >= goal.target;
}

/**
 * Daily state: { key, done, streakDays, lastDoneKey }. `streakDays` counts consecutive days with the goal
 * completed. Rolls over to the new day (keeping the streak only if yesterday was completed).
 */
export function rollDaily(state, key) {
  if (state?.key === key) return state;
  const prev = state ?? { done: false, streakDays: 0, lastDoneKey: null };
  return {
    key,
    done: false,
    streakDays: prev.lastDoneKey && daysBetween(prev.lastDoneKey, key) === 1 ? prev.streakDays : 0,
    lastDoneKey: prev.lastDoneKey ?? null,
  };
}

export function completeDaily(state) {
  if (state.done) return state;
  return { ...state, done: true, streakDays: state.streakDays + 1, lastDoneKey: state.key };
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}
