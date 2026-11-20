/**
 * Power-up tests (no browser): the magnet and the shield. Real simulation, real spawner, real Auto play bot. Run with: npm run test:powerups
 * Covers the rules, where the items appear (rare, reachable, never in a section or a hazard window), that tracks are unchanged without them, the magnet, the shield (lava and obstacles, once only,
 * the immunity, the races with a crash and the finish line), the HUD state, the bot, and the sources.
 */
import { readFileSync, statSync } from 'node:fs';
import { PHASE, createGameSim } from '../src/systems/game/createGameSim.js';
import { createAutopilot } from '../src/systems/bot/autopilot.js';
import { GAME_EVENTS } from '../src/systems/events/gameEvents.js';
import { PHYSICS, WORLD } from '../src/systems/physics/constants.js';
import { windowsIn } from '../src/systems/hazards/biomeHazards.js';
import { SCORING } from '../src/systems/physics/constants.js';
import { GRACE_S, ITEM_BEFORE, ITEM_RADIUS, KINDS, MAGNET_PULL, MAGNET_RANGE, MAGNET_S, POWERUPS, SLOTS } from '../src/systems/powerups/powerups.js';
import { JOURNEY_LENGTH, FINISH_CLEAR } from '../src/systems/world/worlds.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) { failures++; console.log(`  FAIL ${name} ${detail}`); } else console.log(`  ok   ${name}${detail ? ` (${detail})` : ''}`);
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const DT = PHYSICS.fixedStep;
const events = (sim, type) => sim.events.filter((e) => e.type === type);

/** A corridor-following bird: flies a seed (like the other tests) and calls `onStep(sim)` after every step. */
function fly(seed, onStep = () => {}, stopAt = Infinity) {
  const sim = createGameSim();
  sim.reset(seed);
  sim.flap();
  let steps = 0;
  while (sim.phase === PHASE.RUNNING && sim.distance < stopAt && steps++ < 120 * 1800) {
    const c = sim.track.corridors.find((k) => k.x1 > sim.distance - 0.3);
    const target = c ? Math.max(c.lo + 0.8, c.center - 0.6) : 0;
    const { y, vy } = sim.bird;
    if (vy < 0 && (y < target || (c && y < c.lo + 0.5))) sim.flap();
    sim.step(DT);
    onStep(sim);
  }
  return sim;
}
/** A running sim with nothing near the bird: a clean stage for the mechanics. */
function stage(seed = 3, at = 1500) {
  const sim = createGameSim();
  sim.reset(seed);
  sim.flap();
  sim.step(DT);
  sim.obstacles.releaseAll();
  sim.orbs.releaseAll();
  sim.items.releaseAll();
  sim.track.nextX = 1e9; // nothing more is built
  sim.distance = sim.prevDistance = at;
  sim.bird.y = 1.2;
  sim.bird.vy = 0;
  sim.events.length = 0;
  return sim;
}
/** Holds the bird level for a step (the tests are about power-ups, not flight). */
const hold = (sim) => { sim.bird.vy = 0; };

console.log('\n1. The rules and the slots');
check('the numbers: magnet 8 s, range 4 m, shield immunity 1.5 s, items picked up within 0.55 m (orbs 0.35)', MAGNET_S === 8 && MAGNET_RANGE === 4 && GRACE_S === 1.5 && ITEM_RADIUS > 0.35 && KINDS.join() === 'magnet,shield');
{
  const gaps = SLOTS.slice(1).map((s, i) => s.x - SLOTS[i].x);
  check(`about ten items in the journey, one every 800 to 1,200 m (${SLOTS.length}; gaps ${Math.min(...gaps).toFixed(0)} to ${Math.max(...gaps).toFixed(0)} m)`, SLOTS.length >= 8 && SLOTS.length <= 12 && gaps.every((g) => g >= 800 && g <= 1200));
  check('the kinds alternate, magnet first, so both appear about equally', SLOTS.every((s, i) => s.kind === KINDS[i % 2]) && Math.abs(SLOTS.filter((s) => s.kind === 'magnet').length - SLOTS.filter((s) => s.kind === 'shield').length) <= 1);
  check('the first is after 700 m and none is in the last stretch before the finish line', SLOTS[0].x >= 700 && SLOTS[SLOTS.length - 1].x < JOURNEY_LENGTH - FINISH_CLEAR - 200);
}

console.log('\n2. Where they appear');
{
  const placed = [];
  let overlapsOrb = 0, inSection = 0, inWindow = 0, offGap = 0, taken = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const seen = new Map();
    let all = [];
    const sim = fly(seed, (s) => {
      for (const it of s.items.active) {
        const key = `${it.kind}@${it.x.toFixed(3)}`;
        if (!seen.has(key)) {
          seen.set(key, { kind: it.kind, x: it.x, y: it.y });
          // the section that follows it: its guaranteed gap is where the item sits
          const next = s.track.corridors.find((c) => Math.abs(c.x0 - (it.x + ITEM_BEFORE)) < 1e-6);
          if (!next || Math.abs(next.center - it.y) > 1e-6) offGap++;
          for (const c of s.track.corridors) if (it.x > c.x0 - 0.3 && it.x < c.x1 + 0.3) inSection++;
          windowsIn(it.x - 1, it.x + 1, (kind, st, len) => { if (it.x >= st && it.x < st + len) inWindow++; });
          for (const o of s.orbs.active) if (Math.hypot(o.x - it.x, o.y - it.y) < 1.1) overlapsOrb++;
        }
      }
    });
    all = [...seen.values()];
    placed.push({ seed, all, phase: sim.phase });
    taken += all.length;
  }
  check('the bird survives every seed to the finish line while items spawn', placed.every((p) => p.phase === PHASE.COMPLETE));
  check(`every slot is filled on every seed (${placed.map((p) => p.all.length).join(', ')} items; ${SLOTS.length} slots)`, placed.every((p) => p.all.length === SLOTS.length));
  check('each item is in line with the middle of the guaranteed gap of the section that follows it (reachable by construction)', offGap === 0, `${offGap} off`);
  check('no item is inside an obstacle section', inSection === 0, `${inSection}`);
  check('no item is inside an active hazard window', inWindow === 0, `${inWindow}`);
  check('no item overlaps an orb (a section with an orb trail passes its turn)', overlapsOrb === 0, `${overlapsOrb}`);
  check('items come in the slot order and kinds, each after its slot and within a few sections of it (a section with an orb trail passes its turn)', placed.every((p) => p.all.every((it, i) => it.kind === SLOTS[i].kind && it.x + ITEM_BEFORE >= SLOTS[i].x && it.x - SLOTS[i].x < 200)));
  void taken;
}

console.log('\n3. Tracks are unchanged');
{
  const fingerprint = (seed, on) => {
    POWERUPS.enabled = on;
    const sig = [];
    const sim = fly(seed, (s) => {
      s.magnetLeft = 0; // a magnet or shield the bird happens to pick up must not move orbs or save it: only the GENERATED track is compared
      s.shield = false;
      if (Math.round(s.distance * 100) % 7 === 0) for (const o of s.obstacles.active) sig.push(`${o.kind}|${o.x.toFixed(3)}|${o.y.toFixed(3)}|${o.w.toFixed(3)}|${o.h.toFixed(3)}|${o.cap}`);
      for (const orb of s.orbs.active) sig.push(`orb|${orb.x.toFixed(3)}|${orb.y.toFixed(3)}|${orb.phase.toFixed(3)}`);
    }, 4000);
    POWERUPS.enabled = true;
    return { text: [...new Set(sig)].sort().join('\n'), items: sim.items.active.size ?? [...sim.items.active].length };
  };
  const same = [1, 2, 3].every((seed) => fingerprint(seed, true).text === fingerprint(seed, false).text);
  check('every obstacle and orb (position, size, phase) is identical with and without power-ups: no random number is drawn and no section moves (3 seeds, 4 km)', same);
  POWERUPS.enabled = false;
  let none = 0;
  fly(2, (s) => { none += [...s.items.active].length; }, 3000);
  POWERUPS.enabled = true;
  check('POWERUPS.enabled = false spawns no items at all', none === 0);
}

console.log('\n4. The magnet');
{
  const sim = stage();
  const bx = sim.distance;
  const near = sim.orbs.acquire(); near.x = bx + 3; near.y = 2.6; near.phase = 0; near.missed = false;
  const far = sim.orbs.acquire(); far.x = bx + 12; far.y = 2.6; far.phase = 0; far.missed = false;
  sim.magnetLeft = MAGNET_S;
  const startY = near.y;
  hold(sim); sim.step(DT);
  check('an orb within 4 m drifts toward the bird (and one beyond 4 m does not move)', near.y < startY && far.y === 2.6 && far.x === bx + 12);
  let got = 0;
  for (let i = 0; i < 120 && !got; i++) { hold(sim); sim.step(DT); got = sim.orbsCollected; }
  check('it is then collected by the ordinary circle test within half a second, and counts once', sim.orbsCollected === 1 && sim.orbStreak === 1 && [...sim.orbs.active].every((o) => o !== near || false) === true);
  check('scoring is unchanged: an orb is worth 5, distance 1 per metre', sim.score === sim.metres * SCORING.pointsPerMetre + 5);
  // without the magnet the same orb is NOT collected
  const s2 = stage();
  const o2 = s2.orbs.acquire(); o2.x = s2.distance + 3; o2.y = 2.6; o2.phase = 0; o2.missed = false;
  for (let i = 0; i < 120; i++) { hold(s2); s2.step(DT); }
  check('without the magnet the same orb is not collected (it is 1.4 m off the bird\'s line)', s2.orbsCollected === 0);
  // expiry
  const s3 = stage();
  s3.magnetLeft = 0.05;
  for (let i = 0; i < 12; i++) { hold(s3); s3.step(DT); }
  const o3 = s3.orbs.acquire(); o3.x = s3.distance + 3; o3.y = 2.6; o3.phase = 0; o3.missed = false;
  hold(s3); s3.step(DT);
  check('the magnet runs out after its time (no pull afterwards) and the timer never goes negative', s3.magnetLeft === 0 && o3.y === 2.6);
  // picking up another refreshes the time
  const s4 = stage();
  const it = s4.items.acquire(); it.kind = 'magnet'; it.x = s4.distance + 0.2; it.y = s4.bird.y; it.phase = 0;
  s4.magnetLeft = 2;
  hold(s4); s4.step(DT);
  check('picking up a magnet sets it to the full 8 s (it refreshes, never stacks) and raises the event once', s4.magnetLeft === MAGNET_S && events(s4, GAME_EVENTS.POWERUP).length === 1 && events(s4, GAME_EVENTS.POWERUP)[0].kind === 'magnet' && [...s4.items.active].length === 0);
  void MAGNET_PULL;
}

console.log('\n5. The shield');
{
  // pickup
  const a = stage();
  const it = a.items.acquire(); it.kind = 'shield'; it.x = a.distance + 0.2; it.y = a.bird.y; it.phase = 0;
  hold(a); a.step(DT);
  check('picking up a shield holds it (once: a second one does not stack) and raises the event', a.shield === true && events(a, GAME_EVENTS.POWERUP)[0]?.kind === 'shield' && [...a.items.active].length === 0);
  // lava
  const lava = stage();
  lava.shield = true;
  lava.bird.y = WORLD.groundY + 0.1; lava.bird.vy = -3;
  lava.step(DT);
  check('the lava is survived once: the bird bounces off the floor, the shield is spent, immunity starts, one event', lava.phase === PHASE.RUNNING && lava.shield === false && lava.grace > 1.4 && lava.bird.y > WORLD.groundY && lava.bird.vy >= 6 && events(lava, GAME_EVENTS.SHIELD_BREAK).length === 1 && events(lava, GAME_EVENTS.SHIELD_BREAK)[0].cause === 'lava');
  let ok = true;
  for (let i = 0; i < 100 && lava.grace > 0.1; i++) { lava.bird.y = WORLD.groundY + 0.1; lava.bird.vy = -3; lava.step(DT); if (lava.phase !== PHASE.RUNNING) ok = false; }
  check('during the immunity the floor cannot hurt it (it keeps bouncing)', ok && lava.phase === PHASE.RUNNING);
  for (let i = 0; i < 120 * 2 && lava.grace > 0; i++) { hold(lava); lava.step(DT); }
  lava.bird.y = WORLD.groundY + 0.1; lava.bird.vy = -3;
  lava.step(DT);
  check('after the immunity has run out the lava kills as usual (the shield was a single use)', lava.grace === 0 && (lava.phase === PHASE.DYING || lava.phase === PHASE.OVER) && lava.crashCause === 'lava');

  // an obstacle
  const obstacleTest = (shield) => {
    const sim = createGameSim();
    sim.reset(3);
    sim.flap();
    sim.step(DT);
    const o = [...sim.obstacles.active].find((x) => x.kind === 'column' && x.x > 20);
    sim.distance = sim.prevDistance = o.x - 0.1;
    sim.shield = shield;
    sim.bird.y = o.y; sim.bird.vy = 0;
    sim.events.length = 0;
    sim.step(DT);
    const c = sim.track.corridors.find((k) => sim.distance >= k.x0 - 1 && sim.distance <= k.x1 + 1);
    return { sim, c };
  };
  const hit = obstacleTest(false);
  check('without a shield the same hit ends the run (so the test really is a crash)', hit.sim.phase === PHASE.DYING && hit.sim.crashCause === 'column');
  const saved = obstacleTest(true);
  check('with a shield the crash is absorbed: still running, the shield spent, one event naming the obstacle', saved.sim.phase === PHASE.RUNNING && saved.sim.shield === false && saved.sim.grace > 1.4 && events(saved.sim, GAME_EVENTS.SHIELD_BREAK)[0]?.cause === 'column');
  check('and the bird is put back in the middle of the section\'s guaranteed gap, which is clear', !!saved.c && Math.abs(saved.sim.bird.y - saved.c.center) < 1e-9 && saved.sim.bird.vy === 0);
  // immune for a while, even inside obstacles, then vulnerable
  const sim = saved.sim;
  let alive = true;
  for (let i = 0; i < 100; i++) { const o = [...sim.obstacles.active].find((x) => x.kind === 'column' && x.x > sim.distance); if (o) sim.bird.y = o.y; sim.bird.vy = 0; sim.step(DT); if (sim.phase !== PHASE.RUNNING) alive = false; }
  check('during the immunity it passes through obstacles unharmed', alive && sim.grace > 0);
  // a second crash after the immunity ends is fatal
  const second = obstacleTest(true).sim;
  for (let i = 0; i < 120 * 2 && second.grace > 0; i++) { hold(second); second.step(DT); second.bird.y = Math.max(second.bird.y, 1.5); }
  const o = [...second.obstacles.active].find((x) => x.kind === 'column' && x.x > second.distance + 1 && x.x < second.distance + 40);
  if (o) { second.distance = second.prevDistance = o.x - 0.1; second.bird.y = o.y; second.bird.vy = 0; second.step(DT); }
  check('a second crash after the immunity is fatal (one shield, one save)', !!o && second.shield === false && second.grace === 0 && second.phase === PHASE.DYING);
}

console.log('\n6. Races');
{
  // a shield and the finish line: crossing alive still completes, with the shield held
  const s = stage(5, JOURNEY_LENGTH - 0.01);
  s.shield = true;
  s.magnetLeft = 5;
  hold(s); s.step(DT);
  check('the finish line with a shield held completes exactly once (the power-ups do not interfere)', s.phase === PHASE.COMPLETE && events(s, GAME_EVENTS.COMPLETE).length === 1 && s.metres === JOURNEY_LENGTH);
  // a shield used in the same step the finish would be crossed: the save happens, the run continues, completion follows
  const t = stage(5, JOURNEY_LENGTH - 0.01);
  t.shield = true;
  t.bird.y = WORLD.groundY + 0.1; t.bird.vy = -3;
  t.step(DT);
  check('a shield spent on the lava in the step that crosses the finish line saves the bird and the journey still completes once', t.phase === PHASE.COMPLETE && events(t, GAME_EVENTS.SHIELD_BREAK).length === 1 && events(t, GAME_EVENTS.COMPLETE).length === 1);
  // without a shield the same step is a crash, never a completion
  const u = stage(5, JOURNEY_LENGTH - 0.01);
  u.bird.y = WORLD.groundY + 0.1; u.bird.vy = -3;
  u.step(DT);
  check('without the shield that step is a crash and never a completion', u.phase === PHASE.DYING && events(u, GAME_EVENTS.COMPLETE).length === 0);
  // retry clears everything
  const v = stage();
  v.shield = true; v.magnetLeft = 6; v.grace = 1;
  v.reset(3);
  check('a retry (reset) clears the shield, the magnet, the immunity and every item', !v.shield && v.magnetLeft === 0 && v.grace === 0 && [...v.items.active].length === 0 && v.track.nextPowerup === 0);
  // ending glide: items behind despawn, the timers do not run
  const w = stage(5, JOURNEY_LENGTH - 0.01);
  hold(w); w.step(DT);
  for (let i = 0; i < 240; i++) w.step(DT);
  check('the glide after the finish line is untouched (still complete, nothing thrown)', w.phase === PHASE.COMPLETE);
}

console.log('\n7. The HUD state');
{
  const disk = new Map();
  globalThis.window = { localStorage: { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => void disk.set(k, String(v)), removeItem: (k) => void disk.delete(k) } };
  const { useGameStore } = await import('../src/store/useGameStore.js');
  const st = () => useGameStore.getState();
  st().startGame();
  st().setHud(10, 10, 0, 6, true);
  check('the HUD shows the magnet seconds and the shield', st().magnet === 6 && st().shield === true);
  let renders = 0;
  const off = useGameStore.subscribe(() => renders++);
  st().setHud(10, 10, 0, 6, true);
  st().setHud(10, 10, 0, 6, true);
  off();
  check('an unchanged snapshot causes no update (no needless re-render)', renders === 0);
  st().setHud(12, 12, 0);
  check('the old three-number call still works and clears them', st().magnet === 0 && st().shield === false);
  st().setHud(15, 15, 1, 3, true);
  st().restart();
  check('a retry clears the HUD chips', st().magnet === 0 && st().shield === false);
}

console.log('\n8. The Auto play bot');
{
  let picked = 0;
  const results = [];
  for (const seed of [1, 2]) {
    const sim = createGameSim();
    sim.reset(seed);
    const bot = createAutopilot(sim);
    let steps = 0;
    while (sim.phase !== PHASE.DYING && sim.phase !== PHASE.OVER && sim.phase !== PHASE.COMPLETE && steps++ < 120 * 1800) {
      bot.control();
      sim.step(DT);
      for (const e of sim.events) if (e.type === GAME_EVENTS.POWERUP) picked++;
      sim.events.length = 0;
    }
    results.push(sim.phase);
  }
  check('Auto play flies two whole journeys to the finish line with the power-ups in the track', results.every((p) => p === PHASE.COMPLETE), results.join());
  check(`and it picks power-ups up on the way (${picked})`, picked >= 2);
}

console.log('\n9. The pictures and the sources');
{
  const path = 'public/images/powerups/powerups.webp';
  const buf = readFileSync(new URL(`../${path}`, import.meta.url));
  const kb = statSync(new URL(`../${path}`, import.meta.url)).size / 1024;
  const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
  const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
  check(`the atlas is one WebP with transparency, ${w} x ${h}: 5 worlds by 2 kinds of 192 px cells (${kb.toFixed(0)} KB)`, buf.toString('ascii', 8, 12) === 'WEBP' && buf.toString('ascii', 12, 16) === 'VP8X' && (buf[20] & 0x10) !== 0 && w === 960 && h === 384 && kb <= 160);
  const field = read('src/components/scene/ItemField.jsx');
  check('the items are drawn from that atlas, one cell per world and kind, magnet on the top row', /images\/powerups\/powerups\.webp/.test(field) && /magnet: 0, shield: 1/.test(field) && /worldIndexAt\(it\.x\)/.test(field));
  check('there is no outline: no ring, circle, glow disc or second material round the pictures', !/CircleGeometry|RingGeometry|halo/i.test(strip(field)) && (field.match(/new MeshBasicMaterial/g) ?? []).length === 1);
  check('nothing is allocated per frame, a cell with no item is hidden, and the texture is released on leaving', (() => { const loop = field.slice(field.indexOf('useFrame('), field.indexOf('return (\n    <group>')); return !/\bnew [A-Z]/.test(loop) && /m\.visible = counts\[i\] > 0/.test(field) && /tex\.dispose\(\)/.test(field); })());
  const sim = strip(read('src/systems/game/createGameSim.js'));
  check('the simulation owns the rules: pickup by a circle test, the shield as a single use, the magnet as a pull (no renderer or store is imported)', /itemReach/.test(sim) && /function shieldSave/.test(sim) && /MAGNET_PULL/.test(sim) && !/useGameStore|OrbField|ItemField/.test(sim));
  check('no power-up code reads a bird, a skin or the theme: every bird has the same rules', !/avatar|skin|theme/i.test(strip(read('src/systems/powerups/powerups.js'))) && !/avatar|useSkin/i.test(sim));
  check('the spawner draws no random number for an item (the only rng calls are the section\'s own)', (() => { const sp = strip(read('src/systems/obstacles/spawner.js')); const block = sp.slice(sp.indexOf('POWERUPS.enabled && builder.item'), sp.indexOf('const section = PATTERNS')); return !/rng/.test(block); })());
  check('the bot plans for items like orbs', /sim\.items\.active/.test(read('src/systems/bot/autopilot.js')));
  const hud = read('src/components/ui/GameHUD.jsx');
  check('the HUD shows the magnet seconds and the shield only while held', /magnet > 0/.test(hud) && /\{shield &&/.test(hud));
  const bird = read('src/components/scene/PlayerBird.jsx');
  check('the shield bubble is drawn behind the bird, flickers during the immunity and is a look only', /sim\.shield \|\| sim\.grace > 0/.test(bird) && /position=\{\[0, 0, -0\.3\]\}/.test(bird));
}

console.log(failures ? `\n${failures} failed` : '\npower-up tests passed');
process.exit(failures ? 1 : 0);
