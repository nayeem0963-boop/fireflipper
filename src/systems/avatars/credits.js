/**
 * Credits for the third-party bird models (all CC BY 4.0). CC BY 4.0 allows commercial use and modification
 * provided the author is credited, a link to the licence is given, and changes are indicated. This list is shown
 * in the app (Settings > Credits, and under each model bird in the picker) and mirrored in CREDITS.md.
 */
export const LICENCE = Object.freeze({
  name: 'CC BY 4.0',
  url: 'https://creativecommons.org/licenses/by/4.0/',
});

/** Changes made to every model for Fire Flipper (on top of the per-model changes below). */
export const FIRE_FLIPPER_CHANGES = Object.freeze([
  'Re-coloured at run time as a fire bird: plumage tinted with a flame gradient, extra glow, a flame tail and a light added.',
  'Turned to face the direction of flight and scaled to fit the game; the model itself is otherwise unchanged.',
]);

export const CREDITS = Object.freeze([
  {
    id: 'scarlet-macaw',
    title: 'Scarlet Macaw',
    author: 'Mateus Schwaab',
    authorUrl: 'https://sketchfab.com/Mehrus',
    sourceUrl: 'https://sketchfab.com/3d-models/scarlet-macaw-0bb61160866b4811bd79b6d11e3d8907',
    changes: [
      'Flying pose baked into a static model (skeleton and animations removed), scaled to life size, material converted, re-centred.',
    ],
  },
  {
    id: 'macaw-flying',
    title: 'Low poly Rainbow Macaw In Flying 3D Model Free',
    author: 'iRahulRajput',
    authorUrl: 'https://sketchfab.com/rt699448',
    sourceUrl:
      'https://sketchfab.com/3d-models/low-poly-rainbow-macaw-in-flying-3d-model-free-7ac34a313b63475cabcadaf48b92b80b',
    changes: ['Baked into one static model, textures reduced to one JPEG, re-centred.'],
  },
  {
    id: 'macaw-blue-yellow',
    title: 'Macaw+3d+model',
    author: 'iRahulRajput',
    authorUrl: 'https://sketchfab.com/rt699448',
    sourceUrl: 'https://sketchfab.com/3d-models/macaw3dmodel-0a16d7ad853e475f87a3694baa8ed46c',
    changes: [
      'A 91,000-triangle model simplified to about 15,500 triangles, textures reduced to one JPEG, re-centred.',
    ],
  },
  {
    id: 'toco-toucan',
    title: 'Toco Toucan Bird 3D Model Free',
    author: 'iRahulRajput',
    authorUrl: 'https://sketchfab.com/rt699448',
    sourceUrl:
      'https://sketchfab.com/3d-models/toco-toucan-bird-3d-model-free-384e7f893a1d4148b2ced5cb184956b3',
    changes: [
      'A 424,000-triangle model simplified to about 17,000 triangles, scaled to life size, textures reduced to one JPEG, re-centred.',
    ],
  },
  {
    id: 'hoatzin',
    title: 'hoatzin',
    author: 'graduisc',
    authorUrl: 'https://sketchfab.com/graduisc',
    sourceUrl: 'https://sketchfab.com/3d-models/hoatzin-607caf85a0f24586bb8b70a124d168a1',
    changes: [
      'A 519,000-triangle sculpt simplified to about 26,700 triangles, scaled to life size, textures reduced, re-centred; baked into static geometry.',
    ],
  },
  {
    id: 'morpho',
    title: 'morpho',
    author: 'Qween',
    authorUrl: 'https://sketchfab.com/QweenH',
    sourceUrl: 'https://sketchfab.com/3d-models/morpho-0f2f9980584749fda6875b8ef8617b98',
    changes: [
      'Twenty parts joined into one static model, scaled up to a 30 cm wingspan, textures reduced, re-centred.',
      'The wings are separated into left and right halves at run time so they can beat; the model file itself is unchanged.',
    ],
  },
]);

export function getCredit(id) {
  return CREDITS.find((c) => c.id === id) ?? null;
}
