/** Piece definition (pure data, no React): the Light Orbit, a kinetic light composition. The component is LightOrbit.jsx. */
export default {
  id: 'light-orbit',
  title: 'Light Orbit',
  blurb: 'A shell of breathing metal forms lit by three coloured lights that circle through it.',
  params: {
    count: { type: 'range', label: 'Forms', min: 12, max: 240, step: 6, default: 84 },
    radius: { type: 'range', label: 'Shell radius', min: 1.6, max: 5, step: 0.1, default: 2.6 },
    breath: { type: 'range', label: 'Breathing', min: 0, max: 2, step: 0.05, default: 0.8 },
    lightIntensity: { type: 'range', label: 'Light intensity', min: 0, max: 160, step: 1, default: 80 },
    roughness: { type: 'range', label: 'Metal roughness', min: 0.05, max: 0.8, step: 0.01, default: 0.22 },
    halos: { type: 'toggle', label: 'Light halos', default: true },
  },
  // 'dark': a dim room, so the piece's own coloured lights do the lighting (default is 'studio'); floorY lowers the helper grid and floor.
  lighting: 'dark',
  floorY: -3.4,
  camera: { hero: { position: [6.4, 2.8, 9] }, overview: { position: [0.01, 13, 0.02] } },
};
