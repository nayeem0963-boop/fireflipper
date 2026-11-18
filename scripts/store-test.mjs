/**
 * Run-lifecycle regression tests on the Zustand store (no browser). Run with: npm run test:store
 * Covers pause/resume, retry/reset, game-over transitions, once-only game over, auto play isolation and that a
 * bird choice never changes the run result.
 */
import { useGameStore, STATUS, SCREENS } from '../src/store/useGameStore.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
};
const st = () => useGameStore.getState();
const run = (over = {}) => ({ score: 120, distance: 100, orbs: 4, bestStreak: 3, nearMisses: 2, cause: 'column', ...over });

// start
st().startGame();
check('start enters game, READY', st().screen === SCREENS.GAME && st().status === STATUS.READY && !st().demo);
const id1 = st().runId;

// pause only while running
st().pause();
check('cannot pause before the run starts', st().status === STATUS.READY);
st().beginRun();
check('first flap starts the run', st().status === STATUS.RUNNING);
st().pause();
check('pause', st().status === STATUS.PAUSED);
st().pause();
check('double pause is harmless', st().status === STATUS.PAUSED);
st().resume();
check('resume', st().status === STATUS.RUNNING);
st().togglePause();
st().togglePause();
check('toggle round trip', st().status === STATUS.RUNNING);

// crash -> over, once
st().crash();
check('crash -> DYING', st().status === STATUS.DYING);
st().endRun(run());
check('end -> OVER with result', st().status === STATUS.OVER && st().lastResult?.score === 120);
check('first score is a new best', st().lastResult.isNewBest && st().bestScore === 120);
check('progression recorded', st().stats.runs === 1 && st().stats.totalOrbs === 4 && st().flown.flipper === 1);
st().endRun(run({ score: 999 }));
check('a run can only end once', st().stats.runs === 1 && st().lastResult.score === 120 && st().bestScore === 120);

// retry resets everything for the run
st().restart();
check('retry resets the run', st().status === STATUS.READY && st().score === 0 && st().orbs === 0 && st().distance === 0 && st().lastResult === null);
check('retry bumps runId (sim reset trigger)', st().runId === id1 + 1);

// lower score is not a best, a higher one is
st().beginRun();
st().crash();
st().endRun(run({ score: 50 }));
check('lower score: no new best', !st().lastResult.isNewBest && st().bestScore === 120 && st().lastResult.previousBest === 120);
st().restart();
st().beginRun();
st().crash();
st().endRun(run({ score: 700 }));
check('higher score: new best and margin', st().lastResult.isNewBest && st().bestScore === 700 && st().lastResult.previousBest === 120);
check('skin unlock reported', st().lastResult.unlockedSkins.includes('Blue'), String(st().lastResult.unlockedSkins));

// bird choice is cosmetic: same result for any bird
st().selectSkin('morpho-fire');
st().restart();
st().beginRun();
st().crash();
st().endRun(run({ score: 710 }));
check('another bird scores identically', st().lastResult.score === 710 && st().stats.runs === 4);
st().selectSkin('morpho-white'); // locked at this score? 710 < 1500
check('locked skin cannot be selected', st().skinId === 'morpho-fire');

// menu and auto play
st().exitToMenu();
check('exit to menu', st().screen === SCREENS.HOME && st().status === STATUS.IDLE);
const before = JSON.stringify([st().stats, st().earned, st().daily, st().bestScore, st().flown]);
st().startDemo();
check('auto play flag', st().demo && st().screen === SCREENS.GAME && st().status === STATUS.READY);
st().beginRun();
st().crash();
st().endRun(run({ score: 99999, orbs: 500 }));
check('auto play records nothing', JSON.stringify([st().stats, st().earned, st().daily, st().bestScore, st().flown]) === before && st().lastResult === null);
st().startGame();
check('playing for real turns auto play off', !st().demo);
st().exitToMenu();

console.log(failures ? `\n${failures} failed` : '\nstore tests passed');
process.exit(failures ? 1 : 0);
