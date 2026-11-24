import { createRng } from '../noise.js';

/**
 * A stylised dancer in an arabesque, built as a skeleton of tapered capsules (a limb or the torso is a pair of joints and a
 * radius at each), a head and hands, and a flared skirt, then turned into a cloud of points by sampling their surfaces
 * (a little thick, so the form is volumetric rather than a thin shell). She faces +x, stands on her left foot at the origin
 * with her height along +y, and is about 3.6 units tall with the raised hand.
 *
 * Pure and deterministic for a given `seed`, so it is checked by `npm run test:art`. It is procedural on purpose: a figure
 * built in code needs no model file, no download and no licence. A scanned or modelled mesh could replace it by supplying
 * positions in the same layout (see `dancerPoints`'s return value).
 */

/** [from, to, radius at from, radius at to]. A bone with from == to is a sphere (a joint, the head). */
export const BONES = [
  // Standing leg (foot on the ground, pointed), pelvis, torso leaning forward, neck and head
  [[0.2, 0.02, 0], [0.05, 0.14, 0], 0.045, 0.055],
  [[0.05, 0.14, 0], [0.04, 0.86, 0], 0.06, 0.085],
  [[0.04, 0.86, 0], [0, 1.6, 0], 0.085, 0.13],
  [[0, 1.62, -0.1], [0, 1.62, 0.1], 0.17, 0.17],
  [[0, 1.65, 0], [0.1, 1.92, 0], 0.18, 0.14],
  [[0.1, 1.92, 0], [0.3, 2.45, 0], 0.14, 0.2],
  [[0.3, 2.45, 0], [0.48, 2.82, 0], 0.2, 0.07],
  [[0.48, 2.82, 0], [0.6, 3.02, 0], 0.07, 0.07],
  [[0.62, 3.06, 0], [0.62, 3.06, 0], 0.17, 0.17],
  // Raised leg, stretched behind and up (the arabesque)
  [[-0.02, 1.62, 0.1], [-0.78, 1.98, 0.1], 0.12, 0.08],
  [[-0.78, 1.98, 0.1], [-1.5, 2.4, 0.1], 0.08, 0.055],
  [[-1.5, 2.4, 0.1], [-1.72, 2.58, 0.1], 0.055, 0.03],
  // Front arm reaching up and forward, hand open
  [[0.36, 2.58, 0.2], [0.85, 2.95, 0.28], 0.07, 0.05],
  [[0.85, 2.95, 0.28], [1.28, 3.3, 0.3], 0.05, 0.04],
  [[1.42, 3.45, 0.3], [1.42, 3.45, 0.3], 0.06, 0.06],
  // Back arm stretched behind for balance
  [[0.34, 2.58, -0.2], [-0.12, 2.72, -0.34], 0.07, 0.05],
  [[-0.12, 2.72, -0.34], [-0.62, 2.9, -0.44], 0.05, 0.04],
  [[-0.7, 2.94, -0.46], [-0.7, 2.94, -0.46], 0.05, 0.05],
];

/** Where the skirt hangs from, and how far it hangs and flares. */
export const SKIRT = { waistY: 1.92, hemY: 1.28, waistX: 0.08, waistRadius: 0.2, hemRadius: 0.9 };

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);

/** Surface area of a tapered capsule (about), used to give each bone its share of the points. */
function boneArea([a, b, ra, rb]) {
  const r = (ra + rb) / 2;
  return 2 * Math.PI * r * len(sub(b, a)) + 4 * Math.PI * r * r;
}

/**
 * The dancer as points: `count` points, the first share on the body and the rest on the skirt. Returns
 *   positions (xyz), heights (0 at the feet to 1 at the top of the raised hand), rands (0..1 each),
 *   kinds (0 = body, 1 = skirt), and `minY` / `maxY` (the range `heights` was measured over).
 */
export function dancerPoints({ count = 24000, seed = 3, skirtShare = 0.22 } = {}) {
  const rng = createRng(seed);
  const positions = new Float32Array(count * 3);
  const rands = new Float32Array(count);
  const kinds = new Float32Array(count);
  const bodyCount = Math.round(count * (1 - skirtShare));

  const areas = BONES.map(boneArea);
  const total = areas.reduce((s, a) => s + a, 0);
  const cumulative = areas.map((_, i) => areas.slice(0, i + 1).reduce((s, a) => s + a, 0) / total);
  const pickBone = (r) => {
    const i = cumulative.findIndex((c) => r <= c);
    return BONES[i < 0 ? BONES.length - 1 : i];
  };

  const dir = [0, 0, 0];
  const randomDirection = () => {
    // A uniform random direction on the sphere.
    const z = rng() * 2 - 1;
    const a = rng() * Math.PI * 2;
    const s = Math.sqrt(1 - z * z);
    dir[0] = s * Math.cos(a);
    dir[1] = z;
    dir[2] = s * Math.sin(a);
    return dir;
  };

  for (let i = 0; i < bodyCount; i++) {
    const [a, b, ra, rb] = pickBone(rng());
    const axis = sub(b, a);
    const L = len(axis);
    const thick = 0.82 + 0.3 * rng(); // a little volume: from just inside to just outside the surface
    if (L < 1e-6) {
      const d = randomDirection();
      positions[i * 3] = a[0] + d[0] * ra * thick;
      positions[i * 3 + 1] = a[1] + d[1] * ra * thick;
      positions[i * 3 + 2] = a[2] + d[2] * ra * thick;
    } else {
      const t = rng();
      const r = (ra + (rb - ra) * t) * thick;
      // Two directions at right angles to the bone, to go round it.
      const ax = [axis[0] / L, axis[1] / L, axis[2] / L];
      const helper = Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const u = [ax[1] * helper[2] - ax[2] * helper[1], ax[2] * helper[0] - ax[0] * helper[2], ax[0] * helper[1] - ax[1] * helper[0]];
      const ul = len(u);
      const un = [u[0] / ul, u[1] / ul, u[2] / ul];
      const vn = [ax[1] * un[2] - ax[2] * un[1], ax[2] * un[0] - ax[0] * un[2], ax[0] * un[1] - ax[1] * un[0]];
      const phi = rng() * Math.PI * 2;
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      positions[i * 3] = a[0] + axis[0] * t + (un[0] * c + vn[0] * s) * r;
      positions[i * 3 + 1] = a[1] + axis[1] * t + (un[1] * c + vn[1] * s) * r;
      positions[i * 3 + 2] = a[2] + axis[2] * t + (un[2] * c + vn[2] * s) * r;
    }
    kinds[i] = 0;
    rands[i] = rng();
  }

  // The skirt: a flared cone with a gently ruffled hem, trailing a little behind her.
  const { waistY, hemY, waistX, waistRadius, hemRadius } = SKIRT;
  for (let i = bodyCount; i < count; i++) {
    const t = Math.pow(rng(), 0.8);
    const angle = rng() * Math.PI * 2;
    const radius = (waistRadius + (hemRadius - waistRadius) * Math.pow(t, 1.2)) * (1 + 0.1 * Math.sin(angle * 6) * t) * (0.9 + 0.2 * rng());
    positions[i * 3] = waistX - 0.12 * t + radius * Math.cos(angle);
    positions[i * 3 + 1] = waistY + (hemY - waistY) * t;
    positions[i * 3 + 2] = radius * Math.sin(angle) * 0.9;
    kinds[i] = 1;
    rands[i] = rng();
  }

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    minY = Math.min(minY, positions[i * 3 + 1]);
    maxY = Math.max(maxY, positions[i * 3 + 1]);
  }
  const heights = new Float32Array(count);
  for (let i = 0; i < count; i++) heights[i] = (positions[i * 3 + 1] - minY) / (maxY - minY);
  return { positions, heights, rands, kinds, minY, maxY };
}
