import { BufferAttribute, BufferGeometry, Color, IcosahedronGeometry, Vector3 } from 'three';
import { ARCH_RISE, FIN_FOOT, LEDGE_DROP, POLE_TABLES, archRise, finLean, ledgeDrop, slabSamples } from '../../systems/obstacles/rockShapes.js';

/**
 * Procedural sandstone geometry for the Red Rock Canyon obstacles: hoodoos, rock fins, arch lintels, arch spans, ledges and boulders, in the faceted, banded style of the owner's
 * reference paintings. Pure geometry (vertex colours, flat faces), no model files; ObstacleField places the instances.
 *
 * Every outline is built from the SAME tables the simulation's colliders use (systems/obstacles/rockShapes.js): a pole's rings sit exactly on the outline's control points, with
 * vertices on the left and right extremes, so the silhouette across the track IS the collider's polygon outline. A pole is drawn in widths `w` (unit width, the gap end at y = 0, the
 * stem running away from the corridor: down for a rising pole, up for a hanging one); passage slabs are one unit long, stretched to the slab's length. scripts/canyon-rocks-test.mjs compares
 * the assembled silhouettes with the real colliders.
 *
 * Pieces (one InstancedMesh each): hoodooHead, hoodooSegment, lintelHead, lintelSegment, finHeadUp, finHeadDown, finBody, archBand, ledgeBand, slabBlock, boulder.
 */
export const ROCK_CONTRACT = Object.freeze({
  /** Boulders: the largest ball inside is at least this (the collider circle is 0.86) and nothing reaches beyond maxRadius (1.4 x the collider). */
  boulder: Object.freeze({ collider: 0.86, minInradius: 0.9, maxRadius: 1.2 }),
  maxTriangles: 400,
  /** How far the drawn silhouette may differ from the collider outline (world units at the poles' widest): the faceting jitter stays off the extremes, so this is small. */
  silhouetteTolerance: 0.05,
});

/**
 * The canyon's colours, from the paintings: sunlit yellow-orange strata, orange sandstone, red shade, pale sunlit tops. The shade colours are kept light enough to read against the
 * paintings (their median luminance is 0.09 to 0.15, measured; see PAINTING_MEDIAN_LUMINANCE in scripts/canyon-rocks-test.mjs).
 */
export const ROCK_COLORS = Object.freeze({
  lit: '#f6b44e',
  body: '#ee8434',
  red: '#e2632f',
  deep: '#b84a2c',
  top: '#ffe0a8',
});

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const c3 = new Color();
const A = new Vector3();
const B = new Vector3();
const C = new Vector3();
const N = new Vector3();

/**
 * Builds a non-indexed geometry from triangles. `outward(mid)` gives the direction the surface faces near that point (so winding is fixed up automatically, whatever order the
 * triangle was written in); `colorOf(mid, normal, tri index)` colours each face.
 */
function fromTriangles(tris, outward, colorOf) {
  const pos = new Float32Array(tris.length * 9);
  const col = new Float32Array(tris.length * 9);
  tris.forEach((t, i) => {
    let [p, q, r] = t;
    A.fromArray(p);
    B.fromArray(q);
    C.fromArray(r);
    const mid = A.clone().add(B).add(C).divideScalar(3);
    N.copy(B).sub(A).cross(C.clone().sub(A));
    if (N.dot(outward(mid, t)) < 0) {
      [q, r] = [r, q];
      N.negate();
    }
    N.normalize();
    c3.set(colorOf(mid, N.clone(), i, t));
    [p, q, r].forEach((v, k) => {
      pos.set(v, i * 9 + k * 3);
      col.set([c3.r, c3.g, c3.b], i * 9 + k * 3);
    });
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

const hex = (h, k = 1) => c3.set(h).multiplyScalar(k).getHex();

/**
 * A pole piece from outline control points [d, left, right] (widths from the gap end), as stacked rings: y = -dir * d. The ring vertices at 0 and 180 degrees sit exactly on the
 * outline (no jitter), the others are jittered a little for the faceted look. `gapCap` closes the gap end with a flat face; `farCap` the other end.
 */
function pole({ points, dir, sides, depth, seed, gapCap = false, farCap = false, color }) {
  const rnd = rng(seed);
  const ring = points.map(([d, l, r]) => {
    const rx = (l + r) / 2;
    const cx = (r - l) / 2;
    return Array.from({ length: sides }, (_, i) => {
      const th = (2 * Math.PI * i) / sides;
      const j = i === 0 || i === sides / 2 ? 1 : 1 + (rnd() * 2 - 1) * 0.03;
      return [cx + rx * Math.cos(th) * j, -dir * d, depth(rx) * Math.sin(th) * j];
    });
  });
  const tris = [];
  const rows = points.length - 1;
  for (let k = 0; k < rows; k++) {
    for (let i = 0; i < sides; i++) {
      const i2 = (i + 1) % sides;
      tris.push({ t: [ring[k][i], ring[k + 1][i2], ring[k][i2]], row: k, col: i }, { t: [ring[k][i], ring[k + 1][i], ring[k + 1][i2]], row: k, col: i });
    }
  }
  const cap = (k, up) => {
    const centre = [(ring[k][0][0] + ring[k][sides / 2][0]) / 2, ring[k][0][1], 0];
    for (let i = 0; i < sides; i++) tris.push({ t: [centre, ring[k][i], ring[k][(i + 1) % sides]], row: up ? 0 : rows - 1, col: i, cap: up });
  };
  if (gapCap) cap(0, true);
  if (farCap) cap(rows, false);
  // outward: the side faces face away from the axis (the middle of their ring pair); the gap-end cap faces the corridor (+y for a rising pole), the far cap the other way
  const axisX = (y) => {
    let best = ring[0];
    for (const rg of ring) if (Math.abs(rg[0][1] - y) < Math.abs(best[0][1] - y)) best = rg;
    return (best[0][0] + best[sides / 2][0]) / 2;
  };
  const meta = new Map();
  const list = tris.map((o, i) => {
    meta.set(i, o);
    return o.t;
  });
  return fromTriangles(
    list,
    (mid, t) => {
      const o = tris[list.indexOf(t)];
      if (o.cap === true) return new Vector3(0, dir, 0);
      if (o.cap === false) return new Vector3(0, -dir, 0);
      return new Vector3(mid.x - axisX(mid.y), 0, mid.z);
    },
    (mid, n, i) => color(mid, n, meta.get(i), dir),
  );
}

/** Sandstone strata for poles: bands alternate by facet row, the face toward the corridor is pale sunlit rock, the face turned away is deep shade. */
function strata(seed, { slant = 0 } = {}) {
  const rnd = rng(seed * 7919);
  const jitter = Array.from({ length: 256 }, () => 0.94 + rnd() * 0.12);
  return (mid, n, m, dir) => {
    const facing = n.y * dir; // > 0: turned towards the gap end
    if (facing > 0.9) return hex(ROCK_COLORS.top);
    const band = Math.floor(m.row + (m.col / 8) * slant);
    const even = (((band % 2) + 2) % 2) === 0;
    let h = even ? ROCK_COLORS.body : ROCK_COLORS.lit;
    if (facing < -0.5) h = ROCK_COLORS.deep;
    else if (n.x < -0.35 && Math.abs(n.y) < 0.4) h = even ? ROCK_COLORS.red : ROCK_COLORS.body;
    return hex(h, jitter[(m.row * 17 + m.col * 5) % 256]);
  };
}

const tailPoints = (tail) => tail.offsets.map(([o, hw]) => [o, hw, hw]);
const finPoints = () => POLE_TABLES.fin.map(([d, hw, c]) => [d, hw - c * finLean(0), hw + c * finLean(0)]);

/** Hoodoo head: the flat-topped caprock (flat face at the gap end) down into the neck, d 0 to 0.58. A rising pole only. */
export const createHoodooHead = () => pole({ points: POLE_TABLES.hoodoo.head, dir: 1, sides: 8, depth: (rx) => rx * 1.05, seed: 11, gapCap: true, color: strata(11) });
/** One period of the hoodoo's waisted stem (1.8 widths long); placed again and again down the pole. */
export const createHoodooSegment = () => pole({ points: tailPoints(POLE_TABLES.hoodoo.tail), dir: 1, sides: 8, depth: (rx) => rx * 1.05, seed: 12, color: strata(12) });
/** Lintel head: the flared, flat underside of a hanging keystone (hangs from above: the gap end is the bottom), d 0 to 0.64. */
export const createLintelHead = () => pole({ points: POLE_TABLES.lintel.head, dir: -1, sides: 8, depth: (rx) => rx * 1.25, seed: 21, gapCap: true, color: strata(21) });
/** One period of the lintel's stepped masonry (1.4 widths). */
export const createLintelSegment = () => pole({ points: tailPoints(POLE_TABLES.lintel.tail), dir: -1, sides: 8, depth: (rx) => rx * 1.25, seed: 22, color: strata(22) });
/** Rock fin blade: a pointed tip leaning forward, widening to the foot (d 0 to 3.6). `dir` 1 rises from the ground (tip up), -1 hangs (tip down). */
export const createFinHead = (dir) => pole({ points: finPoints(), dir, sides: 6, depth: (rx) => 0.3 + rx * 0.45, seed: dir > 0 ? 31 : 32, gapCap: true, color: strata(dir > 0 ? 31 : 32, { slant: 3 }) });
/** The fin's straight foot: a prism 1 wide and 1 long, stretched to the rest of the pole (its width never changes, so stretching keeps the outline exact). Centred on y = 0. */
export const createFinBody = () => {
  const g = pole({ points: [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5]], dir: 1, sides: 6, depth: (rx) => 0.3 + rx * 0.45, seed: 33, color: strata(33, { slant: 3 }) });
  return g;
};

/**
 * Faceted front and back for the passage slabs. Each strip is cut into `rows` rows, and the interior vertices are pushed in or out in depth (z) only, so the
 * silhouette across the track (x and y) is exact: the corners, the ends and the gap-face edge never move.
 */
function slabFaces({ xs, bottom, top, z = 0.5, seed, rows = 1, topCap, faceColor, jitter = 0.16 }) {
  const rnd = rng(seed);
  const n = xs.length - 1;
  const quads = [];
  for (const side of [1, -1]) {
    const grid = xs.map((x, i) => Array.from({ length: rows + 1 }, (_, j) => {
      const interior = i > 0 && i < n && j > 0 && j < rows;
      return [x, bottom[i] + ((top[i] - bottom[i]) * j) / rows, side * (z + (interior ? (rnd() - 0.4) * jitter : 0))];
    }));
    for (let i = 0; i < n; i++) for (let j = 0; j < rows; j++) quads.push({ q: [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]], i, j, rows, kind: side > 0 ? 'front' : 'back' });
  }
  for (let i = 0; i < n; i++) {
    quads.push({ q: [[xs[i], bottom[i], z], [xs[i + 1], bottom[i + 1], z], [xs[i + 1], bottom[i + 1], -z], [xs[i], bottom[i], -z]], i, j: 0, rows, kind: 'under' });
    if (topCap) quads.push({ q: [[xs[i], top[i], z], [xs[i + 1], top[i + 1], z], [xs[i + 1], top[i + 1], -z], [xs[i], top[i], -z]], i, j: rows, rows, kind: 'top' });
  }
  for (const [x, k] of [[xs[0], 0], [xs[n], n]]) quads.push({ q: [[x, bottom[k], -z], [x, bottom[k], z], [x, top[k], z], [x, top[k], -z]], i: k, j: 0, rows, kind: 'end' });
  const tris = [];
  const info = [];
  for (const o of quads) {
    const [a, b, c, d] = o.q;
    tris.push([a, b, c], [a, c, d]);
    info.push(o, o);
  }
  const centre = new Vector3(0, (Math.min(...bottom) + Math.max(...top)) / 2, 0);
  return fromTriangles(tris, (mid) => mid.clone().sub(centre), (mid, nrm, i) => faceColor(mid, nrm, info[i]));
}

/** A stratum: the lower half of a block one colour, the upper half the other (two layers of sandstone per block). */
const layerColor = (seed) => {
  const rnd = rng(seed);
  const j = Array.from({ length: 64 }, () => 0.94 + rnd() * 0.12);
  return (mid, n, o) => {
    if (n.y > 0.9) return hex(ROCK_COLORS.top);
    if (n.y < -0.5) return hex(ROCK_COLORS.deep);
    const upper = o.j >= o.rows / 2;
    let h = upper ? ROCK_COLORS.lit : ROCK_COLORS.body;
    if (n.x < -0.35 && Math.abs(n.y) < 0.4) h = upper ? ROCK_COLORS.body : ROCK_COLORS.red;
    return hex(h, j[(o.i * 5 + o.j * 11) % 64]);
  };
};

const stoneColor = (seed) => {
  const rnd = rng(seed);
  const j = Array.from({ length: 64 }, () => 0.94 + rnd() * 0.12);
  return (mid, n, o) => {
    if (n.y > 0.9) return hex(ROCK_COLORS.top);
    if (n.y < -0.5) return hex(ROCK_COLORS.deep);
    return hex(o.i % 2 === 0 ? ROCK_COLORS.body : ROCK_COLORS.lit, j[(o.i * 7 + (o.kind === 'front' ? 1 : 2)) % 64]);
  };
};

/** The band of an arch span at its gap face: stone blocks (alternating colour) over an underside that rises from the gap height at both ends (archRise). 1 unit long, 1.2 tall, y = 0 at the gap height. */
export function createArchBand() {
  const us = slabSamples();
  const xs = us.map((u) => -0.5 + u);
  return slabFaces({ xs, bottom: us.map((u) => archRise(u)), top: us.map(() => 1.2), seed: 41, rows: 2, faceColor: stoneColor(41) });
}
/** The band of a ledge at its gap face: the top drops at both ends (ledgeDrop). 1 unit long, 1.2 tall, y = 0 at the gap height, the band running down from there. */
export function createLedgeBand() {
  const us = slabSamples();
  const xs = us.map((u) => -0.5 + u);
  return slabFaces({ xs, bottom: us.map(() => -1.2), top: us.map((u) => -ledgeDrop(u)), seed: 42, rows: 2, topCap: true, faceColor: stoneColor(42) });
}
/** One block of a slab's body: 3 tall (two 1.5-thick layers of sandstone), 1 long (stretched to the slab's length), y from -1.5 to 1.5. The body is a stack of these. */
export function createSlabBlock() {
  return slabFaces({ xs: [-0.5, -0.25, 0, 0.25, 0.5], bottom: Array(5).fill(-1.5), top: Array(5).fill(1.5), seed: 43, rows: 4, topCap: true, faceColor: layerColor(43), jitter: 0.2 });
}

/** A boulder: a faceted lump (an icosphere with each vertex pushed in or out), always at least 0.9 thick in every direction and never beyond 1.2, so it can be spun freely. */
export function createBoulder(seed = 51) {
  const base = new IcosahedronGeometry(1, 1);
  const p = base.attributes.position;
  const keyOf = (i) => `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
  const factor = new Map();
  const rnd = rng(seed);
  const pts = [];
  for (let i = 0; i < p.count; i++) {
    const key = keyOf(i);
    if (!factor.has(key)) factor.set(key, 0.99 + rnd() * 0.15);
    const v = new Vector3(p.getX(i), p.getY(i), p.getZ(i)).multiplyScalar(factor.get(key));
    pts.push([v.x, v.y * 0.97, v.z]);
  }
  const tris = [];
  for (let i = 0; i < pts.length; i += 3) tris.push([pts[i], pts[i + 1], pts[i + 2]]);
  base.dispose();
  return fromTriangles(
    tris,
    (mid) => mid,
    (mid, n) => {
      if (n.y > 0.55) return hex(ROCK_COLORS.lit);
      if (n.y < -0.3) return hex(ROCK_COLORS.deep);
      return hex(Math.floor(mid.y * 3 + 8) % 2 === 0 ? ROCK_COLORS.body : n.x < -0.2 ? ROCK_COLORS.red : ROCK_COLORS.lit);
    },
  );
}

/** Every canyon obstacle geometry, built once. */
export function createCanyonRockSet() {
  return {
    hoodooHead: createHoodooHead(),
    hoodooSegment: createHoodooSegment(),
    lintelHead: createLintelHead(),
    lintelSegment: createLintelSegment(),
    finHeadUp: createFinHead(1),
    finHeadDown: createFinHead(-1),
    finBody: createFinBody(),
    archBand: createArchBand(),
    ledgeBand: createLedgeBand(),
    slabBlock: createSlabBlock(),
    boulder: createBoulder(),
  };
}

export { poleInstances } from '../../systems/obstacles/rockShapes.js';
export { ARCH_RISE, FIN_FOOT, LEDGE_DROP };
