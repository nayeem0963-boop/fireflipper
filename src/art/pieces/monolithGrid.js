/** Piece definition (pure data): Monolith Grid. The component is MonolithGrid.jsx. */
export default {
  id: 'monolith-grid',
  title: 'Monolith Grid',
  blurb: 'An obsidian slab with glowing edges floating over a neon wireframe terrain that ripples where you touch it.',
  params: {
    height: { type: 'range', label: 'Terrain height', min: 0, max: 1.6, step: 0.05, default: 0.7 },
    cells: { type: 'range', label: 'Grid density', min: 20, max: 80, step: 2, default: 44 },
    drift: { type: 'range', label: 'Terrain drift', min: 0, max: 1, step: 0.05, default: 0.35 },
    ripple: { type: 'range', label: 'Touch ripple', min: 0, max: 1.5, step: 0.05, default: 0.8 },
    hover: { type: 'range', label: 'Slab hover', min: 0, max: 1, step: 0.05, default: 0.5 },
    glow: { type: 'range', label: 'Glow', min: 0, max: 2, step: 0.05, default: 1 },
    edges: { type: 'toggle', label: 'Glowing edges', default: true },
  },
  lighting: 'dark',
  floorY: -1.6,
  camera: { hero: { position: [0, 3.2, 8.2] }, close: { position: [0, 1.8, 4.2] } },
};
