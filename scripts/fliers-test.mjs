/**
 * Flying-hazard tests (no browser): the smoke cloud, the fire and energy rings, the ember tornado and the metal disc. Real simulation, spawner and Auto play bot. Run with: npm run test:fliers
 * Covers the schedule (one new type per world, cumulative, rare and rising), the pure flight paths, the hit rules (gates, 75% hitboxes, harmless smoke), that no section enters a band, the shield,
 * the bot, and the sources (art atlas, no outline, nothing allocated per frame).
 */
import { readFileSync, statSync } from 'node:fs';
import { PHASE, createGameSim } from '../src/systems/game/createGameSim.js';
import { createAutopilot } from '../src/systems/bot/autopilot.js';
import { GAME_EVENTS } from '../src/systems/events/gameEvents.js';
import { PHYSICS, WORLD } from '../src/systems/physics/constants.js';
import { windowsIn } from '../src/systems/hazards/biomeHazards.js';
import { SLOTS as ITEM_SLOTS, ITEM_BEFORE } from '../src/systems/powerups/powerups.js';
import { FINISH_CLEAR, JOURNEY_LENGTH, WORLDS, worldIndexAt } from '../src/systems/world/worlds.js';
import { ATLAS, ATLAS_COLS, ATLAS_ROWS, BAND_AFTER, BAND_BEFORE, EVERY, FLIERS, HIT, INTRO, KINDS, NEW_AFTER, ROLE, SHAPE, SLOTS, flierBandAfter, flierHits, flierPlace, flierRescueY } from '../src/systems/fliers/fliers.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) { failures++; console.log(`  FAIL ${name} ${detail}`); } else console.log(`  ok   ${name}${detail ? ` (${detail})` : ''}`);
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const DT = PHYSICS.fixedStep;
const R = PHYSICS.birdRadius;
const events = (sim, type) => sim.events.filter((e) => e.type === type);
const P = { x: 0, dx: 0, y: 0 };
const first = (kind) => SLOTS.find((s) => s.kind === kind);

/** A clean stage right at a hazard's encounter: the bird at distance e + `before`, at height `y`. */
function stage(slot, before = 0.05, y = null, seed = 3) {
  const sim = createGameSim();
  sim.reset(seed);
  sim.flap();
  sim.step(DT);
  sim.obstacles.releaseAll(); sim.orbs.releaseAll(); sim.items.releaseAll();
  sim.track.nextX = 1e9;
  sim.distance = sim.prevDistance = slot.e - before;
  flierPlace(slot, sim.distance, P);
  sim.bird.y = y ?? P.y;
  sim.bird.vy = 0;
  sim.events.length = 0;
  return sim;
}
const hold = (sim) => { sim.bird.vy = 0; };

console.log('\n1. The schedule');
check('five types in order, one introduced per world: smoke 1, fire ring 2, energy ring 3, tornado 4, disc 5', KINDS.join() === 'smoke,firering,energyring,tornado,disc' && KINDS.every((k, i) => INTRO[k] === i));
check('roles: the smoke is harmless, the two rings are gates, the tornado and the disc are lethal', ROLE.smoke === 'harmless' && ROLE.firering === 'gate' && ROLE.energyring === 'gate' && ROLE.tornado === 'lethal' && ROLE.disc === 'lethal');
{
  const world = (s) => worldIndexAt(s.e);
  check(`about thirty events in the journey (${SLOTS.length}), in order, the first after ${NEW_AFTER} m and none in the last ${FINISH_CLEAR + 150} m`, SLOTS.length >= 25 && SLOTS.length <= 40 && SLOTS.every((s, i) => i === 0 || s.e > SLOTS[i - 1].e) && SLOTS[0].e >= NEW_AFTER && SLOTS[SLOTS.length - 1].e < JOURNEY_LENGTH - FINISH_CLEAR - 150);
  check('cumulative: a world only ever shows types introduced in it or before', SLOTS.every((s) => INTRO[s.kind] <= world(s)));
  check('the newest type of a world appears only after 400 m into that world, and every world does introduce its own', WORLDS.every((w) => { const mine = SLOTS.filter((s) => INTRO[s.kind] === w.index); return mine.length >= 2 && mine.every((s) => s.e - w.start >= NEW_AFTER); }));
  check('the first world has only the smoke, and the last world shows the disc alongside earlier types', SLOTS.filter((s) => world(s) === 0).every((s) => s.kind === 'smoke') && new Set(SLOTS.filter((s) => world(s) === 4).map((s) => s.kind)).size >= 3);
  const gap = WORLDS.map((w) => { const e = SLOTS.filter((s) => world(s) === w.index).map((s) => s.e); return e.slice(1).reduce((a, x, i) => a + (x - e[i]), 0) / Math.max(1, e.length - 1); });
  check(`rare and rising: the average gap falls from world to world (${gap.map((g) => Math.round(g)).join(', ')} m; the targets are ${EVERY.join(', ')})`, gap.every((g, i) => i === 0 || g < gap[i - 1] + 25) && gap[4] < gap[0] * 0.75 && gap.every((g, i) => g > EVERY[i] * 0.6 && g < EVERY[i] * 1.6));
  const min = Math.min(...SLOTS.slice(1).map((s, i) => s.e - SLOTS[i].e));
  check(`two events are never closer than ${Math.round(min)} m, so at most one is on screen at a time`, min >= 120);
  let clash = 0;
  for (const s of SLOTS) windowsIn(s.e - 80, s.e + 60, (k, st, len, lead) => { if (st - lead - 2 < s.e + 24 && st + len + 6 > s.e - 50) clash++; });
  check('no event overlaps a biome hazard window (its force, telegraph or settling room)', clash === 0, `${clash}`);
  check('the hazards are deterministic: positions come from hashes, not a clock or random numbers', !/Math\.random|performance\.now|Date\.now|rng/.test(strip(read('src/systems/fliers/fliers.js'))));
}

console.log('\n2. The flight paths');
{
  let bad = 0, nonMono = 0, atEnc = 0, offField = 0, tightest = Infinity, fastest = 0;
  for (const s of SLOTS) {
    const sh = SHAPE[s.kind];
    let prevDx = Infinity;
    for (let d = s.e - 80; d <= s.e + 15; d += 0.5) {
      flierPlace(s, d, P);
      const again = flierPlace(s, d, { x: 0, dx: 0, y: 0 });
      if (again.x !== P.x || again.y !== P.y) bad++;
      if (P.dx > prevDx + 1e-9) nonMono++;
      prevDx = P.dx;
      if (ROLE[s.kind] === 'lethal') {
        const block = sh.r * HIT + R + sh.seg;
        const lo = Math.max(WORLD.groundY + R, P.y - block);
        const hi = Math.min(WORLD.ceilingY, P.y + block);
        tightest = Math.min(tightest, (WORLD.ceilingY - (WORLD.groundY + R)) - Math.max(0, hi - lo));
      } else if (ROLE[s.kind] === 'gate') {
        if (P.y > WORLD.ceilingY - 0.8 || P.y < WORLD.groundY + R + 0.5) offField++;
      }
    }
    flierPlace(s, s.e, P);
    if (Math.abs(P.dx) > 1e-9 || Math.abs(P.y - s.yc) > 1e-9) atEnc++;
    fastest = Math.max(fastest, sh.amp * sh.omega);
  }
  check('a place is a pure function of the distance (the same distance always gives the same place)', bad === 0);
  check('it flies steadily toward the bird: its distance ahead only ever falls as the bird advances', nonMono === 0);
  check('at its encounter distance it is exactly level with the bird\'s x, at the planned height', atEnc === 0);
  check(`a lethal shape never leaves less than ${tightest.toFixed(1)} m of free height to fly through (at least 3)`, tightest >= 3);
  check('a gate\'s hole always stays inside the flyable band, so it can always be reached', offField === 0);
  check(`it sways slowly: at most ${fastest.toFixed(2)} m of height per metre flown (the bird climbs far faster)`, fastest <= 0.45);
  const dxAt = (kind, d) => flierPlace({ ...first(kind), e: 1000 }, d, { x: 0, dx: 0, y: 0 }).dx;
  check('and it is visible long before it can touch: 40 m before the encounter it is still more than 44 m ahead (about 4 s at full speed)', KINDS.every((k) => dxAt(k, 960) > 44));
}

console.log('\n3. What touches the bird');
{
  const slotOf = (kind) => ({ ...first(kind), e: 1000, yc: 1.0, dir: 1 });
  const at = (slot, dxWanted, dy) => { const d = 1000 - dxWanted / (1 + SHAPE[slot.kind].drift); flierPlace(slot, d, P); return flierHits(slot, P, P.y + dy, R); };
  check('the smoke cloud never touches anything, even dead centre', !at(slotOf('smoke'), 0, 0) && !at(slotOf('smoke'), 0.3, 0.2));
  for (const kind of ['firering', 'energyring']) {
    const s = slotOf(kind);
    const sh = SHAPE[kind];
    const mid = (sh.body + sh.hole) / 2;
    const half = (HIT * (sh.body - sh.hole)) / 2;
    check(`${kind}: the middle of the hoop is safe, its top and bottom rim are lethal, well outside is safe`, !at(s, 0, 0) && !at(s, 0, 0.4) && at(s, 0, mid) && at(s, 0, -mid) && !at(s, 0, mid + half + R + 0.2));
    check(`${kind}: its left and right rim cannot be avoided when flying through it, so they are not lethal (a bird level with the centre crosses them unharmed)`, !at(s, mid, 0) && !at(s, -mid, 0) && !at(s, mid, 0.3) && at(s, 0.3, mid));
    check(`${kind}: the rim is forgiving (only its middle ${HIT * 100}% is lethal, plus the bird's own radius)`, !at(s, 0, mid - half - R - 0.02) && at(s, 0, mid - half - R + 0.02) && !at(s, 0, mid + half + R + 0.02) && at(s, 0, mid + half + R - 0.02));
    check(`${kind}: the bird can pass through the hole with ${(mid - half - R).toFixed(2)} m to spare on each side of the centre`, mid - half - R >= 0.45);
  }
  for (const kind of ['disc', 'tornado']) {
    const s = slotOf(kind);
    const sh = SHAPE[kind];
    const reach = sh.r * HIT + R;
    check(`${kind}: lethal inside 75% of its drawn radius plus the bird, safe just outside (reach ${reach.toFixed(2)} m)`, at(s, 0, 0) && at(s, 0, reach - 0.02) && !at(s, 0, reach + sh.seg + 0.02) && !at(s, reach + 0.02, 0));
  }
  const t = slotOf('tornado');
  check('the tornado is a tall capsule: lethal along its height, safe beyond it', at(t, 0, SHAPE.tornado.seg) && !at(t, 0, SHAPE.tornado.seg + SHAPE.tornado.r * HIT + R + 0.05));
  check('the shield\'s rescue puts the bird in a ring\'s hole, and clear of a lethal shape', (() => { const g = slotOf('firering'); flierPlace(g, 1000, P); const ry = flierRescueY(g, P, P.y + 1.2, -2.8, 4.4); const d = slotOf('disc'); flierPlace(d, 1000, P); const up = flierRescueY(d, P, P.y + 0.2, -2.8, 4.4); const dn = flierRescueY(d, P, P.y - 0.2, -2.8, 4.4); return Math.abs(ry - 1.0) < 1e-9 && Math.abs(up - P.y) > SHAPE.disc.r * HIT + R && Math.abs(dn - P.y) > SHAPE.disc.r * HIT + R && up > P.y && dn < P.y; })());
}

console.log('\n4. In the simulation');
{
  for (const kind of ['disc', 'tornado']) {
    const s = first(kind);
    const sim = stage(s);
    sim.step(DT);
    check(`flying into the ${kind} ends the run (cause "${kind}")`, (sim.phase === PHASE.DYING || sim.phase === PHASE.OVER) && sim.crashCause === kind);
  }
  for (const kind of ['firering', 'energyring']) {
    const s = first(kind);
    const sim = stage(s);
    for (let i = 0; i < 60; i++) { hold(sim); sim.step(DT); flierPlace(s, sim.distance, P); sim.bird.y = P.y; } // follows the middle of the hole as it passes
    check(`flying through the middle of the ${kind} is safe`, sim.phase === PHASE.RUNNING && sim.distance > s.e + 2);
    const hit = stage(s, 0.05, null);
    flierPlace(s, hit.distance, P);
    hit.bird.y = P.y + (SHAPE[kind].body + SHAPE[kind].hole) / 2;
    hit.step(DT);
    check(`hitting the rim of the ${kind} ends the run`, (hit.phase === PHASE.DYING || hit.phase === PHASE.OVER) && hit.crashCause === kind);
  }
  const smoke = first('smoke');
  const sm = stage(smoke);
  for (let i = 0; i < 120; i++) { hold(sm); sm.step(DT); flierPlace(smoke, sm.distance, P); sm.bird.y = P.y; }
  check('flying straight through the smoke cloud does nothing at all', sm.phase === PHASE.RUNNING && sm.distance > smoke.e + 3 && !sm.shield);

  // the shield
  const d = first('disc');
  const sh = stage(d);
  sh.shield = true;
  sh.step(DT);
  flierPlace(d, sh.distance, P);
  check('a shield absorbs a hit from a lethal hazard: still running, the shield spent, immunity on, one event naming it', sh.phase === PHASE.RUNNING && !sh.shield && sh.grace > 1.4 && events(sh, GAME_EVENTS.SHIELD_BREAK).length === 1 && events(sh, GAME_EVENTS.SHIELD_BREAK)[0].cause === 'disc');
  check('and the bird is moved clear of the shape (not left inside it)', Math.abs(sh.bird.y - P.y) > SHAPE.disc.r * HIT + R);
  let alive = true;
  for (let i = 0; i < 100; i++) { hold(sh); sh.step(DT); flierPlace(d, sh.distance, P); sh.bird.y = P.y; if (sh.phase !== PHASE.RUNNING) alive = false; }
  check('during the immunity it flies straight through the hazard unharmed', alive);
  const ring = first('firering');
  const rs = stage(ring);
  rs.shield = true;
  flierPlace(ring, rs.distance, P);
  rs.bird.y = P.y + (SHAPE.firering.body + SHAPE.firering.hole) / 2;
  rs.step(DT);
  flierPlace(ring, rs.distance, P);
  check('a shield spent on a ring puts the bird in the middle of its hole', rs.phase === PHASE.RUNNING && !rs.shield && Math.abs(rs.bird.y - P.y) < 1e-9 && events(rs, GAME_EVENTS.SHIELD_BREAK)[0].cause === 'firering');
  const two = stage(first('tornado'));
  two.shield = true;
  two.step(DT);
  for (let i = 0; i < 120 * 2 && two.grace > 0; i++) { hold(two); two.step(DT); two.bird.y = 2.5; }
  const disc2 = SLOTS.find((s) => s.kind === 'disc' && s.e > two.distance) ?? d;
  two.distance = two.prevDistance = disc2.e - 0.05;
  flierPlace(disc2, two.distance, P);
  two.bird.y = P.y; two.bird.vy = 0;
  two.step(DT);
  check('one shield saves one hit: a second hit after the immunity is fatal', two.grace === 0 && (two.phase === PHASE.DYING || two.phase === PHASE.OVER));
  const off = stage(d);
  FLIERS.enabled = false;
  off.step(DT);
  FLIERS.enabled = true;
  check('FLIERS.enabled = false removes every hazard (the same hit does nothing)', off.phase === PHASE.RUNNING);
  // finish line: a crash in that step is a crash, never a completion (unchanged by hazards: they stop before the finish clear zone)
  check('no hazard is ever within the last 190 m, so none can interfere with the finish line', SLOTS.every((s) => s.e + BAND_AFTER < JOURNEY_LENGTH - FINISH_CLEAR));
}

console.log('\n5. The track keeps clear of them');
{
  let inBand = 0, itemInPath = 0, count = 0, finished = 0;
  const seeds = [1, 2, 3, 4, 5, 6];
  for (const seed of seeds) {
    const sim = createGameSim();
    sim.reset(seed);
    sim.flap();
    const seen = new Set();
    let steps = 0;
    while (sim.phase === PHASE.RUNNING && steps++ < 120 * 1800) {
      sim.shield = true; // this bird follows the corridors and cannot dodge a hazard: the shield stands in for dodging, so what is measured is the OBSTACLE track (are the bands in the way?)
      const c = sim.track.corridors.find((k) => k.x1 > sim.distance - 0.3);
      const target = c ? Math.max(c.lo + 0.8, c.center - 0.6) : 0;
      const { y, vy } = sim.bird;
      if (vy < 0 && (y < target || (c && y < c.lo + 0.5))) sim.flap();
      sim.step(DT);
      for (const k of sim.track.corridors) {
        const key = k.x0.toFixed(3);
        if (seen.has(key)) continue;
        seen.add(key);
        count++;
        for (const s of SLOTS) if (k.x0 < s.e + BAND_AFTER && k.x1 > s.e - BAND_BEFORE) inBand++;
      }
      for (const it of sim.items.active) for (const s of SLOTS) if (it.x > s.e - 4 && it.x < s.e + SHAPE[s.kind].half + 14) itemInPath++;
    }
    if (sim.phase === PHASE.COMPLETE) finished++;
  }
  check(`no obstacle section (${count} on ${seeds.length} seeds) enters any hazard's band [e - ${BAND_BEFORE}, e + ${BAND_AFTER}] m`, inBand === 0, `${inBand}`);
  check('no power-up item sits in a hazard\'s path', itemInPath === 0, `${itemInPath}`);
  check('a corridor-following bird (with a shield standing in for dodging the hazards) still reaches the finish line on every seed: the bands never break the fairness of the obstacle track', finished === seeds.length, `${finished}/${seeds.length}`);
  check('the band function is a pure shift: it never moves a position backwards, and it leaves open air alone', flierBandAfter(5, 12) === 5 && SLOTS.every((s) => flierBandAfter(s.e - 40, 12) <= s.e - 40 + 1e-9 || flierBandAfter(s.e - 40, 12) === s.e + BAND_AFTER));
  FLIERS.enabled = false;
  check('with the hazards off there are no bands (so the track is the one without hazards)', flierBandAfter(SLOTS[0].e, 12) === SLOTS[0].e);
  FLIERS.enabled = true;
  void ITEM_SLOTS; void ITEM_BEFORE;
}

console.log('\n6. The Auto play bot');
{
  const results = [];
  let maxMs = 0;
  for (const seed of [1, 2]) {
    const sim = createGameSim();
    sim.reset(seed);
    const bot = createAutopilot(sim);
    let steps = 0;
    while (sim.phase !== PHASE.DYING && sim.phase !== PHASE.OVER && sim.phase !== PHASE.COMPLETE && steps++ < 120 * 1800) {
      bot.control();
      sim.step(DT);
      sim.events.length = 0;
    }
    maxMs = Math.max(maxMs, bot.stats.maxMs);
    results.push(`${sim.phase}${sim.phase === PHASE.COMPLETE ? '' : ` @${sim.metres} (${sim.crashCause})`}`);
  }
  check('Auto play flies two whole journeys through every hazard to the finish line', results.every((r) => r === 'complete'), results.join(' | '));
  check(`its planning stays cheap with the hazards in it (slowest plan ${maxMs.toFixed(1)} ms)`, maxMs < 150);
}

console.log('\n7. The art and the sources');
{
  const path = 'public/images/hazards/hazards.webp';
  const buf = readFileSync(new URL(`../${path}`, import.meta.url));
  const kb = statSync(new URL(`../${path}`, import.meta.url)).size / 1024;
  const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
  const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
  check(`the atlas is one WebP with transparency, ${w} x ${h} (${ATLAS_COLS} x ${ATLAS_ROWS} cells of 192 px), ${kb.toFixed(0)} KB`, buf.toString('ascii', 8, 12) === 'WEBP' && buf.toString('ascii', 12, 16) === 'VP8X' && (buf[20] & 0x10) !== 0 && w === 192 * ATLAS_COLS && h === 192 * ATLAS_ROWS && kb <= 260);
  check('one cell per (hazard, world) pair that exists: a hazard has a colour grade for its own world and every later one, none before', Object.keys(ATLAS).length === 15 && KINDS.every((k) => WORLDS.every((wd) => (`${k}:${wd.index}` in ATLAS) === (wd.index >= INTRO[k]))));
  const py = read('scripts/build-hazard-atlas.py');
  check('the build script agrees with the game about the hazards, their order and their introduction worlds', /KINDS = \['smoke', 'firering', 'energyring', 'tornado', 'disc'\]/.test(py) && /INTRO = \{'smoke': 0, 'firering': 1, 'energyring': 2, 'tornado': 3, 'disc': 4\}/.test(py));
  const field = read('src/components/scene/FlierField.jsx');
  check('they are drawn from that atlas with the simulation\'s own place function, from the interpolated distance', /images\/hazards\/hazards\.webp/.test(field) && /flierPlace\(sl, dist, place\)/.test(field) && /sim\.renderDistance\(\)/.test(field));
  check('there is no outline: no ring, circle, glow disc or second material round the pictures', !/CircleGeometry|RingGeometry|halo/i.test(strip(field)) && (field.match(/new MeshBasicMaterial/g) ?? []).length === 1);
  check('the harmless smoke is drawn behind the obstacles, orbs and bird (further back and earlier), so it can never hide anything that matters', /harmless \? -1\.4 : 0\.2/.test(field) && /harmless' \? 1 : 5/.test(field.replace(/\s+/g, ' ').replace('"harmless"', "'harmless'")) || /=== 'harmless' \? 1 : 5/.test(field));
  check('nothing is allocated per frame, a hazard with none on screen is hidden, the texture is released on leaving', (() => { const loop = field.slice(field.indexOf('useFrame('), field.indexOf('return (\n    <group>')); return !/\bnew [A-Z]/.test(loop) && /m\.visible = counts\[c\] > 0/.test(field) && /atlas\.dispose\(\)/.test(field); })());
  const sim = strip(read('src/systems/game/createGameSim.js'));
  check('the simulation owns the rules (pure place and hit tests; the shield\'s rescue); the renderer and the store are not imported', /flierHits/.test(sim) && /flierRescueY/.test(sim) && !/FlierField|useGameStore/.test(sim));
  check('no hazard code reads a bird, a skin or the theme: every bird meets the same hazards', !/avatar|skin|theme/i.test(strip(read('src/systems/fliers/fliers.js'))));
  check('the bot plans with the same place and hit functions as the simulation', /flierPlace\(sl, x, fp\)/.test(read('src/systems/bot/autopilot.js')) && /flierHits\(sl, fp, b\.y, R\)/.test(read('src/systems/bot/autopilot.js')));
  check('the Game Over screen names each new cause', ['firering', 'energyring', 'tornado', 'disc'].every((k) => new RegExp(`${k}:`).test(read('src/components/ui/GameOverPanel.jsx'))));
  check('there is an opt-out for comparison: ?fliers=0', /get\('fliers'\) === '0'/.test(read('src/systems/game/gameInstance.js')));
  const spawner = strip(read('src/systems/obstacles/spawner.js'));
  check('the spawner only shifts a section (no random number is drawn for a hazard band)', (() => { const b = spawner.slice(spawner.indexOf('let x = gapX'), spawner.indexOf('const time = ')); return /flierBandAfter/.test(b) && !/rng/.test(b); })());
}

console.log(failures ? `\n${failures} failed` : '\nflier tests passed');
process.exit(failures ? 1 : 0);
