/** Piece definition (pure data): Bioluminescent Lotus. The component is Lotus.jsx. */
export default {
  id: 'bioluminescent-lotus',
  title: 'Bioluminescent Lotus',
  blurb: 'A low-poly lotus whose petals slowly open and close round a ring of pulsing, glowing stamens.',
  params: {
    petals: { type: 'range', label: 'Petals per ring', min: 5, max: 14, step: 1, default: 9 },
    layers: { type: 'range', label: 'Rings', min: 2, max: 5, step: 1, default: 4 },
    bloom: { type: 'range', label: 'Open / close', min: 0, max: 1, step: 0.05, default: 0.55 },
    curl: { type: 'range', label: 'Petal curl', min: 0, max: 1, step: 0.05, default: 0.5 },
    length: { type: 'range', label: 'Petal length', min: 1, max: 2.2, step: 0.05, default: 1.6 },
    stamens: { type: 'range', label: 'Stamens', min: 8, max: 48, step: 2, default: 24 },
    glow: { type: 'range', label: 'Glow', min: 0, max: 2, step: 0.05, default: 1 },
  },
  floorY: -0.5,
  camera: { hero: { position: [2.7, 1.9, 3.7] }, close: { position: [1.3, 1.0, 1.9] } },
};
