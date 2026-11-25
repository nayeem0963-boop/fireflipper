import { BufferGeometry, Float32BufferAttribute } from 'three';
import { createRng, fbm3 } from '../noise.js';

/**
 * The Solar System piece, as pure data and maths (no renderer), so it is checked by `npm run test:art`.
 *
 * It is a showcase, NOT to scale: real sizes and distances would make the planets invisible next to the Sun. Instead the
 * planets keep their true order, their true relative sizes among themselves (roughly) and their true character (Jupiter the
 * giant, Saturn's rings, Uranus on its side, Earth's moon), on orbits spread so every one of them is on screen. Orbital
 * periods use the real ratios, compressed with a square root so Neptune still visibly moves.
 */
export const SUN = { radius: 2.2 };

/**
 * radius, a (orbit size) and e (eccentricity) are in scene units; years is the real orbital period in Earth years; tilt is the axial tilt in
 * radians; spin is the rotation rate (negative = backwards); kind picks the surface (see `planetField`); stops is the natural colour ramp
 * [position 0..1, '#rrggbb'] the surface scalar is mapped through; phase is where on its orbit the planet starts.
 */
export const PLANETS = [
  { id: 'mercury', name: 'Mercury', radius: 0.22, a: 4.2, e: 0.21, years: 0.24, tilt: 0.03, spin: 0.5, phase: 0.5, kind: 'rock', seed: 1, stops: [[0, '#3b3835'], [0.5, '#8a847b'], [1, '#c9c2b6']] },
  { id: 'venus', name: 'Venus', radius: 0.42, a: 5.8, e: 0.01, years: 0.62, tilt: 3.09, spin: -0.15, phase: 2.2, kind: 'cloud', seed: 2, stops: [[0, '#a8742e'], [0.5, '#e3b66a'], [1, '#fbeac2']], atmosphere: '#ffcf80' },
  {
    id: 'earth', name: 'Earth', radius: 0.45, a: 7.6, e: 0.02, years: 1, tilt: 0.41, spin: 1.3, phase: 4.1, kind: 'earth', seed: 3,
    stops: [[0, '#0a2a6a'], [0.35, '#1d5fb4'], [0.5, '#2f7d3a'], [0.75, '#8a6b3a'], [1, '#f4f6fa']],
    atmosphere: '#6fb4ff',
    moon: { radius: 0.12, a: 0.85, years: 0.0748 },
  },
  { id: 'mars', name: 'Mars', radius: 0.3, a: 9.4, e: 0.09, years: 1.88, tilt: 0.44, spin: 1.2, phase: 0.9, kind: 'rock', seed: 4, stops: [[0, '#4a1f12'], [0.5, '#b5532c'], [1, '#e8a77c']], atmosphere: '#ff9a6a' },
  { id: 'jupiter', name: 'Jupiter', radius: 1.35, a: 13.8, e: 0.05, years: 11.86, tilt: 0.05, spin: 2.4, phase: 3.3, kind: 'gas', bands: 9, spot: true, seed: 5, stops: [[0, '#7a4a2a'], [0.35, '#c59a6a'], [0.7, '#ecd9b8'], [1, '#b5683a']] },
  { id: 'saturn', name: 'Saturn', radius: 1.1, a: 18.2, e: 0.06, years: 29.46, tilt: 0.47, spin: 2.1, phase: 5.2, kind: 'gas', bands: 7, seed: 6, stops: [[0, '#a8895a'], [0.5, '#dcc693'], [1, '#f3e7c3']], rings: { inner: 1.5, outer: 2.5 } },
  { id: 'uranus', name: 'Uranus', radius: 0.75, a: 21.8, e: 0.05, years: 84, tilt: 1.71, spin: -1.2, phase: 1.7, kind: 'gas', bands: 3, seed: 7, stops: [[0, '#5fb8c0'], [1, '#b5f0f2']], rings: { inner: 1.1, outer: 1.35, faint: true } },
  { id: 'neptune', name: 'Neptune', radius: 0.72, a: 25, e: 0.01, years: 165, tilt: 0.49, spin: 1.3, phase: 2.9, kind: 'gas', bands: 4, seed: 8, stops: [[0, '#1d3fa8'], [0.6, '#3d6fe0'], [1, '#8fb4ff']], atmosphere: '#4d7dff' },
];

/** Seconds for one orbit of a planet whose real period is `years` Earth years (Earth takes 12 s; the rest by a square-root law). */
export const orbitSeconds = (years) => 12 * Math.sqrt(years);

/** Where on its orbit a planet is at art time `t`. */
export const orbitAngle = (planet, t) => planet.phase + (t * Math.PI * 2) / orbitSeconds(planet.years);

/**
 * A point on a planet's elliptical orbit with the Sun at one focus (the origin), in the x/z plane: nearest the Sun at angle 0
 * (distance a(1 - e)), furthest at angle pi (a(1 + e)). Writes into `out` and returns it.
 */
export function orbitPosition(planet, angle, out = [0, 0, 0]) {
  const { a, e } = planet;
  out[0] = a * (Math.cos(angle) - e);
  out[1] = 0;
  out[2] = a * Math.sqrt(1 - e * e) * Math.sin(angle);
  return out;
}

/** The points of an orbit as a closed loop, `segments` of them, flat xyz. */
export function orbitLinePoints(planet, segments = 160) {
  const out = new Float32Array(segments * 3);
  const p = [0, 0, 0];
  for (let i = 0; i < segments; i++) {
    orbitPosition(planet, (i / segments) * Math.PI * 2, p);
    out.set(p, i * 3);
  }
  return out;
}

/** The Moon's position round the Earth (a circle, flat), at art time `t`. */
export function moonPosition(moon, t, out = [0, 0, 0]) {
  const angle = (t * Math.PI * 2) / orbitSeconds(moon.years) + 1.1;
  out[0] = moon.a * Math.cos(angle);
  out[1] = 0.04 * Math.sin(angle * 2);
  out[2] = moon.a * Math.sin(angle);
  return out;
}

/** The asteroid belt between Mars and Jupiter: `count` rocks in a thick ring. flat xyz; `rands` is one number per rock. Deterministic. */
export function beltPoints({ count = 2500, inner = 10.8, outer = 12.4, thickness = 0.5, seed = 12 } = {}) {
  const rng = createRng(seed);
  const positions = new Float32Array(count * 3);
  const rands = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = inner + (outer - inner) * (rng() + rng()) * 0.5; // clustered in the middle of the belt
    const a = rng() * Math.PI * 2;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = (rng() - 0.5) * thickness * (0.4 + rng());
    positions[i * 3 + 2] = Math.sin(a) * r;
    rands[i] = rng();
  }
  return { positions, rands };
}

/** Background stars on a big sphere round everything: flat xyz, plus a brightness and a size per star. Deterministic. */
export function starPoints({ count = 1800, radius = 90, seed = 31 } = {}) {
  const rng = createRng(seed);
  const positions = new Float32Array(count * 3);
  const brightness = new Float32Array(count);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const z = rng() * 2 - 1;
    const a = rng() * Math.PI * 2;
    const s = Math.sqrt(1 - z * z);
    const r = radius * (0.8 + rng() * 0.4);
    positions[i * 3] = s * Math.cos(a) * r;
    positions[i * 3 + 1] = z * r;
    positions[i * 3 + 2] = s * Math.sin(a) * r;
    brightness[i] = 0.35 + 0.65 * Math.pow(rng(), 2);
    sizes[i] = 0.5 + 1.4 * Math.pow(rng(), 3);
  }
  return { positions, brightness, sizes };
}

/**
 * A flat ring (Saturn's) in the x/z plane, between the radii `inner` and `outer` (as multiples of the planet's radius when
 * scaled by it). Its texture coordinate u runs 0 at the inner edge to 1 at the outer edge, so a strip texture of bands wraps it.
 */
export function ringGeometry({ inner = 1.5, outer = 2.5, segments = 96 } = {}) {
  const positions = [];
  const uvs = [];
  const normals = [];
  const index = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    positions.push(c * inner, 0, s * inner, c * outer, 0, s * outer);
    uvs.push(0, i / segments, 1, i / segments);
    normals.push(0, 1, 0, 0, 1, 0);
    if (i < segments) {
      const k = i * 2;
      index.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}

// ------------------------------------------------------------------------------------------------ surfaces

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * A planet's surface as a field of numbers between 0 and 1 (`w` x `h`, row by row, top to bottom), seamless round the planet:
 * every pixel is turned into a point on the sphere and read from 3D noise. What the numbers mean depends on `planet.kind`:
 *  - rock:  rough ground with craters (0 dark, 1 bright)
 *  - cloud: swirling cloud tops (Venus)
 *  - earth: 0 to 0.35 sea (deeper is lower), 0.5 to 0.78 land (higher is higher), 0.95 and up ice at the poles
 *  - gas:   horizontal bands warped by turbulence, with Jupiter's great red spot
 * The number is then coloured by `colorizeField`, with the planet's natural colours or the active palette, which is how one
 * surface can wear either.
 */
export function planetField(planet, w = 256, h = 128) {
  const { kind, seed = 0 } = planet;
  const field = new Float32Array(w * h);
  const rng = createRng(seed * 977 + 5);
  const craters = Array.from({ length: kind === 'rock' ? 26 : 0 }, () => {
    const z = rng() * 2 - 1;
    const a = rng() * Math.PI * 2;
    const s = Math.sqrt(1 - z * z);
    return { c: [s * Math.cos(a), z, s * Math.sin(a)], r: 0.06 + 0.16 * rng() * rng() };
  });
  const spot = { c: [Math.cos(-0.35) * Math.cos(1.0), Math.sin(-0.35), Math.cos(-0.35) * Math.sin(1.0)] };

  for (let y = 0; y < h; y++) {
    const lat = Math.PI * ((y + 0.5) / h - 0.5);
    const cl = Math.cos(lat);
    const sl = Math.sin(lat);
    for (let x = 0; x < w; x++) {
      const lon = Math.PI * 2 * ((x + 0.5) / w);
      const px = cl * Math.cos(lon);
      const py = sl;
      const pz = cl * Math.sin(lon);
      let s;
      if (kind === 'rock') {
        s = 0.5 + 0.5 * fbm3(px * 3.2 + seed, py * 3.2, pz * 3.2, 4);
        for (const { c, r } of craters) {
          const d = Math.acos(Math.min(1, px * c[0] + py * c[1] + pz * c[2])) / r; // 0 at the centre, 1 at the rim
          if (d < 1.25) s += d < 0.95 ? -0.18 * (1 - d) : 0.14 * (1 - Math.abs(d - 1.05) / 0.2); // dark floor, bright rim
        }
      } else if (kind === 'cloud') {
        const q = fbm3(px * 2 + seed, py * 2, pz * 2, 3);
        s = 0.5 + 0.5 * fbm3(px * 3 + q * 1.6, py * 5 + q, pz * 3 - q * 1.2, 4);
      } else if (kind === 'earth') {
        const hgt = fbm3(px * 2.2 + seed, py * 2.2, pz * 2.2, 5);
        s = hgt < 0.02 ? 0.05 + 0.3 * smooth(-0.6, 0.02, hgt) : 0.5 + 0.28 * smooth(0.02, 0.5, hgt);
        const ice = smooth(0.8, 0.93, Math.abs(sl) + 0.06 * fbm3(px * 6, py * 6, pz * 6, 2));
        s = s * (1 - ice) + 0.98 * ice;
      } else {
        const warp = fbm3(px * 3 + seed, py * 3, pz * 3, 3) * 0.6;
        const bands = planet.bands ?? 6;
        s = 0.5 + 0.5 * Math.sin(sl * bands * Math.PI + warp * 3);
        s = s * 0.9 + 0.1 * (0.5 + 0.5 * fbm3(px * 12, py * 12, pz * 12, 2));
        if (planet.spot) {
          const d = Math.acos(Math.min(1, px * spot.c[0] + py * spot.c[1] + pz * spot.c[2]));
          s += 0.7 * (1 - smooth(0.05, 0.16, d)) * (1 - s);
        }
      }
      field[y * w + x] = Math.min(1, Math.max(0, s));
    }
  }
  return field;
}

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** The colour at `s` (0..1) along a ramp of [position, '#rrggbb'] stops, as [r, g, b] 0..255. */
export function sampleStops(stops, s) {
  if (s <= stops[0][0]) return hexToRgb(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    if (s <= stops[i][0]) {
      const [p0, c0] = stops[i - 1];
      const [p1, c1] = stops[i];
      const t = (s - p0) / (p1 - p0);
      const a = hexToRgb(c0);
      const b = hexToRgb(c1);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
  }
  return hexToRgb(stops[stops.length - 1][1]);
}

/** Colours a field of numbers through a ramp: RGBA bytes (opaque), ready for a texture. */
export function colorizeField(field, stops) {
  const out = new Uint8Array(field.length * 4);
  for (let i = 0; i < field.length; i++) {
    const [r, g, b] = sampleStops(stops, field[i]);
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** The active palette's four colours as a four-stop ramp, darkest to lightest, to wear a surface instead of its natural colours. */
export const paletteStops = (colors) => [[0, colors[3]], [0.4, colors[0]], [0.72, colors[1]], [1, colors[2]]];

/**
 * A strip of bands for a ring, as RGBA bytes `w` x 1: dense bands with a dark gap (the Cassini division) about two thirds of the
 * way out. `faint` makes a thin, dim ring (Uranus). Colours go through `stops`; the alpha carries the ring's density.
 */
export function ringStrip(w, stops, faint = false) {
  const out = new Uint8Array(w * 4);
  for (let x = 0; x < w; x++) {
    const u = x / (w - 1);
    let density = 0.35 + 0.65 * Math.abs(Math.sin(u * 23) * Math.cos(u * 7.3 + 1));
    density *= smooth(0, 0.06, u) * (1 - smooth(0.94, 1, u)); // soft inner and outer edges
    density *= 1 - 0.95 * (1 - smooth(0, 0.025, Math.abs(u - 0.66))); // the Cassini division
    if (faint) density *= 0.35;
    const [r, g, b] = sampleStops(stops, 0.3 + 0.6 * u);
    out[x * 4] = r;
    out[x * 4 + 1] = g;
    out[x * 4 + 2] = b;
    out[x * 4 + 3] = Math.round(255 * Math.min(1, density));
  }
  return out;
}
