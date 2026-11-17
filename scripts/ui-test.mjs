/**
 * Game-over data tests: the store decides the bests and the margin the screen shows, and the breakdown
 * helper must restate the score exactly. Runs in plain Node (the store falls back to memory without localStorage).
 */
import { useGameStore, MODE, STATUS } from '../src/store/useGameStore.js';
import { scoreBreakdown } from '../src/systems/scoring/scoring.js';

let failures = 0;
let passes = 0;
function check(name, cond, detail = '') {
  if (cond) passes++;
  else {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
}
const section = (s) => console.log(`\n${s}`);
const store = useGameStore;
const finish = (score, distance, orbs, nearMisses) => {
  store.setState({ status: STATUS.RUNNING });
  store.getState().endRun({ score, distance, orbs, nearMisses }, []);
  return store.getState().lastResult;
};

section('Free play bests');
store.getState().startGame(MODE.FREE);
let r = finish(1000, 700, 60, 0);
check('first run is a new best', r.isNewBest === true);
check('first run has no previous best', r.previousBest === 0);
check('best saved', store.getState().bestScore === 1000);
r = finish(1332, 912, 81, 5);
check('beating the best is a new best', r.isNewBest === true);
check('margin base is the old best', r.previousBest === 1000 && r.score - r.previousBest === 332);
check(
  'best and session best follow',
  store.getState().bestScore === 1332 && store.getState().sessionBest === 1332,
);
r = finish(1332, 912, 81, 5);
check('equalling the best is not a new best', r.isNewBest === false);
r = finish(500, 400, 20, 0);
check('a worse run is not a new best', r.isNewBest === false && r.previousBest === 1332);
check(
  'a worse run leaves the bests alone',
  store.getState().bestScore === 1332 && store.getState().sessionBest === 1332,
);

section('Daily challenge bests');
store.getState().startGame(MODE.DAILY);
const free = store.getState().bestScore;
r = finish(800, 600, 40, 0);
check(
  'daily run is a new daily best',
  r.isNewDailyBest === true && r.previousBest === 0 && r.isNewBest === false,
);
r = finish(900, 650, 50, 0);
check('daily margin is against today', r.previousBest === 800 && r.isNewDailyBest === true);
r = finish(700, 500, 40, 0);
check('daily worse run is not a record', r.isNewDailyBest === false && r.previousBest === 900);
check('daily runs never touch the free-play bests', store.getState().bestScore === free);

section('Breakdown matches every result the screen can show');
let ok = true;
for (const [score, distance, orbs, nm] of [
  [1332, 912, 81, 5],
  [0, 0, 0, 0],
  [6, 6, 0, 0],
  [2105, 1500, 90, 8],
]) {
  const b = scoreBreakdown({ score, distance, orbs });
  if (b.distancePoints + b.orbPoints + b.nearMissPoints !== score || (nm === 0 && b.nearMissPoints !== 0))
    ok = false;
}
check('breakdown rows add up to the score', ok);

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
