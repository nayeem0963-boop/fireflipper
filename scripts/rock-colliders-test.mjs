// Zone rock colliders (canyon hoodoos, fins, arches, ledges; Frosty Polar spires, blades, icicles...): polygon collision, fairness against the guaranteed corridors, unchanged tracks, gating. Run with: npm run test:colliders
import { createHash } from 'node:crypto';
import { PHASE, createGameSim } from '../src/systems/game/createGameSim.js';
import { circleGap, circleHitsObstacle, circleIntersectsBox, circleIntersectsPoly, circlePolyGap } from '../src/systems/physics/collision.js';
import { WORLD, PHYSICS } from '../src/systems/physics/constants.js';
import { KITS, KIT_STARTS, ROCK_SHAPES, archPolys, columnPolys, controlPoints, hash01, ledgePolys, pickLook, polysExtent, rockKit } from '../src/systems/obstacles/rockShapes.js';
import { BIOMES } from '../src/systems/world/biomes.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  } else console.log(`  ok   ${name}${detail ? ` (${detail})` : ''}`);
};
const DEFAULT_ENABLED = ROCK_SHAPES.enabled;
ROCK_SHAPES.enabled = true;
const R = PHYSICS.birdRadius;
const DT = 1 / 120;

// ---------------------------------------------------------------- polygon collision
{
  // an axis-aligned rectangle as a polygon behaves exactly like the old box collider
  let mismatch = 0, gapMismatch = 0, n = 0;
  let seed = 5;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 4000; i++) {
    const hw = 0.3 + rnd() * 1.5, hh = 0.3 + rnd() * 2;
    const bx = rnd() * 4 - 2, by = rnd() * 4 - 2;
    const cx = rnd() * 8 - 4, cy = rnd() * 8 - 4, r = 0.1 + rnd() * 0.6;
    const poly = [bx - hw, by - hh, bx + hw, by - hh, bx + hw, by + hh, bx - hw, by + hh];
    const box = { shape: 'box', x: bx, y: by, hw, hh };
    const pol = { shape: 'poly', polys: [poly] };
    n++;
    if (circleIntersectsBox(cx, cy, r, bx, by, hw, hh) !== circleIntersectsPoly(cx, cy, r, poly)) mismatch++;
    if (!circleHitsObstacle(cx, cy, r, box) && Math.abs(circleGap(cx, cy, r, box) - circleGap(cx, cy, r, pol)) > 1e-9) gapMismatch++;
  }
  check(`a rectangle polygon hits exactly when the box does (${n} random circles)`, mismatch === 0, String(mismatch));
  check('and reports the same clearance when clear (near-miss scoring is unchanged)', gapMismatch === 0, String(gapMismatch));
  const tri = [0, 0, 2, 0, 2, 2, 0, 2];
  check('a circle touching an edge from outside does not hit; just inside does', !circleIntersectsPoly(2.5, 1, 0.5, tri) && circleIntersectsPoly(2.49, 1, 0.5, tri));
  check('a circle round a corner is measured to the corner', Math.abs(circlePolyGap(3, 3, 0.2, tri) - (Math.SQRT2 - 0.2)) < 1e-9);
  check('a circle centre inside reports a negative clearance', circlePolyGap(1, 1, 0.3, tri) < 0);
  const t0 = performance.now();
  const hoodoo = { shape: 'poly', polys: columnPolys('canyon', 'hoodoo', 100, 0, 1, 1.5, -4.7, 0) };
  let hits = 0;
  for (let i = 0; i < 400000; i++) if (circleHitsObstacle(100 + (i % 50) * 0.04, -2 + (i % 7) * 0.3, R, hoodoo)) hits++;
  const ms = performance.now() - t0;
  check(`collision cost: 400k hoodoo tests in ${ms.toFixed(0)} ms (${hoodoo.polys.length} quads each)`, ms < 600, `${hits} hits`);
}

// ---------------------------------------------------------------- shapes, for every kit
const isConvexCcw = (p) => {
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, k = (i + 2) % 4;
    const cross = (p[2 * j] - p[2 * i]) * (p[2 * k + 1] - p[2 * j + 1]) - (p[2 * j + 1] - p[2 * i + 1]) * (p[2 * k] - p[2 * j]);
    if (cross < -1e-9) return false;
  }
  return p.every(Number.isFinite);
};
const area = (p) => {
  let a = 0;
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; a += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1]; }
  return a / 2;
};
for (const kit of Object.keys(KITS)) {
  let bad = 0, count = 0, intrude = 0, looksSeen = new Set();
  for (let x = 3; x < 400; x += 1.37) {
    for (const cap of [1, -1]) {
      for (const w of [1.2, 1.5, 1.8]) {
        const look = pickLook(kit, 'column', cap, x);
        looksSeen.add(`${cap > 0 ? 'rising' : 'hanging'}:${look}`);
        const gapEnd = cap > 0 ? 1.1 : 0.4;
        const yB = cap > 0 ? WORLD.groundY - 1.5 : gapEnd;
        const yT = cap > 0 ? gapEnd : WORLD.obstacleTopY;
        const polys = columnPolys(kit, look, x, gapEnd, cap, w, yB, yT);
        for (const p of polys) {
          count++;
          if (!isConvexCcw(p) || area(p) <= 0) bad++;
          for (let i = 0; i < 8; i += 2) {
            // nothing crosses the gap edge into the corridor, nothing leaves the pole's own span
            if (cap > 0 ? p[i + 1] > gapEnd + 1e-9 : p[i + 1] < gapEnd - 1e-9) intrude++;
            if (p[i + 1] < yB - 1e-9 || p[i + 1] > yT + 1e-9) intrude++;
          }
        }
        if (polysExtent(polys, x) > 0.65 * w + 1e-9) intrude++;
      }
    }
  }
  check(`${kit}: pole polygons are valid convex counter-clockwise quads (${count} checked)`, bad === 0, String(bad));
  check(`${kit}: no pole reaches past its gap end into the corridor, or outside its own span`, intrude === 0, String(intrude));
  const expectLooks = [...KITS[kit].rising.map((l) => `rising:${l}`), ...KITS[kit].hanging.map((l) => `hanging:${l}`)];
  check(`${kit}: every look in its rising and hanging lists is used (${expectLooks.join(', ')})`, expectLooks.every((l) => looksSeen.has(l)), [...looksSeen].join());
  const { rise, drop } = KITS[kit].passage;
  let archOk = true, ledgeOk = true, strips = 0;
  for (const L of [7, 9.3, 12]) {
    const a = archPolys(kit, 50, 50 + L, 1.0, WORLD.obstacleTopY);
    const l = ledgePolys(kit, 50, 50 + L, WORLD.groundY - 1.5, -0.8);
    strips += a.length + l.length;
    for (const p of a) for (let i = 0; i < 8; i += 2) if (p[i + 1] < 1.0 - 1e-9) archOk = false;
    for (const p of l) for (let i = 0; i < 8; i += 2) if (p[i + 1] > -0.8 + 1e-9) ledgeOk = false;
    // the spans meet the original gap height at both ends and never rise or drop more than the stated amounts
    archOk &&= Math.min(...a.flatMap((p) => [p[1], p[3]])) === 1.0 && Math.max(...a.flatMap((p) => [p[1], p[3]])) <= 1.0 + rise + 1e-9;
    ledgeOk &&= Math.max(...l.flatMap((p) => [p[5], p[7]])) === -0.8 && Math.min(...l.flatMap((p) => [p[5], p[7]])) >= -0.8 - drop - 1e-9;
    ledgeOk &&= [l[0], ...l].every((p) => isConvexCcw(p));
    archOk &&= a.every(isConvexCcw);
  }
  check(`${kit}: arch spans only add room (underside from the gap height up to +${rise}), strips are convex`, archOk);
  check(`${kit}: ledges only add room (top from the gap height down to -${drop}), strips are convex`, ledgeOk, `${strips} strips`);
  const pts = controlPoints(kit, KITS[kit].rising[0], 6);
  check(`${kit}: outlines are sampled up to the requested depth exactly`, Math.abs(pts[pts.length - 1][0] - 6) < 1e-9 && pts.every((p, i) => i === 0 || p[0] > pts[i - 1][0]));
}
{
  // the pinch is real: beside a hoodoo's neck there is room the old box did not leave
  const h = { shape: 'poly', polys: columnPolys('canyon', 'hoodoo', 100, 1, 1, 1.5, -4.7, 1) };
  const neckY = 1 - 2.6; // well below the cap
  check('canyon: beside a hoodoo neck the bird fits where the old 0.4w box would have killed it', !circleHitsObstacle(100 + 0.9, neckY, R, h) && circleHitsObstacle(100 + 0.6, neckY, R, h));
  check('canyon: under the cap the overhang is solid', circleHitsObstacle(100 + 0.8, 1 - 0.2, R, h) || circleHitsObstacle(100 + 0.8, 1 - 0.3, R, h));
  const tipFin = { shape: 'poly', polys: columnPolys('canyon', 'fin', 100, 1, 1, 1.5, -4.7, 1) };
  check('canyon: a fin is narrow at its tip and wide at its foot', polysExtent(tipFin.polys, 100) > 0.45 * 1.5 && !circleHitsObstacle(100 + 1.3, 0.6, R, tipFin) && circleHitsObstacle(100 + 0.2, 0.9, R, tipFin));
  const spire = { shape: 'poly', polys: columnPolys('frosty', 'spire', 100, 1, 1, 1.5, -4.7, 1) };
  check('frosty: a spire is pointed at its crown and wide at its trunk', !circleHitsObstacle(100 + 0.8, 0.8, R, spire) && circleHitsObstacle(100 + 0.2, 0.0, R, spire));
  const icicle = { shape: 'poly', polys: columnPolys('frosty', 'icicle', 100, -1, -1, 1.5, -1, WORLD.obstacleTopY) };
  check('frosty: a hanging icicle is a spike pointing down: the tip at the gap edge, much wider above', !circleHitsObstacle(100 + 0.7, -0.9, R, icicle) && circleHitsObstacle(100 + 0.3, 1.6, R, icicle));
}

// ---------------------------------------------------------------- real tracks: corridors stay clear, layouts unchanged, gating
function flyTrack(seed, upto, visit) {
  const sim = createGameSim();
  sim.reset(seed);
  sim.flap();
  let steps = 0;
  while (sim.phase === PHASE.RUNNING && sim.distance < upto && steps++ < 120 * 600) {
    const c = sim.track.corridors.find((k) => k.x1 > sim.distance - 0.3);
    const target = c ? Math.max(c.lo + 0.8, c.center - 0.6) : 0;
    const { y, vy } = sim.bird;
    if (vy < 0 && (y < target || (c && y < c.lo + 0.5))) sim.flap();
    sim.step(DT);
    visit(sim, steps);
  }
  return sim;
}
{
  // 1. corridors: sample every guaranteed corridor of the canyon's tracks; no polygon covers any sampled point
  let covered = 0, sampled = 0, seenLooks = new Set(), poles = 0;
  const inside = (p, x, y) => {
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      if ((p[2 * j] - p[2 * i]) * (y - p[2 * i + 1]) - (p[2 * j + 1] - p[2 * i + 1]) * (x - p[2 * i]) < 0) return false;
    }
    return true;
  };
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const checked = new Set();
    flyTrack(seed, 4200, (sim, steps) => {
      if (steps % 30) return;
      for (const o of sim.obstacles.active) {
        if (!o.polys || checked.has(o)) continue;
        checked.add(o);
        poles++;
        seenLooks.add(`${o.kit}:${o.look}`);
        for (const c of sim.track.corridors) {
          if (o.x + o.extent < c.x0 || o.x - o.extent > c.x1) continue;
          for (let x = c.x0 + 0.05; x < c.x1; x += 0.2) for (let y = c.lo + 0.02; y < Math.min(c.hi, WORLD.ceilingY + 1) - 0.01; y += 0.2) {
            sampled++;
            for (const p of o.polys) if (inside(p, x, y)) { covered++; break; }
          }
        }
      }
    });
  }
  check(`no shaped obstacle covers any point of a guaranteed corridor (${poles} obstacles, ${sampled} points on 8 tracks, canyon to Rose Sky Palace)`, covered === 0, String(covered));
  const want = [];
  for (const kit of Object.keys(KITS)) for (const l of [...new Set([...KITS[kit].rising, ...KITS[kit].hanging]), 'arch', 'ledge']) want.push(`${kit}:${l}`);
  check(`every look of every kit occurs on the generated tracks (${want.length})`, want.every((l) => seenLooks.has(l)), want.filter((l) => !seenLooks.has(l)).join());
}
{
  // 2. layouts unchanged: a fingerprint of every generated obstacle and orb (kind, position, size, cap, spin) for 8 seeds out to 3000 m, recorded before the shapes were added
  const GOLDEN = ['7482155bbc42ca1e:966', 'ae86d796d42c9d34:1028', '1c85b5c5a9774a2e:1037', '4c880bf96b1b906b:1015', '67d500f2d340b846:1069', '810ad0f6b7a5203b:1000', 'aacc18790eb082a5:1052', 'a6fce5762cd71148:1029'];
  let same = true;
  const got = [];
  for (let seed = 1; seed <= 8; seed++) {
    const seen = new Set();
    const sim = flyTrack(seed, 3000, (s, steps) => {
      if (steps % 6) return;
      for (const o of s.obstacles.active) seen.add(o.kind === 'rock' ? `rock|${o.x.toFixed(4)}|${o.y.toFixed(4)}|${o.r.toFixed(4)}|${o.rot.toFixed(4)}` : `${o.kind}|${o.x.toFixed(4)}|${o.y.toFixed(4)}|${o.w.toFixed(4)}|${o.h.toFixed(4)}|${o.cap}|${o.rot.toFixed(4)}`);
      for (const orb of s.orbs.active) seen.add(`orb|${orb.x.toFixed(4)}|${orb.y.toFixed(4)}`);
    });
    const fp = `${createHash('sha1').update([...seen].sort().join('\n')).digest('hex').slice(0, 16)}:${seen.size}`;
    got.push(fp);
    if (fp !== GOLDEN[seed - 1] || sim.distance < 3000) same = false;
  }
  check('every generated track is identical to the one before the shapes (8 seeds, 3000 m, all obstacles and orbs)', same, same ? '' : got.join(' '));
}
{
  // 3. gating: shapes only inside a shaped zone, and the boundaries are the scenery zones' starts; unshaped zones keep their original colliders
  const ZONE_OF = { canyon: 'canyon', frosty: 'arctic', celestial: 'celestial', palace: 'palace', sanctuary: 'sanctuary' };
  check('each kit begins where its scenery zone begins', KIT_STARTS.every(([kit, start]) => BIOMES[ZONE_OF[kit]].start === start));
  let shaped = 0, plain = 0, shapedBad = 0, plainBad = 0;
  flyTrack(3, 5300, (sim) => {
    for (const o of sim.obstacles.active) {
      const kit = rockKit(o.x);
      if (kit) {
        shaped++;
        const expect = o.kit === kit && (o.kind === 'rock' ? o.look === 'boulder' && o.shape === 'circle' : o.shape === 'poly' && !!o.look && o.polys.length > 0);
        if (!expect) shapedBad++;
      } else {
        plain++;
        if (o.kit || o.look || o.polys || (o.kind === 'rock' ? o.shape !== 'circle' : o.shape !== 'box')) plainBad++;
      }
    }
  });
  check(`in the shaped zones every obstacle has a shape and a collider to match (${shaped} seen)`, shapedBad === 0 && shaped > 0, String(shapedBad));
  check(`in the other zones every obstacle keeps its original box or circle (${plain} seen)`, plainBad === 0 && plain > 0, String(plainBad));
  check('the look depends only on position (no random numbers drawn)', pickLook('canyon', 'column', 1, 321.5) === pickLook('canyon', 'column', 1, 321.5) && hash01(10) === hash01(10));
}
{
  // 4. the existing bot and corridor guarantee still hold on shaped tracks: a corridor-following bird survives the whole canyon on many seeds
  let ok = 0;
  const N = 24;
  for (let seed = 1; seed <= N; seed++) if (flyTrack(seed, 3400, () => {}).distance >= 3400) ok++;
  check(`the corridor-following bot flies the shaped zones (canyon to Rose Sky Palace) on ${ok}/${N} seeds`, ok === N);
}
ROCK_SHAPES.enabled = DEFAULT_ENABLED;
check('the shapes are on by default for every kit built so far (ROCK_SHAPES.enabled / .kits turn them off, bringing back the original obstacles)', DEFAULT_ENABLED === true && Object.entries(ROCK_SHAPES.kits).every(([k, on]) => on === !!KITS[k]));
console.log(failures ? `\n${failures} failed` : '\nrock collider tests passed');
process.exit(failures ? 1 : 0);
