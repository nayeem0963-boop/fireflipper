/**
 * Leaderboard tests. Run with: npm run test:leaderboard
 * Covers replay determinism, submission verification and ranking (no network).
 */
import { createGameSim, INPUT, PHASE } from '../src/systems/game/createGameSim.js';
import { MAX_TICKS, replayRun, validateLog } from '../src/systems/replay/replay.js';
import { PHYSICS } from '../src/systems/physics/constants.js';
import { seedForKey } from '../src/utils/daily.js';
import { createMemoryStore, getBoard, openDays, submitScore, cleanName } from '../server/leaderboard.js';

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
const DT = PHYSICS.fixedStep;

/**
 * Plays a run with the corridor-following autopilot (the same idea as the fairness test in
 * sim-test.mjs), for roughly `metres`, then stops flapping so the bird falls and the run ends.
 * `aim` shifts the target height, `holdEvery`/`diveEvery` add extra input variety.
 */
function playRun(seed, { metres = 400, aim = -0.6, holdEvery = 0, diveEvery = 0 } = {}) {
  const sim = createGameSim();
  sim.reset(seed);
  sim.flap();
  let i = 0;
  while (sim.phase !== PHASE.OVER && i < 120 * 900) {
    if (sim.phase === PHASE.RUNNING && sim.distance < metres) {
      const c = sim.track.corridors.find((k) => k.x1 > sim.distance - 0.3);
      const target = c ? Math.max(c.lo + 0.8, c.center + aim) : 0;
      const { y, vy } = sim.bird;
      if (vy < 0 && (y < target || (c && y < c.lo + 0.5))) sim.flap();
      if (holdEvery && i % holdEvery === 0) sim.setHolding(!sim.input.holding);
      if (diveEvery && i % diveEvery === 0) sim.setDive(!sim.input.dive);
    }
    sim.step(DT);
    i++;
  }
  return sim;
}

// ---------------------------------------------------------------- replay
section('Replay');
{
  const seed = seedForKey('2026-11-17');
  const sim = playRun(seed);
  check('the test run ended', sim.phase === PHASE.OVER, sim.phase);
  check(
    'the test run is substantial',
    sim.metres >= 300 && sim.orbsCollected > 10,
    `${sim.metres} m, ${sim.orbsCollected} orbs`,
  );
  check('inputs were logged', sim.inputLog.length >= 4 && sim.inputLog.length % 2 === 0);
  check('the log is well formed', validateLog(sim.inputLog) === null, String(validateLog(sim.inputLog)));

  const replay = replayRun(seed, sim.inputLog);
  const real = sim.results();
  check('replay finishes', replay.finished);
  check('replay reproduces the score', replay.score === real.score, `${replay.score} vs ${real.score}`);
  check(
    'replay reproduces distance and orbs',
    replay.distance === real.distance && replay.orbs === real.orbs,
  );
  check('replay ends on the same tick', replay.ticks === sim.tick, `${replay.ticks} vs ${sim.tick}`);

  // Many seeds and playstyles, to catch any divergence between live play and replay.
  let mismatches = 0;
  let sawFeatures = false;
  for (let s = 1; s <= 30; s++) {
    const live = playRun(s * 7919, {
      metres: 150 + s * 40,
      aim: -0.9 + (s % 5) * 0.2,
      holdEvery: s % 3 === 0 ? 97 : 0,
      diveEvery: s % 4 === 0 ? 211 : 0,
    });
    const r = replayRun(s * 7919, live.inputLog);
    if (live.nearMisses > 0 && live.orbsCollected > 0) sawFeatures = true;
    if (!r.finished || r.score !== live.results().score || r.ticks !== live.tick) mismatches++;
  }
  check('30 varied runs replay identically', mismatches === 0, `${mismatches} mismatches`);
  check('...including near misses, gems and shields along the way', sawFeatures, 'none seen');

  const other = replayRun(seedForKey('2026-11-18'), sim.inputLog);
  check(
    'a different seed gives a different result',
    other.score !== real.score || other.ticks !== replay.ticks,
  );

  // Tampering changes the outcome: removing a flap changes the run.
  const tampered = sim.inputLog.slice();
  for (let i = 0; i < tampered.length; i += 2) {
    if (tampered[i + 1] === INPUT.FLAP && tampered[i] > 100) {
      tampered.splice(i, 2);
      break;
    }
  }
  const t = replayRun(seed, tampered);
  check('editing the inputs changes the replayed run', t.ticks !== replay.ticks || t.score !== replay.score);

  check('rejects empty logs', validateLog([]) !== null);
  check('rejects odd-length logs', validateLog([1, 0, 2]) !== null);
  check('rejects decreasing ticks', validateLog([5, 0, 3, 0]) !== null);
  check('rejects unknown codes', validateLog([1, 9]) !== null);
  check('rejects non-integers', validateLog([1.5, 0]) !== null);
  check('rejects ticks beyond the cap', validateLog([MAX_TICKS + 1, 0]) !== null);

  const idle = replayRun(seed, [0, INPUT.FLAP]);
  check('a single flap run ends (the bird falls into lava)', idle.finished);
}

// ---------------------------------------------------------------- submissions
section('Submissions');
{
  const now = new Date('2026-11-17T12:00:00Z');
  const key = '2026-11-17';
  const seed = seedForKey(key);
  const run = playRun(seed);
  const id = (n) => `player-${String(n).padStart(12, '0')}`;
  const body = (over = {}) => ({
    name: 'Ember Pilot',
    playerId: id(1),
    dailyKey: key,
    inputs: run.inputLog,
    claimedScore: run.results().score,
    ...over,
  });

  check('open days are today and yesterday', openDays(now).join() === '2026-11-17,2026-11-16');
  check(
    'names are trimmed and checked',
    cleanName('  Ada  Lovelace ') === 'Ada Lovelace' &&
      cleanName('ab') === null &&
      cleanName('<script>') === null,
  );

  const store = createMemoryStore();
  const first = await submitScore(store, body(), now);
  check('a valid run is accepted', first.ok, first.error);
  check('score comes from the replay', first.data.score === run.results().score);
  check('first entry ranks #1', first.data.rank === 1 && first.data.improved === true);

  const board = await getBoard(store, key, { playerId: id(1) }, now);
  check(
    'board lists the entry',
    board.ok && board.data.entries.length === 1 && board.data.entries[0].name === 'Ember Pilot',
  );
  check('own row is flagged', board.data.entries[0].you === true && board.data.me.rank === 1);
  check('player ids are never exposed', !JSON.stringify(board.data).includes(id(1)));
  check(
    'others do not see "you"',
    (await getBoard(store, key, { playerId: id(2) }, now)).data.entries[0].you === false,
  );

  const lie = await submitScore(
    store,
    body({ claimedScore: run.results().score + 500, playerId: id(3) }),
    now,
  );
  check('a faked score is rejected', !lie.ok && lie.status === 422, JSON.stringify(lie));

  const wrongDay = await submitScore(store, body({ dailyKey: '2026-11-16', playerId: id(4) }), now);
  check('a run for another day does not verify', !wrongDay.ok || wrongDay.data.score !== run.results().score);

  check('closed days are rejected', !(await submitScore(store, body({ dailyKey: '2026-11-10' }), now)).ok);
  check('future days are rejected', !(await submitScore(store, body({ dailyKey: '2026-11-18' }), now)).ok);
  check('bad names are rejected', !(await submitScore(store, body({ name: 'x' }), now)).ok);
  check('bad player ids are rejected', !(await submitScore(store, body({ playerId: 'short' }), now)).ok);
  check(
    'garbage bodies are rejected',
    !(await submitScore(store, null, now)).ok && !(await submitScore(store, { inputs: 'no' }, now)).ok,
  );

  const incomplete = await submitScore(
    store,
    body({ inputs: [0, INPUT.FLAP], claimedScore: undefined, playerId: id(5) }),
    now,
  );
  check(
    'a log that ends the run on its own is scored by the replay',
    incomplete.ok && incomplete.data.score < run.results().score,
  );

  // Ranking: a better run overtakes, a worse one does not replace.
  const better = playRun(seed, { metres: 700 });
  const worse = playRun(seed, { metres: 120 });
  await submitScore(
    store,
    body({ playerId: id(6), name: 'Second', inputs: worse.inputLog, claimedScore: worse.results().score }),
    now,
  );
  await submitScore(
    store,
    body({ playerId: id(7), name: 'Third', inputs: better.inputLog, claimedScore: better.results().score }),
    now,
  );
  const ranked = (await getBoard(store, key, {}, now)).data.entries;
  check(
    'entries are sorted by score',
    ranked.every((e, i) => i === 0 || ranked[i - 1].score >= e.score),
  );
  check(
    'ranks are sequential',
    ranked.every((e, i) => e.rank === i + 1),
  );

  const again = await submitScore(
    store,
    body({ inputs: worse.inputLog, claimedScore: worse.results().score }),
    now,
  );
  check(
    'a worse run does not replace a best',
    again.ok && again.data.improved === worse.results().score > run.results().score,
  );
  const mine = (await getBoard(store, key, { playerId: id(1) }, now)).data.me;
  check('the best score is kept', mine.score === run.results().score, `${mine.score}`);

  const renamed = await submitScore(store, body({ name: 'New Name' }), now);
  check('resubmitting can rename without raising the score', renamed.ok);
  check(
    'rename applies',
    (await getBoard(store, key, { playerId: id(1) }, now)).data.entries.some((e) => e.name === 'New Name'),
  );

  check('unknown boards are rejected', !(await getBoard(store, '2020-01-01', {}, now)).ok);
  check('limit is respected', (await getBoard(store, key, { limit: 1 }, now)).data.entries.length === 1);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
