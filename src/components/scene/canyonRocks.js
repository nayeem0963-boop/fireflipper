import { BufferAttribute, BufferGeometry, Color, IcosahedronGeometry, Vector3 } from 'three';

/**
 * Procedural sandstone geometry for the Red Rock Canyon obstacles: hoodoos, rock fins, arch lintels and passage ledges, and boulders, in the faceted,
 * banded style of the owner's reference paintings. Pure geometry (vertex colours, flat faces), no model files; the renderer decides where they go.
 *
 * THE FAIRNESS CONTRACT. Collision never changes: columns are boxes (half width 0.4 w, from the pole's base to its gap end less 0.06), slabs are boxes, rocks are
 * circles (0.86 r). A visual may never be smaller than its collider (the bird would die in empty air) nor reach into the corridor beyond it. In unit space
 * (a column is drawn scaled by its width w across and its height h up; a slab by its length and height; a boulder by its radius r) every family therefore keeps:
 *   - shafts and caps: at every height the left and right extremes are at least MIN_SUPPORT (the collider is 0.4) and at most MAX_SUPPORT from the axis;
 *   - the gap end (y = +0.5 in shaft space; the renderer turns hanging poles upside down) is a flat plane: nothing rises above it;
 *   - slabs: at least 0.5 across (their collider is 0.5 - 0.05 / length) and the gap face is flat;
 *   - boulders: the largest ball inside is at least MIN_INRADIUS (the collider is 0.86) and nothing reaches beyond MAX_RADIUS.
 * Non-round shapes are drawn without the obstacle's random spin (rotation about y = 0), since their silhouette across the track is what is tested.
 * scripts/canyon-rocks-test.mjs checks all of this against the real geometry.
 */
export const ROCK_CONTRACT = Object.freeze({
  colliderHalf: 0.4,
  minSupport: 0.425,
  maxSupport: 0.53,
  slabHalf: 0.5,
  boulder: Object.freeze({ collider: 0.86, minInradius: 0.9, maxRadius: 1.2 }),
  maxTriangles: 400,
});

/** The canyon's colours, from the paintings: sunlit yellow-orange strata, orange sandstone, red shade, pale sunlit tops. */
export const ROCK_COLORS = Object.freeze({
  lit: '#f6b44e',
  body: '#e87a30',
  red: '#c9482b',
  deep: '#9c3328',
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
/** Builds a non-indexed geometry from triangles, colouring each face with `colorOf(centroid, normal)`. */
function fromTriangles(tris, colorOf) {
  const pos = new Float32Array(tris.length * 9);
  const col = new Float32Array(tris.length * 9);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const n = new Vector3();
  tris.forEach((t, i) => {
    a.fromArray(t[0]);
    b.fromArray(t[1]);
    c.fromArray(t[2]);
    n.copy(b).sub(a).cross(c.clone().sub(a)).normalize();
    const mid = a.clone().add(b).add(c).divideScalar(3);
    c3.set(colorOf(mid, n, i));
    for (let k = 0; k < 3; k++) {
      pos.set(t[k], i * 9 + k * 3);
      col.set([c3.r, c3.g, c3.b], i * 9 + k * 3);
    }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * A rock column of stacked rings (a lathe with a jittered outline): y runs from yMin to yMax, `rx(t)`, `rz(t)` and `cx(t)` give the half widths and the lean at t = 0..1 up the
 * column. Vertices sit on the axis directions at angles 0 and 180 degrees, so the left and right extremes are exactly the ring radii (times the small jitter).
 */
function column({ seed, rings, sides = 8, yMin = -0.5, yMax = 0.5, rx, rz, cx = () => 0, jitter = 0.03, colorOf }) {
  const rnd = rng(seed);
  const ring = [];
  for (let k = 0; k <= rings; k++) {
    const t = k / rings;
    const y = yMin + (yMax - yMin) * t;
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const th = (2 * Math.PI * i) / sides;
      const j = 1 + (rnd() * 2 - 1) * jitter;
      pts.push([cx(t) + rx(t) * Math.cos(th) * j, y, rz(t) * Math.sin(th) * j]);
    }
    ring.push(pts);
  }
  const tris = [];
  for (let k = 0; k < rings; k++) {
    for (let i = 0; i < sides; i++) {
      const i2 = (i + 1) % sides;
      const a = ring[k][i];
      const b = ring[k][i2];
      const c = ring[k + 1][i2];
      const d = ring[k + 1][i];
      tris.push([a, c, b], [a, d, c]);
    }
  }
  const sideCount = rings * sides * 2;
  const meta = (i) => (i < sideCount ? { row: Math.floor(i / (2 * sides)), rows: rings, col: Math.floor((i % (2 * sides)) / 2), cols: sides } : null);
  const top = [cx(1), yMax, 0];
  const bottom = [cx(0), yMin, 0];
  for (let i = 0; i < sides; i++) {
    const i2 = (i + 1) % sides;
    tris.push([top, ring[rings][i2], ring[rings][i]]);
    tris.push([bottom, ring[0][i], ring[0][i2]]);
  }
  return fromTriangles(tris, (mid, n, i) => colorOf(mid, n, i, meta(i)));
}

/** Banded sandstone: alternating yellow-orange and orange strata (diagonal when `slant` is set), pale sunlit top, darker shade on faces turned away from the light. */
function strata({ yMin = -0.5, yMax = 0.5, bands, slant = 0, seed = 1 }) {
  const rnd = rng(seed * 7919);
  const jitter = new Float32Array(512).map(() => 0.94 + rnd() * 0.12);
  // one band per run of facet rows, so each stripe is a clean band round the rock (not a checkerboard of triangles)
  return (mid, n, i, m) => {
    if (n.y > 0.9) return ROCK_COLORS.top;
    const s = m ? (m.row / m.rows) * bands + (m.col / m.cols) * slant : ((mid.y - yMin) / (yMax - yMin)) * bands + mid.x * slant;
    const even = (((Math.floor(s) % 2) + 2) % 2) === 0;
    let colorHex = even ? ROCK_COLORS.body : ROCK_COLORS.lit;
    if (n.y < -0.5) colorHex = ROCK_COLORS.deep;
    // faces turned away from the sun (low, left-facing) fall into red shade
    else if (n.x < -0.35 && n.y < 0.3) colorHex = even ? ROCK_COLORS.red : ROCK_COLORS.body;
    c3.set(colorHex).multiplyScalar(jitter[(m ? m.row * 31 + m.col : i) % 512]);
    return c3.getHex();
  };
}

/** Hoodoo shaft: a wavy, banded stem (never thinner than the hitbox). Gap end at the top (y = +0.5). */
export function createHoodooShaft() {
  return column({
    seed: 11,
    rings: 10,
    sides: 8,
    rx: (t) => 0.47 + 0.03 * Math.sin(t * Math.PI * 3.2) + 0.015 * t,
    rz: (t) => 0.5 + 0.08 * Math.sin(t * Math.PI * 2.1 + 1),
    jitter: 0.03,
    colorOf: strata({ bands: 7, seed: 11 }),
  });
}

/** Hoodoo caprock: a wide faceted disc 0.3 high (in widths), its flat top on y = 0 and its body below it. Overhangs the stem by about 0.05 of a width each side. */
export function createHoodooCap() {
  return column({
    seed: 12,
    rings: 3,
    sides: 8,
    yMin: -0.3,
    yMax: 0,
    rx: (t) => [0.46, 0.505, 0.505, 0.485][Math.round(t * 3)],
    rz: (t) => [0.52, 0.66, 0.68, 0.6][Math.round(t * 3)],
    jitter: 0.02,
    colorOf: strata({ yMin: -0.3, yMax: 0, bands: 2, seed: 12 }),
  });
}

/** Rock fin: a leaning blade, thick in depth at its foot and thinning towards the gap end, with diagonal strata. Gap end at the top. */
export function createRockFin() {
  return column({
    seed: 21,
    rings: 6,
    sides: 6,
    rx: () => 0.48,
    rz: (t) => 0.5 - 0.22 * t,
    cx: (t) => (t - 0.5) * 0.08,
    jitter: 0.035,
    colorOf: strata({ bands: 6, slant: 3.2, seed: 21 }),
  });
}

/** Arch lintel: a heavy stepped bridge stone for poles that hang from above; deep in depth, flat underside at the gap end (the renderer flips it, so the gap end is the top here too). */
export function createArchLintel() {
  const steps = [0.5, 0.5, 0.465, 0.465, 0.51, 0.51, 0.47, 0.47, 0.51];
  return column({
    seed: 31,
    rings: 8,
    sides: 8,
    rx: (t) => steps[Math.round(t * 8)] ?? 0.5,
    rz: (t) => 0.62 - 0.06 * Math.sin(t * Math.PI * 2),
    jitter: 0.03,
    colorOf: strata({ bands: 5, seed: 31 }),
  });
}

/**
 * A passage slab (a long ledge or arch span): a box one unit long, tall and deep with a faceted front face and strata, the top (gap face, y = +0.5) perfectly flat.
 * Stretched to the slab's length, so its ends stay square at x = +-0.5.
 */
export function createPassageSlab(seed = 41) {
  const rnd = rng(seed);
  const NX = 14;
  const NY = 5;
  const xs = Array.from({ length: NX + 1 }, (_, i) => -0.5 + i / NX);
  const ys = Array.from({ length: NY + 1 }, (_, j) => -0.5 + j / NY);
  // the front face (z > 0) is a faceted grid; only its depth varies
  const front = xs.map((x, i) => ys.map((y, j) => [x, y, 0.5 + (i === 0 || i === NX || j === NY ? 0 : (rnd() - 0.5) * 0.12)]));
  const tris = [];
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NY; j++) {
      const a = front[i][j];
      const b = front[i + 1][j];
      const c = front[i + 1][j + 1];
      const d = front[i][j + 1];
      tris.push([a, b, c], [a, c, d]);
    }
  }
  // back face, top (flat), bottom and the two ends
  const q = (a, b, c, d) => tris.push([a, b, c], [a, c, d]);
  q([0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]);
  q([-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]);
  q([-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]);
  q([0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]);
  q([-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]);
  const stripe = strata({ bands: 4, seed });
  const frontCount = NX * NY * 2;
  return fromTriangles(tris, (mid, n, i) => stripe(mid, n, i, i < frontCount ? { row: Math.floor(i / 2) % NY, rows: NY, col: Math.floor(Math.floor(i / 2) / NY), cols: NX } : null));
}

/** A boulder: a faceted lump (an icosphere with each vertex pushed in or out), always at least 0.9 thick in every direction and never beyond 1.2, so it can be spun freely. */
export function createBoulder(seed = 51) {
  const base = new IcosahedronGeometry(1, 1);
  const p = base.attributes.position;
  const keyOf = (i) => `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
  const factor = new Map();
  const rnd = rng(seed);
  const tris = [];
  const pts = [];
  for (let i = 0; i < p.count; i++) {
    const key = keyOf(i);
    if (!factor.has(key)) factor.set(key, 0.99 + rnd() * 0.15);
    const v = new Vector3(p.getX(i), p.getY(i), p.getZ(i)).multiplyScalar(factor.get(key));
    // slightly flattened on top and bottom, like a weathered block
    pts.push([v.x, v.y * 0.97, v.z]);
  }
  for (let i = 0; i < pts.length; i += 3) tris.push([pts[i], pts[i + 1], pts[i + 2]]);
  base.dispose();
  return fromTriangles(tris, (mid, n, i) => {
    if (n.y > 0.55) return ROCK_COLORS.lit;
    if (n.y < -0.3) return ROCK_COLORS.deep;
    return (Math.floor(mid.y * 3 + 8) % 2 === 0 ? ROCK_COLORS.body : n.x < -0.2 ? ROCK_COLORS.red : ROCK_COLORS.lit);
  });
}

/** Every canyon obstacle geometry, built once. */
export function createCanyonRockSet() {
  return {
    hoodooShaft: createHoodooShaft(),
    hoodooCap: createHoodooCap(),
    fin: createRockFin(),
    lintel: createArchLintel(),
    slab: createPassageSlab(),
    boulder: createBoulder(),
  };
}
