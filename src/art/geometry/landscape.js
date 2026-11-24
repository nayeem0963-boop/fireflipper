/**
 * The rolling landscape the Particle Dancer stands on: four layered sine waves (two running across the grid, one along its
 * diagonal and a slow ripple spreading from the centre), all moving with time `t`. `amp` scales every wave; the height is
 * always within +-0.92 * amp. The figure uses the same function to stand on the surface, so she rises and falls with it.
 */
export function terrainHeight(x, z, t, amp = 1) {
  return (
    amp *
    (Math.sin(x * 0.5 + t * 0.6) * 0.35 + Math.sin(z * 0.7 - t * 0.5) * 0.25 + Math.sin((x + z) * 0.35 + t * 0.3) * 0.2 + Math.sin(Math.hypot(x, z) * 0.9 - t * 0.8) * 0.12)
  );
}

export const TERRAIN_MAX = 0.92;
