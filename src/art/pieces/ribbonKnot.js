/** Piece definition (pure data, no React): the Ribbon Knot, a generative sculpture. The component is RibbonKnot.jsx. */
export default {
  id: 'ribbon-knot',
  title: 'Ribbon Knot',
  blurb: 'A twisted ribbon wound round a torus knot, with a counter-ribbon turning the other way.',
  params: {
    p: { type: 'range', label: 'Windings (p)', min: 2, max: 7, step: 1, default: 3 },
    q: { type: 'range', label: 'Loops (q)', min: 1, max: 5, step: 1, default: 2 },
    twist: { type: 'range', label: 'Twist (turns)', min: 0, max: 8, step: 0.5, default: 3 },
    width: { type: 'range', label: 'Ribbon width', min: 0.05, max: 0.6, step: 0.01, default: 0.26 },
    wobble: { type: 'range', label: 'Wobble', min: 0, max: 0.5, step: 0.01, default: 0.12 },
    metalness: { type: 'range', label: 'Metalness', min: 0, max: 1, step: 0.01, default: 0.85 },
    roughness: { type: 'range', label: 'Roughness', min: 0.05, max: 1, step: 0.01, default: 0.28 },
    clearcoat: { type: 'range', label: 'Clear coat', min: 0, max: 1, step: 0.01, default: 0.6 },
    counter: { type: 'toggle', label: 'Counter-ribbon', default: true },
  },
  camera: { hero: { position: [6, 3, 8.6] } },
};
