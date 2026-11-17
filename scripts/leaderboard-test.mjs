/**
 * Leaderboard tests. Run with: npm run test:leaderboard
 * Covers replay determinism, submission verification and ranking (no network).
 */
import { createGameSim, INPUT, PHASE } from '../src/systems/game/createGameSim.js';
import { MAX_TICKS, replayRun, validateLog } from '../src/systems/replay/replay.js';
import { createGhost } from '../src/systems/replay/ghost.js';
import { PHYSICS } from '../src/systems/physics/constants.js';
import { seedForKey } from '../src/utils/daily.js';
import { createMemoryStore, getBoard, openDays, submitScore } from '../server/leaderboard.js';
import { validateName } from '../server/moderation.js';
import { LIMITS, hit } from '../server/rateLimit.js';

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

// ---------------------------------------------------------------- ghost
section('Ghost');
{
  const seed = seedForKey('2026-11-17');
  const original = playRun(seed, { metres: 350 });

  // Drive a fresh "live" sim the way a player starting later would: it hovers a different
  // amount of time, then starts; the ghost must still fly the original path exactly.
  const ghost = createGhost(seed, original.inputLog);
  check('ghost starts waiting on the track', ghost.sim.phase === PHASE.READY && ghost.sim.distance === 0);
  check('ghost has not crashed yet', ghost.finished === false);

  // Reference: the original run's bird height after N steps of running.
  const ref = createGameSim();
  ref.reset(seed);
  let next = 0;
  const log = original.inputLog;
  const track = [];
  while (ref.phase !== PHASE.OVER) {
    while (next < log.length && log[next] <= ref.tick) {
      const code = log[next + 1];
      if (code === INPUT.FLAP) ref.flap();
      else if (code === INPUT.HOLD_ON) ref.setHolding(true);
      else if (code === INPUT.HOLD_OFF) ref.setHolding(false);
      else if (code === INPUT.DIVE_ON) ref.setDive(true);
      else ref.setDive(false);
      next += 2;
    }
    ref.step(DT);
    track.push([ref.bird.y, ref.distance]);
  }
  // The reference's first `startTick` entries are the hover; ghost steps begin at the first flap.
  const startTick = log[0];
  let maxDelta = 0;
  let steps = 0;
  while (!ghost.finished && steps < track.length - startTick) {
    ghost.step();
    const [y, d] = track[startTick + steps];
    maxDelta = Math.max(maxDelta, Math.abs(ghost.sim.bird.y - y), Math.abs(ghost.sim.distance - d));
    steps++;
  }
  check('ghost follows the original path exactly', maxDelta === 0, `max delta ${maxDelta}`);
  check('ghost crashes where the original did', ghost.finished && ghost.sim.metres === original.metres);

  // It must also be independent of the live sim: stepping one does not move the other.
  const other = createGameSim();
  other.reset(seed);
  const ghost2 = createGhost(seed, original.inputLog);
  other.flap();
  for (let i = 0; i < 120; i++) other.step(DT);
  check('ghost is independent of the live sim', ghost2.sim.distance === 0 && ghost2.sim.tick === startTick);

  const empty = createGhost(seed, []);
  check('an empty log gives a harmless idle ghost', empty.sim.phase === PHASE.READY);
  empty.step();
  check('...that does not crash when stepped', empty.sim.tick >= 1);
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

// ---------------------------------------------------------------- name filtering
section('Name filtering');
{
  const ok = (raw) => {
    const r = validateName(raw);
    return r.ok ? r.name : null;
  };
  check('plain names pass', ok('Ember Pilot') === 'Ember Pilot' && ok('Ada Lovelace') === 'Ada Lovelace');
  check('names are trimmed and spaces collapsed', ok('  Ada   Lovelace ') === 'Ada Lovelace');
  check('non-English letters pass', ok('Ünal Çelik') === 'Ünal Çelik' && ok('田中太郎') === '田中太郎');
  check('full-width letters are normalised', ok('ＡＢＣ１２３') === 'ABC123');
  for (const innocent of ['Scunthorpe', 'Cassandra', 'Assassin', 'Class Act', 'Analytics', 'Hello World']) {
    check(`no false positive: ${innocent}`, ok(innocent) !== null);
  }

  for (const [label, raw] of [
    ['too short', 'ab'],
    ['empty', ''],
    ['too long', 'x'.repeat(17)],
    ['markup', '<script>'],
    ['link-like', 'a.b.com'],
    ['symbols only', '___'],
    ['emoji', 'fire🔥fire'],
    ['not a string', 42],
    ['null', null],
  ]) {
    check(`rejects ${label}`, !validateName(raw).ok);
  }

  for (const raw of ['Admin', 'a d m i n', 'F-I-R-E-F-L-I-P-P-E-R', 'MODERATOR', 'Official']) {
    check(`rejects reserved name: ${raw}`, !validateName(raw).ok);
  }

  for (const raw of ['shit', 'SHIT', 'sh1t', 'f_u_c_k', 'f u c k', 'fvck', 'bi7ch']) {
    const r = validateName(raw);
    check(`rejects profanity: ${raw}`, !r.ok);
  }
  const blocked = validateName('sh1t');
  check(
    'the error does not echo or hint at the matched word',
    !/sh1t|shit|profan|swear|curse/i.test(blocked.error),
    blocked.error,
  );
}

// ---------------------------------------------------------------- rate limiting
section('Rate limiting');
{
  const rule = { limit: 3, windowMs: 60_000 };
  const t0 = new Date('2026-11-17T12:00:00Z');
  const at = (ms) => new Date(t0.getTime() + ms);

  const store = createMemoryStore();
  const results = [];
  for (let i = 0; i < 5; i++) results.push(await hit(store, 'test', 'client-a', rule, at(i * 1000)));
  check(
    'allows up to the limit',
    results.slice(0, 3).every((r) => r.ok),
  );
  check('blocks past the limit', !results[3].ok && !results[4].ok);
  check(
    'reports when to retry',
    results[3].retryAfter >= 1 && results[3].retryAfter <= 60,
    String(results[3].retryAfter),
  );
  check('retry time shrinks as the window runs out', results[4].retryAfter < results[3].retryAfter);

  check('a different client is unaffected', (await hit(store, 'test', 'client-b', rule, at(4000))).ok);
  check('a different scope is unaffected', (await hit(store, 'other', 'client-a', rule, at(4000))).ok);
  check('allowed again after the window', (await hit(store, 'test', 'client-a', rule, at(60_001))).ok);
  check(
    'blocked requests do not extend the window',
    (await hit(store, 'test', 'client-a', rule, at(60_001 + 59_000))).ok,
  );

  const back = createMemoryStore();
  for (let i = 0; i < 3; i++) await hit(back, 'test', 'x', rule, at(100_000));
  check(
    'a clock that moves backwards resets instead of locking out',
    (await hit(back, 'test', 'x', rule, at(0))).ok,
  );

  // Raw identifiers must never be used as storage keys.
  const keys = [];
  const spy = {
    get: async () => null,
    set: async (k) => void keys.push(k),
  };
  await hit(spy, 'submit-ip', '203.0.113.7', rule, t0);
  check('IPs are hashed before storage', keys.length === 1 && !keys[0].includes('203.0.113.7'), keys[0]);

  // Integration with the leaderboard.
  const now = new Date('2026-11-17T12:00:00Z');
  const key = '2026-11-17';
  const run = playRun(seedForKey(key));
  const goodBody = (over = {}) => ({
    name: 'Rate Tester',
    playerId: 'rate-player-0000001',
    dailyKey: key,
    inputs: run.inputLog,
    claimedScore: run.results().score,
    ...over,
  });

  const s1 = createMemoryStore();
  let last;
  for (let i = 0; i < LIMITS.submitPerIp.limit; i++) {
    last = await submitScore(
      s1,
      goodBody({ playerId: `ip-limit-player-${String(i).padStart(4, '0')}` }),
      now,
      { clientId: '198.51.100.1' },
    );
  }
  check('submissions up to the per-IP limit work', last.ok, last.error);
  const blockedIp = await submitScore(s1, goodBody({ playerId: 'ip-limit-player-9999' }), now, {
    clientId: '198.51.100.1',
  });
  check(
    'the next one from that IP is refused with 429',
    !blockedIp.ok && blockedIp.status === 429 && blockedIp.retryAfter > 0,
  );
  check('the message says to wait', /try again/i.test(blockedIp.error), blockedIp.error);
  check(
    '...and was not recorded',
    (await getBoard(s1, key, { limit: 100 }, now)).data.entries.length === LIMITS.submitPerIp.limit,
  );
  const otherIp = await submitScore(s1, goodBody({ playerId: 'ip-limit-player-8888' }), now, {
    clientId: '198.51.100.2',
  });
  check('another IP is unaffected', otherIp.ok, otherIp.error);

  const s2 = createMemoryStore();
  let attempt;
  for (let i = 0; i < LIMITS.submitPerPlayer.limit; i++) attempt = await submitScore(s2, goodBody(), now);
  check('submissions up to the per-player limit work', attempt.ok, attempt.error);
  const blockedPlayer = await submitScore(s2, goodBody(), now);
  check(
    'the next one from that player is refused with 429',
    !blockedPlayer.ok && blockedPlayer.status === 429,
  );
  check(
    'a different player is unaffected',
    (await submitScore(s2, goodBody({ playerId: 'another-player-0001' }), now)).ok,
  );

  // Rejected submissions still count, so junk cannot be retried for free.
  const s3 = createMemoryStore();
  for (let i = 0; i < LIMITS.submitPerPlayer.limit; i++) await submitScore(s3, goodBody({ name: 'x' }), now);
  check(
    'rejected names also count toward the limit',
    (await submitScore(s3, goodBody(), now)).status === 429,
  );

  const s4 = createMemoryStore();
  const flagged = await submitScore(s4, goodBody({ name: 'sh1t' }), now);
  check('a blocked name is rejected', !flagged.ok && flagged.status === 400);
  check('...and nothing was recorded', (await getBoard(s4, key, {}, now)).data.entries.length === 0);

  const s5 = createMemoryStore();
  let read;
  for (let i = 0; i < LIMITS.readPerIp.limit; i++)
    read = await getBoard(s5, key, { clientId: '198.51.100.9' }, now);
  check('reads up to the limit work', read.ok);
  check('further reads get 429', (await getBoard(s5, key, { clientId: '198.51.100.9' }, now)).status === 429);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
