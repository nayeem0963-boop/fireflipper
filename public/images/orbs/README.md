# Score orb atlas

`orbs.webp` (960 x 192, about 58 KB, with transparency) is one texture holding the five score orbs, one 192 x 192 cell each, left to right:
Solar, Frost, Cosmic, Nature, Celestial (the order of `ORB_FAMILY_IDS` in `src/systems/world/orbFamilies.js`).

They were cut from five supplied paintings (1408 x 768, each an orb on a pale studio background): the orb's circle was measured, cropped square, given a feathered circular alpha edge a few pixels
inside the painted rim (so no pale background or floor shadow remains), resized to 192 px and packed side by side. Solar is the sun (world 1), Frost the frost sphere (world 2), Cosmic the violet
galaxy sphere (world 3), Nature the forest sphere (world 4), Celestial the pink angel-wing sphere (world 5).

To replace one, keep the cell order and the 192 px cell size; `scripts/orb-families-test.mjs` checks the file's size and dimensions.
