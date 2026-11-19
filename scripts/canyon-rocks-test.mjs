// Canyon rock obstacle geometry: the fairness contract (visual vs collider), budgets, determinism and palette. Run with: npm run test:rocks
import { readFileSync } from 'node:fs';
import { Color, Vector3 } from 'three';
import { ROCK_COLORS, ROCK_CONTRACT as C, createArchLintel, createBoulder, createCanyonRockSet, createHoodooCap, createHoodooShaft, createPassageSlab, createRockFin } from '../src/components/scene/canyonRocks.js';
import { PHYSICS } from '../src/systems/physics/constants.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  } else console.log(`  ok   ${name}${detail ? ` (${detail})` : ''}`);
};

/** [minX, maxX] of the geometry's cross-section at height y (edges crossing the plane, vertices on it). */
function sliceX(g, y) {
  const p = g.attributes.position;
  let lo = Infinity;
  let hi = -Infinity;
  const pt = (i) => new Vector3(p.getX(i), p.getY(i), p.getZ(i));
  for (let i = 0; i < p.count; i += 3) {
    const v = [pt(i), pt(i + 1), pt(i + 2)];
    for (let e = 0; e < 3; e++) {
      const a = v[e];
      const b = v[(e + 1) % 3];
      if ((a.y - y) * (b.y - y) > 0) continue;
      const t = a.y === b.y ? 0 : (y - a.y) / (b.y - a.y);
      const x = a.x + (b.x - a.x) * t;
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
  }
  return [lo, hi];
}
const box = (g) => {
  g.computeBoundingBox();
  return g.boundingBox;
};
/** Radius of the largest ball (centred on the origin) that fits inside: the smallest distance to any face plane. */
function inradius(g) {
  const p = g.attributes.position;
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  let min = Infinity;
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    if (n.lengthSq() < 1e-14) continue;
    min = Math.min(min, Math.abs(n.normalize().dot(a)));
  }
  return min;
}
const maxRadius = (g) => {
  const p = g.attributes.position;
  let m = 0;
  for (let i = 0; i < p.count; i++) m = Math.max(m, Math.hypot(p.getX(i), p.getY(i), p.getZ(i)));
  return m;
};

// ---- shafts and caps: never narrower than the hitbox at any height, never far wider, flat gap end
function shaftContract(name, g, yMin, yMax) {
  let worstMin = Infinity, worstMax = 0;
  const N = 60;
  for (let k = 0; k <= N; k++) {
    const y = yMin + 1e-4 + ((yMax - yMin - 2e-4) * k) / N;
    const [lo, hi] = sliceX(g, y);
    worstMin = Math.min(worstMin, -lo, hi); // the narrower side
    worstMax = Math.max(worstMax, -lo, hi);
  }
  check(`${name}: at every height both sides reach at least ${C.minSupport} (hitbox ${C.colliderHalf})`, worstMin >= C.minSupport, worstMin.toFixed(3));
  check(`${name}: no side reaches beyond ${C.maxSupport}`, worstMax <= C.maxSupport, worstMax.toFixed(3));
  const bb = box(g);
  check(`${name}: the gap end is a flat plane, nothing rises above it`, Math.abs(bb.max.y - yMax) < 1e-6, bb.max.y.toFixed(4));
  const p = g.attributes.position;
  let flat = true;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > yMax - 1e-6 && Math.abs(p.getY(i) - yMax) > 1e-6) flat = false;
  check(`${name}: every top vertex lies exactly on the gap-end plane`, flat);
  // world sizes over the real widths (gates 1.2 to 1.6, columns 1.3 to 1.8)
  for (const w of [1.2, 1.8]) {
    check(`${name}: at width ${w} the visual is wider than the collider by ${((worstMin - C.colliderHalf) * w).toFixed(2)} to ${((worstMax - C.colliderHalf) * w).toFixed(2)} units (bird radius ${PHYSICS.birdRadius})`, (worstMin - C.colliderHalf) * w > 0.02 && (worstMax - C.colliderHalf) * w < 0.3);
  }
}
const shaft = createHoodooShaft();
const cap = createHoodooCap();
shaftContract('hoodoo shaft', shaft, -0.5, 0.5);
shaftContract('hoodoo cap', cap, -0.3, 0);
shaftContract('rock fin', createRockFin(), -0.5, 0.5);
shaftContract('arch lintel', createArchLintel(), -0.5, 0.5);

// ---- slab: covers the whole collider width, flat gap face
{
  const g = createPassageSlab();
  let worst = Infinity, widest = 0;
  for (let k = 0; k <= 40; k++) {
    const [lo, hi] = sliceX(g, -0.5 + 1e-4 + (k / 40) * (1 - 2e-4));
    worst = Math.min(worst, -lo, hi);
    widest = Math.max(widest, -lo, hi);
  }
  check(`passage slab: spans at least 0.5 each side at every height (collider is 0.5 - 0.05 / length)`, worst >= C.slabHalf - 1e-9, worst.toFixed(4));
  check('passage slab: ends stay square, never past 0.5', widest <= C.slabHalf + 1e-9, widest.toFixed(4));
  const p = g.attributes.position;
  let flat = true;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.5 - 1e-6 && Math.abs(p.getY(i) - 0.5) > 1e-6) flat = false;
  check('passage slab: the gap face is exactly flat, at the collider edge', flat && Math.abs(box(g).max.y - 0.5) < 1e-6);
}

// ---- boulder: can be spun freely
{
  const g = createBoulder();
  const inr = inradius(g);
  const rad = maxRadius(g);
  check(`boulder: the ball inside is at least ${C.boulder.minInradius} (collider ${C.boulder.collider})`, inr >= C.boulder.minInradius, inr.toFixed(3));
  check(`boulder: nothing reaches beyond ${C.boulder.maxRadius} (1.4 x the collider)`, rad <= C.boulder.maxRadius, rad.toFixed(3));
  check('boulder: visual / collider ratio is between 1.0 and 1.4', inr / C.boulder.collider >= 1.0 && rad / C.boulder.collider <= 1.4, `${(inr / C.boulder.collider).toFixed(2)} to ${(rad / C.boulder.collider).toFixed(2)}`);
}

// ---- budgets, determinism, palette, sanity
const set = createCanyonRockSet();
let total = 0;
for (const [name, g] of Object.entries(set)) {
  const tris = g.attributes.position.count / 3;
  total += tris;
  check(`${name}: ${tris} triangles (limit ${C.maxTriangles})`, tris <= C.maxTriangles);
  const bad = [...g.attributes.position.array, ...g.attributes.color.array].some((v) => !Number.isFinite(v));
  check(`${name}: no NaN, has vertex colours`, !bad && g.attributes.color.count === g.attributes.position.count);
}
check(`all six geometries together: ${total} triangles (limit 1000)`, total <= 1000);
const again = createCanyonRockSet();
check('geometry is deterministic (the same every build)', Object.keys(set).every((k) => set[k].attributes.position.array.every((v, i) => v === again[k].attributes.position.array[i])));
{
  // every colour is warm sandstone: hue between red and yellow, clearly saturated
  const hsl = { h: 0, s: 0, l: 0 };
  let ok = true, minS = 1;
  for (const g of Object.values(set)) {
    const col = g.attributes.color;
    for (let i = 0; i < col.count; i++) {
      new Color().setRGB(col.getX(i), col.getY(i), col.getZ(i)).getHSL(hsl);
      if (hsl.h < 0.0 || hsl.h > 0.14 || hsl.s < 0.35) ok = false;
      minS = Math.min(minS, hsl.s);
    }
  }
  check('palette: every colour is red / orange / yellow sandstone', ok, `lowest saturation ${minS.toFixed(2)}`);
  check('palette constants are the canyon\'s sunset colours', Object.values(ROCK_COLORS).every((h) => /^#[0-9a-f]{6}$/i.test(h)));
}

// ---- isolation: this is scenery only (not imported by the simulation) and not yet wired into the renderer in this phase
{
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const sim = ['src/systems/game/createGameSim.js', 'src/systems/physics/collision.js', 'src/systems/obstacles/patterns.js', 'src/systems/obstacles/spawner.js'].map(read).join('');
  check('the simulation, collision and patterns never import canyonRocks', !/canyonRocks/.test(sim));
}
console.log(failures ? `\n${failures} failed` : '\ncanyon rock tests passed');
process.exit(failures ? 1 : 0);
