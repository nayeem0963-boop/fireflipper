/** Progression tests. Run with: npm run test:progression */
import {
  ACHIEVEMENTS, EMPTY_STATS, applyRun, newlyEarned, nextGoal, dailyGoalFor, dailyMet, rollDaily, completeDaily,
  achievementProgress, newlyUnlockedSkinNames,
} from '../src/systems/progression/progression.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
};

check('unique achievement ids', new Set(ACHIEVEMENTS.map((a) => a.id)).size === ACHIEVEMENTS.length);
check('every category is covered', ['distance', 'collection', 'nearMiss', 'streak', 'records'].every((c) => ACHIEVEMENTS.some((a) => a.category === c)));

const run = { score: 300, distance: 120, orbs: 6, bestStreak: 4, nearMisses: 3 };
const s1 = applyRun(EMPTY_STATS, run, { isNewBest: true, hadBest: false });
check('stats accumulate', s1.runs === 1 && s1.totalOrbs === 6 && s1.bestDistance === 120);
check('first score is not a personal-best beat', s1.personalBests === 0);
const s2 = applyRun(s1, { ...run, distance: 80, orbs: 2 }, { isNewBest: true, hadBest: true });
check('lifetime totals grow, bests keep max', s2.totalOrbs === 8 && s2.bestDistance === 120 && s2.personalBests === 1);

const earned = newlyEarned(EMPTY_STATS, 0, s1, 300).map((a) => a.id).sort();
check('run earns 100 m and 3 near misses', earned.join() === 'dist-100,near-3', earned.join());
check('already-earned are not repeated', newlyEarned(s1, 300, s2, 300).length === 0);

const goal = nextGoal(s1, 300);
check('next goal is the closest unfinished', goal && goal.id === 'streak-5', goal && goal.id);
const all = { ...EMPTY_STATS, bestDistance: 1e9, totalOrbs: 1e9, bestOrbs: 1e9, bestNearMisses: 1e9, totalNearMisses: 1e9, bestStreak: 1e9, personalBests: 9 };
check('no goal when everything is done', nextGoal(all, 1e9) === null);
check('progress is capped', achievementProgress(ACHIEVEMENTS[0], all, 0).ratio === 1);

check('daily goal is deterministic', JSON.stringify(dailyGoalFor('2026-11-18')) === JSON.stringify(dailyGoalFor('2026-11-18')));
const kinds = new Set(Array.from({ length: 60 }, (_, i) => dailyGoalFor(`2026-12-${String((i % 28) + 1).padStart(2, '0')}`).kind));
check('daily goals vary', kinds.size >= 3);
check('daily met check', dailyMet({ stat: 'orbs', target: 5 }, { orbs: 5 }) && !dailyMet({ stat: 'orbs', target: 5 }, { orbs: 4 }));

let d = rollDaily(null, '2026-11-18');
d = completeDaily(d);
check('daily completes once', completeDaily(d).streakDays === 1);
d = rollDaily(d, '2026-11-19');
check('streak survives consecutive day', d.streakDays === 1 && !d.done);
d = completeDaily(d);
check('streak grows', d.streakDays === 2);
d = rollDaily(d, '2026-11-22');
check('streak resets after a gap', d.streakDays === 0);

check('skin milestones', newlyUnlockedSkinNames(500, 700).join() === 'Blue');

console.log(failures ? `\n${failures} failed` : '\nprogression tests passed');
process.exit(failures ? 1 : 0);
