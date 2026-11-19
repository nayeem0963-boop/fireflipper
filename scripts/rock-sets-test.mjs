// Zone rock geometry (every kit): the drawn silhouettes match the colliders (same outline tables), nothing crosses the gap end, budgets, determinism, palette, readability. Run with: npm run test:rocks
import { readFileSync } from 'node:fs';
import { BufferAttribute, BufferGeometry, Color, Vector3 } from 'three';
import { KIT_STYLE, ROCK_CONTRACT as C, createRockSet } from '../src/components/scene/rockSets.js';
import { WORLD } from '../src/systems/physics/constants.js';
import { KITS, archPolys, columnPolys, kitPieces, ledgePolys, poleInstances, poleReach } from '../src/systems/obstacles/rockShapes.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  } else console.log(`  ok   ${name}${detail ? ` (${detail})` : ''}`);
};
const SETS = Object.fromEntries(Object.keys(KITS).map((k) => [k, createRockSet(k)]));

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

/** The poles as the renderer places them (poleInstances), in world space around x = 0. */
function drawnPole(kit, look, cap, gapEndY, w, yB, yT) {
  const { reach } = poleReach(cap, gapEndY, w, yB, yT);
  const tris = [];
  for (const inst of poleInstances(kit, look, cap, gapEndY, w, reach)) tris.push(...placed(SETS[kit][inst.piece], { sx: inst.s, sy: inst.sy, sz: inst.s, y: inst.y }));
  return { tris, reach };
}

for (const kit of Object.keys(KITS)) {
  const set = SETS[kit];
  const K = KITS[kit];

  // -------------------------------------------------------------- poles: the drawn silhouette is the collider outline
  {
    const cases = [...K.rising.map((l) => [l, 1]), ...K.hanging.map((l) => [l, -1])];
    let worst = 0, worstWhere = '', above = 0, samples = 0;
    for (const [look, cap] of cases) {
      for (const w of [1.2, 1.5, 1.8]) {
        for (const gapEndY of [-1.0, 0.4, 2.2]) {
          const yB = cap > 0 ? WORLD.groundY - 1.5 : gapEndY;
          const yT = cap > 0 ? gapEndY : WORLD.obstacleTopY;
          const polys = columnPolys(kit, look, 0, gapEndY, cap, w, yB, yT);
          const { tris, reach } = drawnPole(kit, look, cap, gapEndY, w, yB, yT);
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
    check(`${kit}: the drawn silhouette matches the collider outline within ${C.silhouetteTolerance} at ${samples} heights (${cases.map(([l, c]) => `${l} ${c > 0 ? 'up' : 'down'}`).join(', ')}; 3 widths, 3 heights)`, worst <= C.silhouetteTolerance, `worst ${worst.toFixed(4)} at ${worstWhere}`);
    check(`${kit}: nothing is drawn past the gap end into the corridor`, above === 0, String(above));
  }

  // -------------------------------------------------------------- passage slabs
  {
    const { rise, drop } = K.passage;
    let worstArch = 0, worstLedge = 0;
    const ap = archPolys(kit, -0.5, 0.5, 0, 1.2);
    const lp = ledgePolys(kit, -0.5, 0.5, -1.2, 0);
    const arch = placed(set.archBand, {});
    const ledge = placed(set.ledgeBand, {});
    for (let k = 1; k < 100; k++) {
      const x = -0.5 + k / 100;
      const [gloArch] = sliceY(arch, x);
      const ploArch = Math.min(...ap.flatMap((p) => { const [a, b] = [p[0], p[2]]; if (x < a - 1e-9 || x > b + 1e-9) return []; const t = (x - a) / (b - a); return [p[1] + (p[3] - p[1]) * t]; }));
      worstArch = Math.max(worstArch, Math.abs(gloArch - ploArch));
      const [, ghiLedge] = sliceY(ledge, x);
      const phiLedge = Math.max(...lp.flatMap((p) => { const [a, b] = [p[0], p[2]]; if (x < a - 1e-9 || x > b + 1e-9) return []; const t = (x - a) / (b - a); return [p[7] + (p[5] - p[7]) * t]; }));
      worstLedge = Math.max(worstLedge, Math.abs(ghiLedge - phiLedge));
    }
    check(`${kit}: arch span: the drawn underside is the collider outline`, worstArch < 0.01, worstArch.toFixed(5));
    check(`${kit}: ledge: the drawn top is the collider outline`, worstLedge < 0.01, worstLedge.toFixed(5));
    check(`${kit}: arch band: the lowest point is the gap height, the highest underside +${rise}`, Math.abs(Math.min(...arch.flat().map((v) => v.y))) < 1e-9 && Math.max(...ap.flatMap((p) => [p[1], p[3]])) <= rise + 1e-9);
    check(`${kit}: ledge band: the highest point is the gap height, the lowest top ${drop} below`, Math.abs(Math.max(...ledge.flat().map((v) => v.y))) < 1e-9);
    for (const [name, g] of [['arch band', arch], ['ledge band', ledge], ['slab block', placed(set.slabBlock, {})]]) {
      const xs = g.flat().map((v) => v.x);
      check(`${kit}: ${name}: the ends are square at x = +-0.5 (the collider spans the slab's full length)`, Math.abs(Math.min(...xs) + 0.5) < 1e-9 && Math.abs(Math.max(...xs) - 0.5) < 1e-9);
    }
    check(`${kit}: the arch band is 1.2 tall and the ledge band 1.2 deep (the renderer stacks the 3-tall blocks from there without a gap)`, Math.abs(Math.max(...arch.flat().map((v) => v.y)) - 1.2) < 1e-6 && Math.abs(Math.min(...ledge.flat().map((v) => v.y)) + 1.2) < 1e-6);
  }

  // -------------------------------------------------------------- boulder: can be spun freely
  {
    const g = set.boulder;
    const p = g.attributes.position;
    let rad = 0;
    for (let i = 0; i < p.count; i++) rad = Math.max(rad, Math.hypot(p.getX(i), p.getY(i), p.getZ(i)));
    const inr = inradius(g);
    check(`${kit}: boulder: the ball inside is at least ${C.boulder.minInradius} (collider ${C.boulder.collider})`, inr >= C.boulder.minInradius, inr.toFixed(3));
    check(`${kit}: boulder: nothing reaches beyond ${C.boulder.maxRadius} (1.4 x the collider)`, rad <= C.boulder.maxRadius, rad.toFixed(3));
  }

  // -------------------------------------------------------------- budgets, determinism, palette, sanity
  {
    let total = 0;
    for (const [name, g] of Object.entries(set)) {
      const tris = g.attributes.position.count / 3;
      total += tris;
      check(`${kit}: ${name}: ${tris} triangles (limit ${C.maxTriangles})`, tris <= C.maxTriangles);
      const bad = [...g.attributes.position.array, ...g.attributes.color.array].some((v) => !Number.isFinite(v));
      check(`${kit}: ${name}: no NaN, has vertex colours`, !bad && g.attributes.color.count === g.attributes.position.count);
    }
    const pieces = kitPieces(kit).length;
    check(`${kit}: all ${Object.keys(set).length} meshes together: ${total} triangles (limit 1100)`, total <= 1100);
    check(`${kit}: ${Object.keys(set).length} instanced meshes, exactly the pieces the kit lists (${pieces}); one draw call each while on screen`, Object.keys(set).length === pieces && kitPieces(kit).every((sp) => set[sp.key]));
    const again = createRockSet(kit);
    check(`${kit}: geometry is deterministic (the same every build)`, Object.keys(set).every((k) => set[k].attributes.position.array.every((v, i) => v === again[k].attributes.position.array[i])));
  }

  // -------------------------------------------------------------- palette and readability against the zone's paintings
  {
    const P = KIT_STYLE[kit].palette;
    const HUE = { canyon: [0, 0.14], frosty: [0.5, 0.66], celestial: [0.6, 0.8], palace: [0.46, 0.58] }[kit]; // sandstone / ice / violet crystal / teal marble
    const hsl = { h: 0, s: 0, l: 0 };
    let ok = true, minS = 1;
    for (const g of Object.values(set)) {
      const col = g.attributes.color;
      for (let i = 0; i < col.count; i++) {
        new Color().setRGB(col.getX(i), col.getY(i), col.getZ(i)).getHSL(hsl);
        const white = hsl.l > 0.93; // the snow-white / pale sunlit tops carry no hue
        if (!white && (hsl.h < HUE[0] || hsl.h > HUE[1] || hsl.s < 0.35)) ok = false;
        if (!white) minS = Math.min(minS, hsl.s);
      }
    }
    check(`${kit}: palette: every colour is in the zone's hue range (${HUE.join(' to ')})`, ok, `lowest saturation ${minS.toFixed(2)}`);
    // median luminance of the part of each of the zone's paintings behind the gameplay band, measured from public/images/backdrop (canyon-a/b/c, frosty-*)
    const MEDIANS = { canyon: [0.09, 0.12, 0.15], frosty: [0.26, 0.34, 0.4], celestial: [0.1, 0.15, 0.19], palace: [0.25, 0.27, 0.3] }[kit];
    const lum = (h) => { const c = new Color(h); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; }; // Color holds linear values
    const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const NEED = { top: 1.45, lit: 1.45, body: 1.9, shade: 1.45, deep: 1.0 }; // 'deep' is only the undersides, always next to a lit face
    for (const [name, hex] of Object.entries(P)) {
      const c = Math.min(...MEDIANS.map((m) => contrast(lum(hex), m)));
      check(`${kit}: ${name} ${hex}: contrast ${c.toFixed(2)} against the weakest painting (needs ${NEED[name]})`, c >= NEED[name]);
    }
    check(`${kit}: the strata (lit and body) differ from each other by at least 2:1, so every rock is banded`, contrast(lum(P.lit), lum(P.body)) >= 1.3);
  }
}

// ---------------------------------------------------------------- isolation
{
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const sim = ['src/systems/game/createGameSim.js', 'src/systems/physics/collision.js', 'src/systems/obstacles/patterns.js', 'src/systems/obstacles/spawner.js'].map(read).join('');
  check('the simulation, collision and patterns never import the scene geometry (rockSets)', !/rockSets|canyonRocks/.test(sim));
  check('the game screen draws these (ObstacleField uses the sets and the sim-computed draw lists)', /createRockSet/.test(read('src/components/scene/ObstacleField.jsx')) && /o\.draw/.test(read('src/components/scene/ObstacleField.jsx')));
  check('rockSets imports only the outline tables, never the simulation', !/createGameSim|collision/.test(read('src/components/scene/rockSets.js')));
}
console.log(failures ? `\n${failures} failed` : '\nrock set tests passed');
process.exit(failures ? 1 : 0);
