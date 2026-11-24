/**
 * The flowing ribbons that swirl round the dancer: each is a spiral that winds up from her feet to her raised hand, wide
 * round the skirt, pinching in at the top, and drifting round and up with time `t`. Ribbon `i` of the set starts at its own
 * angle (the golden angle apart) and winds at its own rate, so they cross and interleave like a dress of light.
 * `u` runs 0 at the feet to 1 at the hand. Writes x, y, z into `out` and returns it.
 */
export const RIBBON_HEIGHT = 3.5;

export function ribbonPoint(i, u, t, out = [0, 0, 0]) {
  const phase = i * 2.399;
  const y = 0.1 + u * RIBBON_HEIGHT;
  const centreX = 0.05 + 0.55 * u * u; // she leans forward as she rises
  const bulge = 0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.1)) * (0.7 + 0.3 * Math.sin(i * 1.7));
  const radius = (bulge + 0.25 * Math.sin(u * 9 - t * 1.2 + i)) * (1 - 0.7 * u * u * u);
  const turn = phase + u * (3.2 + (i % 3) * 0.9) * Math.PI * 2 * 0.5 + t * (0.5 + 0.12 * i);
  out[0] = centreX + radius * Math.cos(turn);
  out[1] = y + 0.12 * Math.sin(u * 7 + t * 1.1 + i);
  out[2] = radius * Math.sin(turn) * 0.9;
  return out;
}
