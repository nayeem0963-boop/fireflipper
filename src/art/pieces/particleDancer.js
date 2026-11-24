/** Piece definition (pure data): Particle Dancer. The component is ParticleDancer.jsx. */
export default {
  id: 'particle-dancer',
  title: 'Particle Dancer',
  blurb: 'A dancer in arabesque made of thousands of glowing points, ribbons of light swirling round her, on rolling waves of particles.',
  params: {
    colours: {
      type: 'select',
      label: 'Colours',
      options: [
        { value: 'image', label: 'Blue, purple, gold' },
        { value: 'palette', label: 'Follow the palette' },
      ],
      default: 'image',
    },
    density: { type: 'range', label: 'Dancer particles', min: 8000, max: 60000, step: 4000, default: 24000 },
    size: { type: 'range', label: 'Particle size', min: 0.5, max: 3, step: 0.1, default: 1.4 },
    shimmer: { type: 'range', label: 'Shimmer', min: 0, max: 2, step: 0.05, default: 1 },
    sway: { type: 'range', label: 'Dance sway', min: 0, max: 2, step: 0.05, default: 1 },
    spin: { type: 'range', label: 'Figure rotation', min: 0, max: 2, step: 0.05, default: 0.4 },
    ribbons: { type: 'range', label: 'Ribbons', min: 0, max: 8, step: 1, default: 5 },
    waves: { type: 'range', label: 'Wave height', min: 0, max: 1.5, step: 0.05, default: 0.8 },
    brightness: { type: 'range', label: 'Brightness', min: 0.4, max: 2, step: 0.05, default: 1 },
  },
  lighting: 'dark',
  backdrop: 'black', // a deep black room, not the palette's backdrop: the particles are the only light
  floorY: -0.7,
  camera: {
    hero: { position: [3.5, 2.3, 6], target: [0, 1.6, 0] },
    close: { position: [2.4, 2.1, 3.8], target: [0, 1.9, 0] },
  },
};
