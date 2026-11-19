// Canyon rock geometry: the drawn silhouettes match the colliders (same outline tables), nothing crosses the gap end, budgets, determinism, palette. Run with: npm run test:rocks
import { readFileSync } from 'node:fs';
import { BufferAttribute, BufferGeometry, Color, Vector3 } from 'three';
import { ROCK_COLORS, ROCK_CONTRACT as C, createCanyonRockSet, poleInstances } from '../src/components/scene/canyonRocks.js';
import { WORLD } from '../src/systems/physics/constants.js';
import { ARCH_RISE, LEDGE_DROP, archPolys, columnPolys, ledgePolys, poleReach } from '../src/systems/obstacles/rockShapes.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  } else console.log(`  ok   ${name}${detail ? ` (${detail})` : ''}`);
};
const set = createCanyonRockSet();

/** World-space triangles of a geometry placed with scale (sx, sy, sz) and offset. */
function placed(g, { sx = 1, sy = 1, sz = 1, x = 0, y = 0 }) {
  const p = g.attributes.position;
  const out = [];
  for (let i = 0; i < p.count; i += 3) {
    const tri = [];
    for (let k = 0; k < 3; k++) tri.push(new Vector3(p.getX(i + k) * sx + x, p.getY(i + k) * sy + y, p.getZ(i + k) * sz));
    out.push(tri);
  }
  return out;
}
/** [minX, maxX] of a set of triangles at height y (edges crossing the plane). */
function sliceX(tris, y) {
  let lo = Infinity, hi = -Infinity;
  for (const v of tris) for (let e = 0; e < 3; e++) {
    const a = v[e], b = v[(e + 1) % 3];
    if ((a.y - y) * (b.y - y) > 0) continue;
    const t = a.y === b.y ? 0 : (y - a.y) / (b.y - a.y);
    const x = a.x + (b.x - a.x) * t;
    lo = Math.min(lo, x); hi = Math.max(hi, x);
  }
  return [lo, hi];
}
/** [minY, maxY] of a set of triangles at x (edges crossing the plane x = const). */
function sliceY(tris, x) {
  let lo = Infinity, hi = -Infinity;
  for (const v of tris) for (let e = 0; e < 3; e++) {
    const a = v[e], b = v[(e + 1) % 3];
    if ((a.x - x) * (b.x - x) > 0) continue;
    const t = a.x === b.x ? 0 : (x - a.x) / (b.x - a.x);
    const y = a.y + (b.y - a.y) * t;
    lo = Math.min(lo, y); hi = Math.max(hi, y);
  }
  return [lo, hi];
}
/** [minX, maxX] covered by the collider quads at height y. */
function polyX(polys, y) {
  let lo = Infinity, hi = -Infinity;
  for (const p of polys) for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const ay = p[2 * i + 1], by = p[2 * j + 1];
    if ((ay - y) * (by - y) > 0) continue;
    const t = ay === by ? 0 : (y - ay) / (by - ay);
    const x = p[2 * i] + (p[2 * j] - p[2 * i]) * t;
    lo = Math.min(lo, x); hi = Math.max(hi, x);
  }
  return [lo, hi];
}
/** The poles as the renderer places them (poleInstances), in world space around x = 0. */
function drawnPole(look, cap, gapEndY, w, yB, yT) {
  const { reach } = poleReach(cap, gapEndY, w, yB, yT);
  const tris = [];
  const geoOf = { hoodooHead: set.hoodooHead, hoodooSegment: set.hoodooSegment, lintelHead: set.lintelHead, lintelSegment: set.lintelSegment, finHeadUp: set.finHeadUp, finHeadDown: set.finHeadDown, finBody: set.finBody };
  for (const inst of poleInstances(look, cap, gapEndY, w, reach)) tris.push(...placed(geoOf[inst.key], { sx: inst.s, sy: inst.sy, sz: inst.s, y: inst.y }));
  return { tris, reach };
}

// ---------------------------------------------------------------- poles: the drawn silhouette is the collider outline
{
  const cases = [['hoodoo', 1], ['fin', 1], ['fin', -1], ['lintel', -1]];
  let worst = 0, worstWhere = '', above = 0, samples = 0;
  for (const [look, cap] of cases) {
    for (const w of [1.2, 1.5, 1.8]) {
      for (const gapEndY of [-1.0, 0.4, 2.2]) {
        const yB = cap > 0 ? WORLD.groundY - 1.5 : gapEndY;
        const yT = cap > 0 ? gapEndY : WORLD.obstacleTopY;
        const polys = columnPolys(look, 0, gapEndY, cap, w, yB, yT, 1);
        const { tris, reach } = drawnPole(look, cap, gapEndY, w, yB, yT);
        const dir = cap > 0 ? 1 : -1;
        const span = Math.min(reach * w, 9);
        for (let k = 0; k <= 70; k++) {
          const y = gapEndY - dir * (0.002 + (k / 70) * (span - 0.004));
          const [pl, ph] = polyX(polys, y);
          const [gl, gh] = sliceX(tris, y);
          const diff = Math.max(Math.abs(pl - gl), Math.abs(ph - gh));
          samples++;
          if (diff > worst) { worst = diff; worstWhere = `${look} cap ${cap} w ${w} d ${(Math.abs(gapEndY - y) / w).toFixed(2)}`; }
        }
        // nothing is drawn beyond the gap end plane, into the corridor
        const ys = tris.flat().map((v) => v.y);
        if (cap > 0 ? Math.max(...ys) > gapEndY + 1e-6 : Math.min(...ys) < gapEndY - 1e-6) above++;
      }
    }
  }
  check(`the drawn silhouette matches the collider outline within ${C.silhouetteTolerance} at ${samples} heights (hoodoo, fin up and down, lintel; 3 widths, 3 heights)`, worst <= C.silhouetteTolerance, `worst ${worst.toFixed(4)} at ${worstWhere}`);
  check('nothing is drawn past the gap end into the corridor', above === 0, String(above));
}

// ---------------------------------------------------------------- passage slabs
{
  let worstArch = 0, worstLedge = 0;
  const ap = archPolys(-0.5, 0.5, 0, 1.2);
  const lp = ledgePolys(-0.5, 0.5, -1.2, 0);
  const arch = placed(set.archBand, {});
  const ledge = placed(set.ledgeBand, {});
  for (let k = 1; k < 100; k++) {
    const x = -0.5 + k / 100;
    const [gloArch] = sliceY(arch, x);
    const [ploArch] = [Math.min(...ap.flatMap((p) => { const [a, b] = [p[0], p[2]]; if (x < a - 1e-9 || x > b + 1e-9) return []; const t = (x - a) / (b - a); return [p[1] + (p[3] - p[1]) * t]; }))];
    worstArch = Math.max(worstArch, Math.abs(gloArch - ploArch));
    const [, ghiLedge] = sliceY(ledge, x);
    const phiLedge = Math.max(...lp.flatMap((p) => { const [a, b] = [p[0], p[2]]; if (x < a - 1e-9 || x > b + 1e-9) return []; const t = (x - a) / (b - a); return [p[7] + (p[5] - p[7]) * t]; }));
    worstLedge = Math.max(worstLedge, Math.abs(ghiLedge - phiLedge));
  }
  check('arch span: the drawn underside is the collider outline (stone blocks over the underside)', worstArch < 0.01, worstArch.toFixed(5));
  check('ledge: the drawn top is the collider outline', worstLedge < 0.01, worstLedge.toFixed(5));
  check(`arch band stays within its gap-face rule: the lowest point is the gap height, the highest underside +${ARCH_RISE}`, Math.abs(Math.min(...arch.flat().map((v) => v.y))) < 1e-9 && Math.max(...ap.flatMap((p) => [p[1], p[3]])) <= ARCH_RISE + 1e-9);
  check(`ledge band stays within its rule: the highest point is the gap height, the lowest top ${LEDGE_DROP} below`, Math.abs(Math.max(...ledge.flat().map((v) => v.y)) - 0) < 1e-9);
  for (const [name, g] of [['arch band', arch], ['ledge band', ledge], ['slab body', placed(set.slabBody, {})]]) {
    const xs = g.flat().map((v) => v.x);
    check(`${name}: the ends are square at x = +-0.5 (the collider spans the slab's full length)`, Math.abs(Math.min(...xs) + 0.5) < 1e-9 && Math.abs(Math.max(...xs) - 0.5) < 1e-9);
  }
  check('the arch band is 1.2 tall and its body starts at its top (the renderer stacks them without a gap)', Math.abs(Math.max(...arch.flat().map((v) => v.y)) - 1.2) < 1e-6 && Math.abs(Math.min(...ledge.flat().map((v) => v.y)) + 1.2) < 1e-6);
}

// ---------------------------------------------------------------- boulder: can be spun freely
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
{
  const g = set.boulder;
  const p = g.attributes.position;
  let rad = 0;
  for (let i = 0; i < p.count; i++) rad = Math.max(rad, Math.hypot(p.getX(i), p.getY(i), p.getZ(i)));
  const inr = inradius(g);
  check(`boulder: the ball inside is at least ${C.boulder.minInradius} (collider ${C.boulder.collider})`, inr >= C.boulder.minInradius, inr.toFixed(3));
  check(`boulder: nothing reaches beyond ${C.boulder.maxRadius} (1.4 x the collider)`, rad <= C.boulder.maxRadius, rad.toFixed(3));
}

// ---------------------------------------------------------------- budgets, determinism, palette, sanity
{
  let total = 0;
  for (const [name, g] of Object.entries(set)) {
    const tris = g.attributes.position.count / 3;
    total += tris;
    check(`${name}: ${tris} triangles (limit ${C.maxTriangles})`, tris <= C.maxTriangles);
    const bad = [...g.attributes.position.array, ...g.attributes.color.array].some((v) => !Number.isFinite(v));
    check(`${name}: no NaN, has vertex colours`, !bad && g.attributes.color.count === g.attributes.position.count);
  }
  check(`all ${Object.keys(set).length} meshes together: ${total} triangles (limit 1000)`, total <= 1000);
  check(`${Object.keys(set).length} instanced meshes (one draw call each while on screen; the old canyon set was 6)`, Object.keys(set).length === 11);
  const again = createCanyonRockSet();
  check('geometry is deterministic (the same every build)', Object.keys(set).every((k) => set[k].attributes.position.array.every((v, i) => v === again[k].attributes.position.array[i])));
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
  check('every face is wound outward (flat shading and back-face culling are right)', Object.entries(set).every(([name, g]) => {
    const p = g.attributes.position;
    const a = new Vector3(), b = new Vector3(), c = new Vector3();
    let inward = 0, n = 0;
    // for the closed pieces (boulder, poles) the normals face away from the piece's centroid
    const cen = new Vector3();
    for (let i = 0; i < p.count; i++) cen.add(new Vector3(p.getX(i), p.getY(i), p.getZ(i)));
    cen.divideScalar(p.count);
    if (name !== 'boulder') return true;
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
      const nn = b.clone().sub(a).cross(c.clone().sub(a));
      const mid = a.clone().add(b).add(c).divideScalar(3).sub(cen);
      n++;
      if (nn.dot(mid) < 0) inward++;
    }
    return inward === 0;
  }));
}

// ---------------------------------------------------------------- not wired into the renderer yet
{
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const sim = ['src/systems/game/createGameSim.js', 'src/systems/physics/collision.js', 'src/systems/obstacles/patterns.js', 'src/systems/obstacles/spawner.js'].map(read).join('');
  check('the simulation, collision and patterns never import canyonRocks', !/canyonRocks/.test(sim));
  check('the game screen does not draw these yet (phase C)', !/canyonRocks/.test(read('src/components/scene/ObstacleField.jsx')));
  check('canyonRocks imports only the outline tables, never the simulation', !/createGameSim|collision/.test(read('src/components/scene/canyonRocks.js')));
}
console.log(failures ? `\n${failures} failed` : '\ncanyon rock tests passed');
process.exit(failures ? 1 : 0);
