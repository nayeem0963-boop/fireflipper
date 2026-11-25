/**
 * Journey Preview: what the preview shows instead of real rewards. PURE: it builds lists from the schedule and touches no state, no storage and no store, so it can never grant or save
 * anything. The preview store paths use these lists for the banner and the final screen only; the real journey record (`journey`) is never read for them and never written.
 */
import { EMPTY_JOURNEY, reachMilestone } from './rewards.js';

/** The reward ids that reaching a milestone (0 to 4) WOULD grant to a player with an empty collection. Nothing is granted. */
export const previewRewardIds = (milestoneIndex) => reachMilestone(EMPTY_JOURNEY, milestoneIndex, 1).granted.map((r) => r.id);

/**
 * Track seeds the preview flies, in turn. Each one was checked headlessly: the Auto play bot reaches the finish line on it (scripts/journey-preview-test.mjs re-checks the first of them).
 * If the bot does crash anyway, the preview simply starts the next seed, so it keeps going until a journey is flown to the end.
 */
export const PREVIEW_SEEDS = Object.freeze([1, 2, 3, 4]);
export const previewSeedFor = (n) => PREVIEW_SEEDS[((n % PREVIEW_SEEDS.length) + PREVIEW_SEEDS.length) % PREVIEW_SEEDS.length];
