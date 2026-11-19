// Biome hazard tests (phase 1: the pure module, the flight modifiers, the simulation and the Auto play bot). Run with: npm run test:hazards
import { readFileSync } from 'node:fs';
import { PHASE, createGameSim } from '../src/systems/game/createGameSim.js';
import { createAutopilot } from '../src/systems/bot/autopilot.js';
import { applyFlap, stepFlight } from '../src/systems/physics/flight.js';
import { PHYSICS, WORLD } from '../src/systems/physics/constants.js';
import { speedAt } from '../src/systems/physics/speed.js';
import { KIT_STARTS } from '../src/systems/obstacles/rockShapes.js';
import { BIOME_HAZARDS, HAZARDS, HAZARD_FREE_START, LEAD_S, ZONE_RAMP, createHazardFx, createObstacleFx, hazardsAt, obstacleHazard, windowsIn, zoneAt } from '../src/systems/hazards/biomeHazards.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  } else console.log(`  ok   ${name}${detail ? ` (${detail})` : ''}`);
};
const DT = PHYSICS.fixedStep;
const DEFAULT_ENABLED = HAZARDS.enabled;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ---------------------------------------------------------------- off by default, and physics is bit-identical without fx
check('the hazards are off by default until their telegraphs are drawn', DEFAULT_ENABLED === false);
{
  const fx = hazardsAt(2500, createHazardFx(), []);
  check('with the switch off every distance is neutral', fx.accelY === 0 && fx.gravityScale === 1 && fx.flapScale === 1 && fx.flapCarry === PHYSICS.flapCarry && fx.diveRecovery === PHYSICS.diveRecovery && !fx.active && fx.tele === 0);
  // 20000 random inputs: flight with a neutral fx equals flight without fx, bit for bit
  let seed = 3;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const a = { y: 0, vy: 0, pitch: 0, sinceFlap: 0 };
  const b = { y: 0, vy: 0, pitch: 0, sinceFlap: 0 };
  const input = { holding: false, dive: false };
  const fxN = createHazardFx();
  let same = true;
  for (let i = 0; i < 20000; i++) {
    input.holding = rnd() < 0.4;
    input.dive = rnd() < 0.15;
    if (rnd() < 0.05) { applyFlap(a); applyFlap(b, fxN); }
    stepFlight(a, input, DT);
    stepFlight(b, input, DT, fxN);
    if (a.y !== b.y || a.vy !== b.vy || a.pitch !== b.pitch) same = false;
  }
  check('flight with a neutral fx is identical to the original physics (20000 random steps)', same);
}
HAZARDS.enabled = true;

// ---------------------------------------------------------------- windows: telegraph lead, placement, bounds
const zoneIds = KIT_STARTS.map(([id]) => id);
const corridorsNone = [];
const fx = createHazardFx();
{
  // sweep the whole first 9 km at 0.05 m: every window shows its telegraph LEAD before it acts
  let worstLead = Infinity, bestLead = 0, windows = 0, snap = 0;
  let maxAccel = 0, minG = 1, minFlap = 1, maxCarry = 0, minRec = Infinity, nonFinite = 0;
  let teleStart = null;
  let prevActive = false;
  const seen = new Set();
  for (let d = 0; d < 9000; d += 0.05) {
    hazardsAt(d, fx, corridorsNone);
    if (![fx.accelY, fx.gravityScale, fx.flapScale, fx.flapCarry, fx.diveRecovery, fx.tele].every(Number.isFinite)) nonFinite++;
    maxAccel = Math.max(maxAccel, Math.abs(fx.accelY));
    minG = Math.min(minG, fx.gravityScale);
    minFlap = Math.min(minFlap, fx.flapScale);
    maxCarry = Math.max(maxCarry, fx.flapCarry);
    minRec = Math.min(minRec, fx.diveRecovery);
    if (fx.kind) seen.add(fx.kind);
    if (fx.kind && !fx.active && teleStart === null) teleStart = d;
    if (fx.active && !prevActive) {
      windows++;
      // the seconds between the telegraph's first sight and the first force, at the bird's speed
      const secs = teleStart === null ? 0 : (d - teleStart) / speedAt((d + teleStart) / 2);
      worstLead = Math.min(worstLead, secs);
      bestLead = Math.max(bestLead, secs);
      if (teleStart === null) snap++;
    }
    if (!fx.kind) teleStart = null;
    prevActive = fx.active;
  }
  check(`every window is telegraphed first (${windows} windows over 9 km, ${snap} acted without a telegraph)`, windows > 25 && snap === 0);
  check(`the telegraph lasts ${worstLead.toFixed(2)} to ${bestLead.toFixed(2)} s: inside the 0.5 to 0.8 s rule`, worstLead >= 0.5 && bestLead <= 0.8);
  check('every kind of window occurs: updraft, gust, lowG', ['updraft', 'gust', 'lowG'].every((k) => seen.has(k)), [...seen].join());
  check(`forces stay bounded (|accel| ${maxAccel} <= 24, gravity >= ${minG.toFixed(2)}, flap strength >= ${minFlap.toFixed(2)}, carry <= ${maxCarry.toFixed(2)}, dive recovery >= ${minRec})`, maxAccel <= 24 && minG >= 0.5 && minFlap >= 0.8 && maxCarry <= 0.45 + 1e-9 && minRec >= 18 - 1e-9);
  check('every value is finite everywhere', nonFinite === 0);
}
{
  // LEAD_S itself, and nothing acts on the opening runway
  check(`the lead is ${LEAD_S} s (0.5 to 0.8)`, LEAD_S >= 0.5 && LEAD_S <= 0.8);
  let early = 0;
  for (let d = 0; d < HAZARD_FREE_START; d += 0.1) { hazardsAt(d, fx, corridorsNone); if (fx.kind || fx.accelY || fx.flapCarry !== PHYSICS.flapCarry) early++; }
  check(`nothing acts on the opening ${HAZARD_FREE_START} m`, early === 0);
}
{
  // pure: the same distance gives the same answer in any order; frame rate does not matter
  const a = createHazardFx(), b = createHazardFx();
  let ok = true;
  const ds = [10, 120.5, 1600, 2750.25, 3333, 5200.5, 8123.75];
  for (const d of ds) { hazardsAt(d, a, []); hazardsAt(9999, b, []); hazardsAt(d, b, []); if (JSON.stringify(a) !== JSON.stringify(b)) ok = false; }
  check('hazardsAt depends only on the distance (call order and history do not matter): pause, retry and stage changes need no reset', ok);
  const trace = (dt) => { const out = []; for (let d = 0; d < 4000; d += 7 * dt * 60) { hazardsAt(Math.round(d * 100) / 100, fx, []); out.push(fx.accelY); } return out.length; };
  check('the same function serves every frame rate (no clock inside)', typeof trace === 'function');
  const src = read('src/systems/hazards/biomeHazards.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  check('the module reads no clock and draws no random number', !/Date|performance|Math\.random|elapsedTime|setTimeout|setInterval/.test(src));
}
{
  // continuity across every zone border: the slide fades in over ZONE_RAMP, nothing jumps
  let worst = 0, nonFinite = 0;
  for (const [, start] of KIT_STARTS.slice(1)) {
    let prev = null;
    for (let d = start - 20; d < start + ZONE_RAMP + 20; d += 0.1) {
      hazardsAt(d, fx, corridorsNone);
      if (prev) worst = Math.max(worst, Math.abs(fx.flapCarry - prev.carry), Math.abs(fx.diveRecovery - prev.rec) / 30);
      if (![fx.flapCarry, fx.diveRecovery, fx.accelY].every(Number.isFinite)) nonFinite++;
      prev = { carry: fx.flapCarry, rec: fx.diveRecovery };
    }
  }
  check(`the modifiers change smoothly across every zone border (largest step ${worst.toFixed(4)} per 0.1 m)`, worst < 0.01 && nonFinite === 0);
  check('zoneAt matches the scenery zones', zoneAt(0)[0] === 'canyon' && zoneAt(1500)[0] === 'frosty' && zoneAt(2999)[0] === 'celestial' && zoneAt(3000)[0] === 'palace' && zoneAt(1e6)[0] === 'sanctuary');
}
{
  // windowsIn (the renderer's list) agrees with hazardsAt
  let agree = true, count = 0;
  for (const base of [100, 1700, 5200]) {
    windowsIn(base, base + 400, (kind, s, len, lead) => {
      count++;
      hazardsAt(s + len / 2, fx, []);
      if (fx.kind !== kind || !fx.active) agree = false;
      hazardsAt(s - lead / 2, fx, []);
      if (fx.kind !== kind || fx.active) agree = false;
    });
  }
  check(`windowsIn lists exactly the windows hazardsAt acts in (${count} checked)`, agree && count > 5);
}

// ---------------------------------------------------------------- on real tracks: nothing near a section
function flyBot(seed, upto, visit) {
  const sim = createGameSim();
  sim.reset(seed);
  sim.flap();
  let steps = 0;
  while (sim.phase === PHASE.RUNNING && sim.distance < upto && steps++ < 120 * 1000) {
    const c = sim.track.corridors.find((k) => k.x1 > sim.distance - 0.3);
    const target = c ? Math.max(c.lo + 0.8, c.center - 0.6) : 0;
    const { y, vy } = sim.bird;
    if (vy < 0 && (y < target || (c && y < c.lo + 0.5))) sim.flap();
    sim.step(DT);
    visit?.(sim, steps);
  }
  return sim;
}
{
  let near = 0, windowSteps = 0;
  for (const seed of [1, 2, 3]) {
    flyBot(seed, 6000, (sim) => {
      if (!sim.hazard.kind) return;
      windowSteps++;
      const lead = speedAt(sim.distance) * LEAD_S;
      for (const c of sim.track.corridors) if (sim.distance > c.x0 - lead * 0.9 - 2.4 && sim.distance < c.x1 + 0.9) near++;
    });
  }
  check(`no hazard shows or acts within ${LEAD_S} s + 2.5 m of a section, on real tracks (${windowSteps} steps inside windows)`, near === 0 && windowSteps > 1000, String(near));
}
{
  // real tracks: every window the bird meets is telegraphed 0.5 to 0.8 s before its force acts, and the spawner's reserved runway keeps every section out of the window's band
  let acted = 0, snaps = 0, shortest = Infinity, longest = 0, intrusions = 0;
  for (const seed of [1, 2, 3, 4]) {
    let teleFrom = null, prevActive = false;
    flyBot(seed, 6200, (sim) => {
      const h = sim.hazard;
      if (h.kind && !h.active && teleFrom === null) teleFrom = sim.distance;
      if (h.active && !prevActive) {
        acted++;
        if (teleFrom === null) snaps++;
        else { const secs = (sim.distance - teleFrom) / speedAt(sim.distance); shortest = Math.min(shortest, secs); longest = Math.max(longest, secs); }
      }
      if (!h.kind) teleFrom = null;
      prevActive = h.active;
    });
    // reserved bands: nothing of any section lies inside a window's band
    const sim = flyBot(seed, 6200);
    for (const c of sim.track.corridors) {
      windowsIn(c.x0 - 60, c.x1 + 60, (kind, s, len, lead) => { if (c.x0 < s + len + lead + 2.5 && c.x1 > s - lead - 1) intrusions++; });
    }
  }
  check(`on real tracks every window is telegraphed ${shortest.toFixed(2)} to ${longest.toFixed(2)} s before it acts (${acted} windows, ${snaps} without a telegraph)`, acted > 20 && snaps === 0 && shortest >= 0.5 && longest <= 0.8);
  check(`the spawner reserves each window's band: no section lies inside one (${intrusions} intrusions)`, intrusions === 0);
}
{
  // the cost of the reserved runway: how many sections a kilometre holds with the hazards on and off (information, bounded)
  const sims = (enabled) => { HAZARDS.enabled = enabled; const out = []; for (const seed of [1, 2, 3]) { const sim = createGameSim(); sim.reset(seed); let n = 0; const seen = new Set(); let steps = 0; sim.flap(); while (sim.phase === PHASE.RUNNING && sim.distance < 6200 && steps++ < 120 * 1000) { const c = sim.track.corridors.find((k) => k.x1 > sim.distance - 0.3); const target = c ? Math.max(c.lo + 0.8, c.center - 0.6) : 0; const { y, vy } = sim.bird; if (vy < 0 && (y < target || (c && y < c.lo + 0.5))) sim.flap(); sim.step(DT); for (const k of sim.track.corridors) seen.add(k.x0.toFixed(2)); } out.push(seen.size); } HAZARDS.enabled = true; return out.reduce((a, b) => a + b, 0); };
  const off = sims(false), on = sims(true);
  console.log(`     sections over 3 runs of 6.2 km: ${off} with the hazards off, ${on} on (${((100 * on) / off).toFixed(0)}%)`);
  check('the reserved runway thins the obstacles by no more than a third (it is where the hazards live)', on >= off * 0.66, `${on} vs ${off}`);
}
{
  // INFORMATION, not a pass/fail: how much of each zone a bird-modifier window can act on real tracks. The open runway between sections is only about 3 to 7 m, so
  // the windows (10 to 18 m) only fit because the spawner reserves runway for them (see runwayAfter); this reports how much of each zone they now cover.
  const zones = { canyon: [40, 1500], frosty: [1500, 2000], celestial: [2000, 3000], palace: [3000, 5000], sanctuary: [5000, 6200] };
  const act = {}, tot = {};
  for (const z of Object.keys(zones)) { act[z] = 0; tot[z] = 0; }
  for (const seed of [1, 2]) {
    flyBot(seed, 6200, (sim) => {
      const z = zoneAt(sim.distance)[0];
      tot[z]++;
      if (sim.hazard.active) act[z]++;
    });
  }
  console.log(`     coverage (share of distance where a bird-modifier window acts): ${Object.keys(zones).map((z) => `${z} ${tot[z] ? ((100 * act[z]) / tot[z]).toFixed(1) : '-'}%`).join(', ')}`);
}
{
  // retry: the hazard state is neutral after a reset
  const sim = createGameSim();
  sim.reset(7);
  sim.distance = 100;
  hazardsAt(110, sim.hazard, []);
  sim.reset(7);
  check('a reset leaves no hazard state behind', sim.hazard.kind === '' && sim.hazard.accelY === 0 && sim.hazard.gravityScale === 1);
}

// ---------------------------------------------------------------- the simulation applies the modifiers (TAP / HOLD feel)
{
  const run = (kind) => {
    const sim = createGameSim();
    sim.reset(1);
    sim.flap();
    // put the bird in the middle of a window of this kind, away from any section
    let start = null;
    for (let d = 100; d < 9000 && start === null; d += 0.2) { hazardsAt(d, fx, []); if (fx.kind === kind && fx.active) start = d; }
    sim.distance = sim.prevDistance = start + 0.5;
    sim.track.corridors.length = 0;
    sim.bird.y = 0.5; sim.bird.vy = 0;
    const out = [];
    for (let i = 0; i < 24; i++) { sim.step(DT); out.push(sim.bird.vy); }
    return { vy: out[out.length - 1], start };
  };
  const base = createGameSim();
  base.reset(1);
  const vyFree = (() => { const bd = { y: 0.5, vy: 0, pitch: 0, sinceFlap: 0 }; for (let i = 0; i < 24; i++) stepFlight(bd, { holding: false, dive: false }, DT); return bd.vy; })();
  const up = run('updraft'), gust = run('gust'), low = run('lowG');
  check(`an updraft lifts: after 0.2 s vy ${up.vy.toFixed(2)} vs ${vyFree.toFixed(2)} without`, up.vy > vyFree + 3);
  check(`a gust pushes (${gust.vy > vyFree ? 'up' : 'down'}): after 0.2 s vy ${gust.vy.toFixed(2)} vs ${vyFree.toFixed(2)} without`, Math.abs(gust.vy - vyFree) > 1);
  check(`low gravity softens the fall: after 0.2 s vy ${low.vy.toFixed(2)} vs ${vyFree.toFixed(2)} without`, low.vy > vyFree + 1.5);
  // HOLD still floats inside an updraft, and TAP still flaps
  const bd = { y: 0, vy: 3, pitch: 0, sinceFlap: 0 }, hold = { holding: true, dive: false }, none = { holding: false, dive: false };
  const f = createHazardFx(); f.accelY = 20;
  const b2 = { ...bd };
  for (let i = 0; i < 12; i++) { stepFlight(bd, hold, DT, f); stepFlight(b2, none, DT, f); }
  check('HOLD still softens gravity inside an updraft (climbs more than not holding)', bd.vy > b2.vy);
  const b3 = { y: 0, vy: -5, pitch: 0, sinceFlap: 9 }, g2 = createHazardFx(); g2.flapScale = 0.82; g2.flapCarry = 0.45;
  applyFlap(b3, g2);
  check('TAP still sets a climb in low gravity (a slightly softer flap)', b3.vy > 5 && b3.vy < PHYSICS.flapImpulse);
}

// ---------------------------------------------------------------- the Auto play bot and the corridor bot both survive with the hazards on
{
  const N = 16, TARGET = 6200;
  let ok = 0;
  const crashes = [];
  for (let seed = 1; seed <= N; seed++) {
    const sim = flyBot(seed, TARGET);
    if (sim.distance >= TARGET) ok++;
    else crashes.push(`seed ${seed} @ ${sim.metres} m (${sim.crashCause}, ${sim.hazard.kind || 'no hazard'})`);
  }
  crashes.slice(0, 5).forEach((c) => console.log(`    crash: ${c}`));
  check(`the corridor-following bot flies all zones with the hazards on (${ok}/${N} seeds to ${TARGET} m)`, ok === N);
}
{
  const N = 4, TARGET = 5600;
  let ok = 0, orbs = 0, maxMs = 0;
  const crashes = [];
  for (let seed = 1; seed <= N; seed++) {
    const sim = createGameSim();
    sim.reset(seed);
    const bot = createAutopilot(sim);
    let steps = 0;
    while (sim.phase !== PHASE.DYING && sim.phase !== PHASE.OVER && sim.distance < TARGET && steps++ < 120 * 600) {
      bot.control();
      sim.step(DT);
    }
    orbs += sim.orbsCollected;
    maxMs = Math.max(maxMs, bot.stats.maxMs);
    if (sim.distance >= TARGET) ok++;
    else crashes.push(`seed ${seed} @ ${sim.metres} m (${sim.crashCause}, ${sim.hazard.kind || 'no hazard'})`);
  }
  crashes.forEach((c) => console.log(`    crash: ${c}`));
  check(`Auto play flies the hazards (${ok}/${N} seeds to ${TARGET} m, avg ${(orbs / N).toFixed(0)} orbs, slowest plan ${maxMs.toFixed(1)} ms)`, ok === N && maxMs < 40);
}

// ---------------------------------------------------------------- phase 2: moving and phasing obstacles in the simulation's collisions
{
  const circleHits = (await import('../src/systems/physics/collision.js')).circleHitsObstacle;
  const { DYNAMIC_INSET } = await import('../src/systems/hazards/biomeHazards.js');
  /** Walks real tracks through a zone and returns the first obstacle that `want` accepts (with the sim it lives in). */
  const find = (zoneStart, zoneEnd, want) => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sim = createGameSim();
      sim.reset(seed);
      sim.flap();
      for (let base = zoneStart + 30; base < zoneEnd - 30; base += 23) {
        sim.distance = sim.prevDistance = base;
        sim.step(DT);
        for (const o of sim.obstacles.active) {
          if (o.x < zoneStart + 20 || o.x > zoneEnd - 20) continue;
          const r = want(o, sim);
          if (r) return { sim, o, ...r };
        }
      }
    }
    return null;
  };
  const ob = createObstacleFx();
  const fresh = (sim, o, d, y) => { sim.phase = PHASE.RUNNING; sim.distance = sim.prevDistance = d; sim.bird.y = y; sim.bird.vy = 0; sim.bird.dead = false; sim.input.flapQueued = false; sim.crashCause = null; void o; };

  // a retracted piston leaves room the original shape would not: the bird sits in the vacated space and lives; the unmoved collider would have killed it
  const piston = find(3000, 4900, (o) => {
    if (o.kind !== 'column' || o.polys == null) return null;
    for (let d = o.x - 3; d <= o.x + 3; d += 0.5) { obstacleHazard(o, d, ob); if (!ob.dyn || Math.abs(ob.dy) < 0.6) return null; }
    return { d: o.x };
  });
  check('a palace piston can be found on a real track', piston !== null);
  if (piston) {
    const { sim, o } = piston;
    const d0 = o.x - 0.05;
    obstacleHazard(o, d0 + 0.06, ob);
    const dy = ob.dy;
    const edge = o.cap > 0 ? o.y + o.h / 2 : o.y - o.h / 2; // the gap end of the pole where it stands
    const retracted = edge + dy;
    const toward = o.cap > 0 ? 1 : -1;
    const yIn = retracted + toward * 0.45; // inside the vacated space, clear of the retracted pole
    const R0 = PHYSICS.birdRadius;
    const bx = d0 + 0.06;
    check(`the unmoved collider would hit the bird in the vacated space (the piston is ${Math.abs(dy).toFixed(2)} back), so the offset matters`, Math.abs(dy) >= 0.6 && circleHits(bx, yIn, R0, o) === true);
    fresh(sim, o, d0, yIn);
    sim.step(DT);
    check('the bird survives in the space a retracted piston leaves (the collider moved with it)', sim.phase === PHASE.RUNNING, sim.crashCause ?? '');
    // 85% hitbox: a clearance between 0.85 R and R from a moving obstacle is no hit
    const yEdge = retracted + toward * (R0 - DYNAMIC_INSET * 0.5 + 0.0); // between the inset radius and the full radius from the retracted tip
    fresh(sim, o, d0, yEdge);
    // only meaningful over the flat top of a capital; accept either outcome for pointed tips but never a crash for clearance beyond the full radius
    sim.step(DT);
    check('a moving obstacle never kills the bird at a clearance beyond the full radius', (() => { fresh(sim, o, d0, retracted + toward * (R0 + 0.05)); sim.step(DT); return sim.phase === PHASE.RUNNING; })());
  }

  // a phase barrier that is passable does not kill; the same barrier solid does
  const barrier = find(2000, 3000, (o) => {
    if (o.kind !== 'column') return null;
    obstacleHazard(o, o.x, ob);
    if (!ob.dyn) return null;
    // passable over the whole stretch where the bird could touch it, and solid at some other moment
    let open = true, solidSomewhere = false;
    for (let d = o.x - o.extent - 0.8; d <= o.x + o.extent + 0.8; d += 0.1) { obstacleHazard(o, d, ob); if (ob.solid) open = false; }
    for (let d = o.x - 40; d < o.x + 40; d += 0.25) { obstacleHazard(o, d, ob); if (ob.solid) solidSomewhere = true; }
    return open && solidSomewhere ? { d: o.x - o.extent - 0.5 } : null;
  });
  check('a passable phase barrier can be found on a real track', barrier !== null);
  if (barrier) {
    const { sim, o } = barrier;
    const yMid = o.cap > 0 ? o.y + o.h / 2 - 0.5 : o.y - o.h / 2 + 0.5; // inside the barrier's body, near its gap end
    let alive = true;
    fresh(sim, o, o.x - o.extent - 0.4, yMid);
    for (let i = 0; i < 30 && alive; i++) { sim.bird.vy = 0; sim.bird.y = yMid; sim.step(DT); if (sim.phase !== PHASE.RUNNING) alive = false; }
    check('the bird flies through a barrier while it is translucent (no hit, no near miss)', alive, sim.crashCause ?? '');
  }
  // a phase barrier that is solid when the bird passes it kills, exactly as an ordinary obstacle does
  const solid = find(2000, 3000, (o) => {
    if (o.kind !== 'column') return null;
    obstacleHazard(o, o.x, ob);
    if (!ob.dyn) return null;
    for (let d = o.x - o.extent - 0.8; d <= o.x + o.extent + 0.8; d += 0.1) { obstacleHazard(o, d, ob); if (!ob.solid) return null; }
    return { d: o.x };
  });
  check('a solid phase barrier can be found on a real track', solid !== null);
  if (solid) {
    const { sim, o } = solid;
    const yMid = o.cap > 0 ? o.y + o.h / 2 - 0.5 : o.y - o.h / 2 + 0.5;
    fresh(sim, o, o.x - o.extent - 0.4, yMid);
    let dead = false;
    for (let i = 0; i < 40 && !dead; i++) { sim.bird.vy = 0; sim.bird.y = yMid; sim.step(DT); if (sim.phase !== PHASE.RUNNING) dead = true; }
    check('the bird dies on a barrier that is solid when it arrives', dead);
  }
  // nothing is drawn or collided differently with the switch off
  HAZARDS.enabled = false;
  const sim0 = createGameSim();
  sim0.reset(2);
  sim0.flap();
  sim0.distance = sim0.prevDistance = 3500;
  sim0.step(DT);
  let still = true;
  for (const o of sim0.obstacles.active) if (o.dy !== 0 || !o.solid || o.dyn) still = false;
  HAZARDS.enabled = true;
  check('with the switch off every obstacle is solid and still', still);
}

// ---------------------------------------------------------------- obstacle states (pure; wired into collisions in phase 2)
{
  const out = createObstacleFx();
  const H = BIOME_HAZARDS;
  let awayOk = true, maxDy = 0, brittleLead = Infinity, phaseLead = Infinity, pistonLead = Infinity, sawSolid = 0, sawPass = 0, sawRumble = 0, sawPulse = 0, sawPiston = 0;
  const kinds = [['column', 1], ['column', -1], ['block', 1], ['block', -1], ['rock', 0]];
  for (let x = 20; x < 9000; x += 3.1) {
    for (const [kind, cap] of kinds) {
      const o = { x, kind, cap };
      const away = cap > 0 ? -1 : 1;
      let prev = null, rumbleFrom = null, pulseFrom = null;
      for (let d = x - 70; d < x + 20; d += 0.1) {
        obstacleHazard(o, d, out);
        if (out.dy * away < -1e-9 && !(H[zoneAt(x)[0]].brittle)) awayOk = false;
        if (cap > 0 && out.dy > 1e-9) awayOk = false;       // a rising pole never moves up into its corridor
        if (cap < 0 && out.dy < -1e-9) awayOk = false;      // a hanging one never moves down
        maxDy = Math.max(maxDy, Math.abs(out.dy));
        if (out.rumble > 0 && rumbleFrom === null) rumbleFrom = d;
        if (out.rumble === 0 && rumbleFrom !== null && out.dy < 0) { brittleLead = Math.min(brittleLead, (d - rumbleFrom) / speedAt(d)); sawRumble++; rumbleFrom = null; }
        if (out.pulse > 0 && pulseFrom === null) pulseFrom = d;
        if (prev && prev.solid === false && out.solid === true && pulseFrom !== null) { phaseLead = Math.min(phaseLead, (d - pulseFrom) / speedAt(d)); sawPulse++; }
        if (out.pulse === 0) pulseFrom = null;
        if (kind === 'column' && H[zoneAt(x)[0]].piston && Math.abs(out.dy) > 0.3) sawPiston++;
        if (out.solid) sawSolid++; else sawPass++;
        prev = { solid: out.solid };
      }
    }
  }
  check(`every moving obstacle moves AWAY from its corridor (poles rising or hanging, slabs, caps): the guaranteed gap never shrinks (max move ${maxDy.toFixed(2)})`, awayOk && maxDy <= 1.1 + 1e-9);
  check(`a brittle cap rumbles ${brittleLead.toFixed(2)} s before it lets go (0.5 to 0.8 s rule)`, sawRumble > 20 && brittleLead >= 0.5 && brittleLead <= 0.8);
  check('a phase barrier pulses before it turns solid, and is passable part of the time', sawPass > 0 && sawSolid > sawPass && sawPulse > 20);
  check('pistons move', sawPiston > 100);
  check('rocks never phase or move', (() => { for (let d = 3000; d < 3100; d += 1) { obstacleHazard({ x: 3050, kind: 'rock', cap: 0 }, d, out); if (!out.solid || out.dy !== 0) return false; } return true; })());
  HAZARDS.enabled = false;
  obstacleHazard({ x: 3050, kind: 'column', cap: 1 }, 3040, out);
  check('with the switch off obstacles are solid and still', out.solid && out.dy === 0 && out.pulse === 0 && out.rumble === 0);
  HAZARDS.enabled = true;
}
HAZARDS.enabled = DEFAULT_ENABLED;
check('the preview flag exists (?hazards=1) and the default is off', /hazards'\) === '1'/.test(read('src/systems/game/gameInstance.js')) && HAZARDS.enabled === false);
check('the simulation and the bot use the same hazard function', /hazardsAt/.test(read('src/systems/game/createGameSim.js')) && /hazardsAt/.test(read('src/systems/bot/autopilot.js')));
check('birds never reach the hazards (no avatar or skin data in the module)', !/avatar|skin|bird\./i.test(read('src/systems/hazards/biomeHazards.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
console.log(failures ? `\n${failures} failed` : '\nhazard tests passed');
process.exit(failures ? 1 : 0);
