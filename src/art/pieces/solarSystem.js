/** Piece definition (pure data): Solar System. The component is SolarSystem.jsx. */
export default {
  id: 'solar-system',
  title: 'Solar System',
  blurb: 'The Sun and its eight planets on elliptical orbits, with Earth’s moon, the asteroid belt and Saturn’s rings. A showcase: sizes and distances are not to scale.',
  params: {
    orbits: { type: 'toggle', label: 'Orbit lines', default: true },
    labels: { type: 'toggle', label: 'Names', default: true },
    colours: {
      type: 'select',
      label: 'Colours',
      options: [
        { value: 'natural', label: 'Natural' },
        { value: 'palette', label: 'Follow the palette' },
      ],
      default: 'natural',
    },
    belt: { type: 'toggle', label: 'Asteroid belt', default: true },
    spin: { type: 'range', label: 'Planet rotation', min: 0, max: 3, step: 0.1, default: 1 },
    planetScale: { type: 'range', label: 'Planet size', min: 0.5, max: 2, step: 0.1, default: 1 },
    sunGlow: { type: 'range', label: 'Sun glow', min: 0, max: 2, step: 0.1, default: 1 },
    tilt: { type: 'range', label: 'Orbit tilt', min: 0, max: 1, step: 0.05, default: 0.25 },
  },
  lighting: 'dark',
  backdrop: 'black',
  floorY: -4,
  maxDistance: 70,
  camera: {
    hero: { position: [0, 24, 46], target: [0, 0, 0] },
    close: { position: [0, 2.5, 9], target: [0, 0, 0] },
    overview: { position: [0.01, 46, 0.02], target: [0, 0, 0] },
  },
};
