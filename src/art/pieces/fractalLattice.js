/** Piece definition (pure data): Fractal Lattice. The component is FractalLattice.jsx. */
export default {
  id: 'fractal-lattice',
  title: 'Fractal Lattice',
  blurb: 'A matrix of cubes that swell, shrink, rise and turn together as layered noise flows through the grid.',
  params: {
    grid: { type: 'range', label: 'Grid size', min: 3, max: 9, step: 1, default: 6 },
    spacing: { type: 'range', label: 'Spacing', min: 0.5, max: 1.4, step: 0.05, default: 0.85 },
    noiseScale: { type: 'range', label: 'Noise scale', min: 0.1, max: 1.2, step: 0.05, default: 0.45 },
    amplitude: { type: 'range', label: 'Height change', min: 0, max: 2, step: 0.05, default: 0.9 },
    breath: { type: 'range', label: 'Expand / contract', min: 0, max: 1.5, step: 0.05, default: 0.7 },
    twist: { type: 'range', label: 'Twist', min: 0, max: 2, step: 0.05, default: 0.6 },
    metalness: { type: 'range', label: 'Metalness', min: 0, max: 1, step: 0.05, default: 0.7 },
    roughness: { type: 'range', label: 'Roughness', min: 0.05, max: 1, step: 0.05, default: 0.3 },
  },
  floorY: -3.6,
  camera: { hero: { position: [7.2, 5.2, 9.4] }, close: { position: [3.6, 2.6, 4.6] } },
};
