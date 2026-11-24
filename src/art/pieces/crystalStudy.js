/** Piece definition (pure data, no React): the Iridescent Study, a shader and material study. The component is CrystalStudy.jsx. */
export default {
  id: 'crystal-study',
  title: 'Iridescent Study',
  blurb: 'A noise-pushed sphere in a hand-written shader (fresnel rim, thin-film hue), ringed by glass.',
  params: {
    amplitude: { type: 'range', label: 'Wave height', min: 0, max: 0.6, step: 0.01, default: 0.28 },
    frequency: { type: 'range', label: 'Wave detail', min: 0.4, max: 3, step: 0.05, default: 1.1 },
    rim: { type: 'range', label: 'Rim sharpness', min: 1, max: 6, step: 0.1, default: 2.5 },
    iridescence: { type: 'range', label: 'Iridescence', min: 0, max: 1, step: 0.01, default: 0.8 },
    glass: { type: 'toggle', label: 'Glass rings', default: true },
    ior: { type: 'range', label: 'Glass IOR', min: 1, max: 2.3, step: 0.05, default: 1.45 },
    thickness: { type: 'range', label: 'Glass thickness', min: 0, max: 2, step: 0.05, default: 0.6 },
    glassRoughness: { type: 'range', label: 'Glass roughness', min: 0, max: 0.5, step: 0.01, default: 0.04 },
  },
  camera: { hero: { position: [3.6, 1.8, 5.2] } },
};
