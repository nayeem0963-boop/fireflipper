/** Piece definition (pure data): Plasma Sphere. The component is PlasmaSphere.jsx. */
export default {
  id: 'plasma-sphere',
  title: 'Plasma Sphere',
  blurb: 'A boiling, sun-like sphere: displaced by layered noise, with glowing veins and a fresnel corona.',
  params: {
    amplitude: { type: 'range', label: 'Surface relief', min: 0, max: 0.6, step: 0.01, default: 0.28 },
    scale: { type: 'range', label: 'Detail', min: 0.6, max: 3, step: 0.05, default: 1.4 },
    boil: { type: 'range', label: 'Boil rate', min: 0, max: 3, step: 0.05, default: 1.2 },
    core: { type: 'range', label: 'Brightness', min: 0.4, max: 2, step: 0.05, default: 1 },
    corona: { type: 'range', label: 'Corona', min: 0, max: 2, step: 0.05, default: 1 },
  },
  lighting: 'dark',
  floorY: -2.4,
  camera: { hero: { position: [0, 0.7, 5] }, close: { position: [0, 0.3, 2.8] } },
};
