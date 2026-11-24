import { createRng } from '../noise.js';

/**
 * Star positions for a spiral galaxy: `arms` arms that wind `twist` half-turns from the core to the rim, thick near the
 * core and thin at the edge, scattered by `spread`. Returns flat arrays ready for buffer attributes: `positions` (xyz),
 * `rands` (one random number per star, for size and twinkle). Deterministic for a given `seed`.
 */
export function galaxyPoints({ count = 20000, arms = 4, radius = 4, twist = 1.6, spread = 0.35, seed = 7 } = {}) {
  const rng = createRng(seed);
  const positions = new Float32Array(count * 3);
  const rands = new Float32Array(count);
  const gauss = () => rng() + rng() + rng() - 1.5; // about -1.5..1.5, bell-shaped
  for (let i = 0; i < count; i++) {
    const t = rng();
    const r = radius * Math.pow(t, 1.5); // denser towards the core
    const arm = i % arms;
    const angle = (arm / arms) * Math.PI * 2 + (r / radius) * twist * Math.PI;
    const scatter = spread * (0.25 + r / radius) * radius * 0.35;
    const x = Math.cos(angle) * r + gauss() * scatter;
    const z = Math.sin(angle) * r + gauss() * scatter;
    const y = gauss() * spread * radius * 0.12 * (1.2 - r / radius);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    rands[i] = rng();
  }
  return { positions, rands };
}
