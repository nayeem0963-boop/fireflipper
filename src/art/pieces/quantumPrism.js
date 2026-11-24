/** Piece definition (pure data): Quantum Prism. The component is QuantumPrism.jsx. */
export default {
  id: 'quantum-prism',
  title: 'Quantum Prism',
  blurb: 'A faceted gem that bends and splits a beam of light into a fan of colour while it turns on two axes.',
  params: {
    facets: { type: 'range', label: 'Facets', min: 4, max: 16, step: 1, default: 8 },
    ior: { type: 'range', label: 'Refraction (IOR)', min: 1.2, max: 2.6, step: 0.05, default: 2.2 },
    dispersion: { type: 'range', label: 'Dispersion', min: 0, max: 10, step: 0.5, default: 6 },
    roughness: { type: 'range', label: 'Roughness', min: 0, max: 0.4, step: 0.01, default: 0.02 },
    rays: { type: 'range', label: 'Spectrum rays', min: 3, max: 24, step: 1, default: 11 },
    beam: { type: 'range', label: 'Beam brightness', min: 0, max: 2, step: 0.05, default: 1 },
  },
  camera: { hero: { position: [4.2, 1.6, 6.8] } },
};
