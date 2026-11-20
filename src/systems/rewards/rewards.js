/**
 * Journey rewards: five permanent collectibles for "Journey to the Celestial City". Pure data and functions (no React, no storage): the store keeps the state and saves it,
 * the screens draw it, the tests check it. Rewards are COSMETIC and never read by the simulation: no bird, skin or trophy changes a hitbox, a force or a score.
 *
 * Earned by legitimate progress only: a milestone (a world completed, at 2,000 m steps) is announced by the simulation when the bird SURVIVES that border, and only then does the store
 * grant what the schedule below lists for it. Granting is idempotent (a reward already owned is never granted again) and nothing else grants a reward: opening the collection screen,
 * reloading the page or replaying a milestone does not.
 */
import { MILESTONES, WORLD_COUNT } from '../world/worlds.js';

export const RARITY = Object.freeze({
  uncommon: { id: 'uncommon', name: 'Uncommon', rank: 1 },
  rare: { id: 'rare', name: 'Rare', rank: 2 },
  epic: { id: 'epic', name: 'Epic', rank: 3 },
  legendary: { id: 'legendary', name: 'Legendary', rank: 4 },
});

/**
 * The collection, in the order the screens show it. `milestone` is the index (0 to 4) of the world whose completion grants it (4 = the finish line, 10,000 m);
 * `how` says how it is earned, in the player's words.
 */
export const REWARDS = Object.freeze([
  {
    id: 'treasure-cache',
    name: 'Treasure Cache',
    kicker: 'Bonus Reward',
    desc: 'A chest of glittering gems from the canyon trail: a gift for finishing your first world.',
    milestone: 0,
    rarity: RARITY.uncommon,
  },
  {
    id: 'city-orb',
    name: 'Celestial City Orb',
    kicker: 'A Rare Collectible',
    desc: 'A crystal orb with the Celestial City floating inside, found as the polar skies give way to the stars.',
    milestone: 1,
    rarity: RARITY.rare,
  },
  {
    id: 'celestial-skin',
    name: 'Celestial Bird Skin',
    kicker: 'Exclusive Appearance',
    desc: 'A golden Flipper that glows like the city lights. Cosmetic only: it flies exactly like every other bird.',
    milestone: 3,
    rarity: RARITY.epic,
  },
  {
    id: 'journey-trophy',
    name: 'Journey Champion Trophy',
    kicker: 'Completion Trophy',
    desc: 'A winged golden trophy for flying all five worlds and 10,000 metres without falling.',
    milestone: 4,
    rarity: RARITY.epic,
  },
  {
    id: 'celestial-feather',
    name: 'Celestial Feather',
    kicker: 'Journey Completion Reward',
    desc: 'A luminous golden feather: the mark of everyone who has reached the Celestial City. The rarest prize in the game.',
    milestone: 4,
    rarity: RARITY.legendary,
    primary: true,
  },
]);

const BY_ID = Object.freeze(Object.fromEntries(REWARDS.map((r) => [r.id, r])));
export const getReward = (id) => BY_ID[id] ?? null;

/** What is earned and where, as the screens show it: "Complete World 1 (2,000 m)". */
export function howToEarn(reward) {
  const m = MILESTONES[reward.milestone];
  const at = m.at.toLocaleString('en-US');
  return m.final ? `Reach the Celestial City: complete the journey at ${at} m` : `Complete World ${m.index + 1}, ${m.name} (${at} m)`;
}

/** The rewards a milestone grants (index 0 to 4), in collection order. */
export const rewardsAt = (milestoneIndex) => REWARDS.filter((r) => r.milestone === milestoneIndex);

/** A fresh, empty journey record. */
export const EMPTY_JOURNEY = Object.freeze({ rewards: Object.freeze({}), completions: 0, milestones: Object.freeze([0, 0, 0, 0, 0]) });

/**
 * Cleans a saved value (storage can be empty, old, hand-edited or corrupt): unknown rewards are dropped, counts are clamped, and anything that is not what we expect becomes
 * the empty record. Never throws. The result is always a complete `{ rewards, completions, milestones }`.
 */
export function sanitizeJourney(saved) {
  const rewards = {};
  const milestones = [0, 0, 0, 0, 0];
  let completions = 0;
  if (saved && typeof saved === 'object') {
    const r = saved.rewards;
    if (r && typeof r === 'object') for (const id of Object.keys(r)) if (BY_ID[id]) rewards[id] = Number.isFinite(r[id]) ? Math.max(1, Math.floor(r[id])) : 1;
    if (Array.isArray(saved.milestones)) for (let i = 0; i < WORLD_COUNT; i++) milestones[i] = Math.max(0, Math.min(1e6, Math.floor(Number(saved.milestones[i]) || 0)));
    completions = Math.max(0, Math.min(1e6, Math.floor(Number(saved.completions) || 0)));
  }
  // a reward owned implies its milestone was reached (and a completion implies the finish): keep the record consistent
  for (const id of Object.keys(rewards)) milestones[BY_ID[id].milestone] = Math.max(1, milestones[BY_ID[id].milestone]);
  if (completions > 0) milestones[WORLD_COUNT - 1] = Math.max(1, milestones[WORLD_COUNT - 1]);
  return { rewards, completions, milestones };
}

/**
 * Records that a milestone was reached in a run and grants what it schedules. `runNumber` is stored with each reward (the run it was earned on).
 * Returns `{ journey, granted }`: a NEW record (the old one is untouched) and the rewards that were newly granted (empty when everything was already owned: replaying a milestone
 * never grants twice). The finish line (index 4) also counts one completion.
 */
export function reachMilestone(journey, index, runNumber = 1) {
  if (!Number.isInteger(index) || index < 0 || index >= WORLD_COUNT) return { journey, granted: [] };
  const rewards = { ...journey.rewards };
  const milestones = [...journey.milestones];
  milestones[index] += 1;
  const granted = [];
  for (const r of rewardsAt(index)) {
    if (rewards[r.id]) continue;
    rewards[r.id] = Math.max(1, Math.floor(runNumber));
    granted.push(r);
  }
  const completions = journey.completions + (index === WORLD_COUNT - 1 ? 1 : 0);
  return { journey: { rewards, completions, milestones }, granted };
}

/** How many of the five rewards are owned. */
export const ownedCount = (journey) => REWARDS.filter((r) => journey.rewards[r.id]).length;
export const owns = (journey, id) => !!journey?.rewards?.[id];
