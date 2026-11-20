# Flying-hazard atlas

`hazards.webp` (960 x 576, about 150 KB, with transparency) holds the flying-hazard sprites: five 192 px columns by three rows, one cell for every (hazard, world) pair that exists, row by row in this order:
crystal burst (worlds 1-5; id `smoke`, a harmless fire or ice crystal burst that replaced the smoke cloud), fire ring (2-5), energy ring (3-5), ember tornado (4-5), metal disc (5). A hazard is introduced in one world and stays in the later ones, colour-graded for each.

They were cut from seven supplied paintings (the crystal burst from two: a fire and an ice crystal burst) (an effect on a pale studio background) by `scripts/build-hazard-atlas.py` ("colour to alpha" against the background, an opaque body for the disc and the ring rims, the ring holes cleared,
the floor shadow thresholded away, no outline added), then graded per world (the crystal burst takes the fire painting in the warm worlds and the ice painting in the cold ones). The (hazard, world) -> cell table is `ATLAS` in `src/systems/fliers/fliers.js`; `scripts/fliers-test.mjs` checks the file's size and layout.
