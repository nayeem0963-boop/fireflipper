/** Piece definition (pure data): Vortex Core. The component is VortexCore.jsx. */
export default {
  id: 'vortex-core',
  title: 'Vortex Core',
  blurb: 'Nested wireframe tori turning round a pulsing energy orb, with embers orbiting on tilted rings.',
  params: {
    shellSpeed: { type: 'range', label: 'Shell speed', min: 0, max: 3, step: 0.05, default: 1 },
    shellOpacity: { type: 'range', label: 'Shell brightness', min: 0.2, max: 1, step: 0.05, default: 0.75 },
    pulse: { type: 'range', label: 'Orb pulse', min: 0, max: 2, step: 0.05, default: 1 },
    embers: { type: 'range', label: 'Embers', min: 200, max: 2000, step: 100, default: 1200 },
    glow: { type: 'range', label: 'Glow', min: 0, max: 2, step: 0.05, default: 1 },
  },
  lighting: 'dark',
  floorY: -3.2,
  camera: { hero: { position: [6.2, 3.2, 8.6] } },
};
