/**
 * Camera presets for the Art Lab: where the camera sits and what it looks at. A piece can override any of them with
 * `camera: { hero: { position: [...] } }` in its definition. Pure data.
 */
export const CAMERA_PRESETS = Object.freeze([
  { id: 'hero', name: 'Hero', position: [4.4, 2.2, 6.4], target: [0, 0.1, 0], fov: 40 },
  { id: 'close', name: 'Close-up', position: [1.7, 0.7, 2.7], target: [0, 0, 0], fov: 34 },
  { id: 'overview', name: 'Overview', position: [0.01, 10.5, 0.02], target: [0, 0, 0], fov: 40 },
]);

export const DEFAULT_PRESET_ID = CAMERA_PRESETS[0].id;

/** The preset `id` for a piece: the standard one with the piece's own overrides applied (unknown ids give Hero). */
export function presetFor(piece, id) {
  const base = CAMERA_PRESETS.find((p) => p.id === id) ?? CAMERA_PRESETS[0];
  return { ...base, ...(piece?.camera?.[base.id] ?? {}) };
}
