/** Piece definition (pure data): Neural Landscape. The component is NeuralLandscape.jsx. */
export default {
  id: 'neural-landscape',
  title: 'Neural Landscape',
  blurb: 'A grid of glowing points rolling in slow waves, coloured by height like a neural map.',
  params: {
    pattern: {
      type: 'select',
      label: 'Wave pattern',
      options: [
        { value: 'grid', label: 'Crossing waves' },
        { value: 'ripple', label: 'Radial ripples' },
      ],
      default: 'grid',
    },
    grid: { type: 'range', label: 'Points per side', min: 40, max: 160, step: 10, default: 100 },
    spacing: { type: 'range', label: 'Spacing', min: 0.05, max: 0.3, step: 0.01, default: 0.15 },
    amplitude: { type: 'range', label: 'Wave height', min: 0, max: 1, step: 0.05, default: 0.4 },
    frequency: { type: 'range', label: 'Wave frequency', min: 0.5, max: 4, step: 0.1, default: 2 },
    size: { type: 'range', label: 'Point size', min: 0.01, max: 0.12, step: 0.005, default: 0.06 },
    opacity: { type: 'range', label: 'Brightness', min: 0.2, max: 1, step: 0.05, default: 0.8 },
  },
  lighting: 'dark',
  floorY: -1.6,
  camera: { hero: { position: [0, 3.8, 8.4] }, close: { position: [0, 1.6, 4.6] } },
};
