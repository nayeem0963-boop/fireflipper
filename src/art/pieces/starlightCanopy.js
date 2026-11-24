/** Piece definition (pure data): Starlight Canopy. The component is StarlightCanopy.jsx. */
export default {
  id: 'starlight-canopy',
  title: 'Starlight Canopy',
  blurb: 'A swirling spiral galaxy of glowing stars that turn faster near the core, with rings of light bursting outwards.',
  params: {
    stars: { type: 'range', label: 'Stars', min: 5000, max: 80000, step: 5000, default: 40000 },
    arms: { type: 'range', label: 'Spiral arms', min: 2, max: 7, step: 1, default: 4 },
    twist: { type: 'range', label: 'Spiral tightness', min: 0.5, max: 3, step: 0.1, default: 1.6 },
    spread: { type: 'range', label: 'Arm spread', min: 0.05, max: 1, step: 0.05, default: 0.35 },
    size: { type: 'range', label: 'Star size', min: 0.5, max: 3, step: 0.1, default: 1.8 },
    bursts: { type: 'range', label: 'Light bursts', min: 0, max: 6, step: 1, default: 3 },
  },
  lighting: 'dark',
  floorY: -2.6,
  camera: { hero: { position: [0, 4.6, 6.8] }, close: { position: [0, 2.2, 3.2] } },
};
