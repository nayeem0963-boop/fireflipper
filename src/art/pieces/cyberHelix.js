/** Piece definition (pure data): Cyber Helix. The component is CyberHelix.jsx. */
export default {
  id: 'cyber-helix',
  title: 'Cyber Helix',
  blurb: 'Two interlocking metal strands joined by rungs, with bright pulses racing up one strand and down the other.',
  params: {
    turns: { type: 'range', label: 'Turns', min: 1, max: 6, step: 0.5, default: 3 },
    radius: { type: 'range', label: 'Radius', min: 0.5, max: 1.5, step: 0.05, default: 0.9 },
    height: { type: 'range', label: 'Height', min: 3, max: 8, step: 0.5, default: 5.5 },
    tube: { type: 'range', label: 'Strand thickness', min: 0.04, max: 0.2, step: 0.01, default: 0.09 },
    rungs: { type: 'range', label: 'Rungs', min: 8, max: 60, step: 2, default: 28 },
    pulses: { type: 'range', label: 'Pulses', min: 2, max: 16, step: 1, default: 8 },
    metalness: { type: 'range', label: 'Metalness', min: 0.3, max: 1, step: 0.05, default: 0.95 },
    glow: { type: 'range', label: 'Glow', min: 0, max: 2, step: 0.05, default: 1 },
  },
  floorY: -3.4,
  camera: { hero: { position: [6, 1.6, 8] }, close: { position: [2.4, 0.6, 3.4] } },
};
