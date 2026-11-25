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
