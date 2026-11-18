## Red Rock Canyon backdrop

`canyon-a.jpg`, `canyon-b.jpg` and `canyon-c.jpg` are three red sandstone canyon paintings at sunset (an arch and a misty gorge; pillars and a natural bridge in the low sun; a winding river canyon), supplied by the project owner for the first 1500 m, one for each 500 m
(originally 1672x941 WebP, 230 to 340 kB each). Each is a whole scene, resized to 1280x720 JPEG (about 110 to 140 kB). The valley floor of each picture (row 0.66) sits on the game's horizon; everything below it is replaced by a 3D canyon floor, drawn by
`src/scenes/EmberValley/CanyonBackdrop.jsx`.

## Frosty Polar backdrop

`frosty-glacier-valley.jpg`, `frosty-crystal-canyon.jpg` and `frosty-aurora-lake.jpg` are three 16:9 paintings supplied by the project owner (originally 1672x941 WebP) for the 1500 to 2000 m stretch: Glacier Valley
(a sunset glacier valley with an ice waterfall; 1500 to 1665 m), Crystal Ice Canyon (ice arches and frozen waterfalls; 1665 to 1830 m) and Aurora Lake (an aurora over a frozen lake; 1830 to 2000 m). Each is resized to
1408x792 JPEG (233 to 317 kB). The row where the far shore meets the lake (0.63, 0.65 and 0.50) sits on the game's horizon; the snowfield, slate outcrops and ice crystals are drawn in 3D by
`src/scenes/EmberValley/ArcticBackdrop.jsx`. (The owner sent the glacier valley image twice; it is used once.)

## Celestial Realm backdrop

`celestial-a.jpg`, `celestial-b.jpg` and `celestial-c.jpg` are three cosmic paintings (floating crystal cities among galaxies and a ringed planet; the same sky with
a wider view of the cities; the same with a figure on a balcony), supplied by the project owner for the 2000 to 3000 m stretch. Unlike the horizon-band paintings they are
whole scenes, so each is used in full (resized from 1408x768 to 1280x698, about 120 to 160 kB each). The picture fills the sky and slides as you fly, from the cities up to the
planet and nebulae. The cloud-sea floor and the floating crystal islands are drawn in 3D by `src/scenes/EmberValley/CelestialBackdrop.jsx`.

## Rose Sky Palace backdrop

`palace-a.jpg`, `palace-b.jpg` and `palace-c.jpg` are three sunset fantasy paintings (a filigree archway onto a lake of white palaces; a waterfall cascade beside the same arches; a cloud-sea view
with a great cathedral), supplied by the project owner for the 3000 to 5000 m stretch (originally 1672x941 WebP, 350 to 440 kB each). Each is a whole scene, resized to 1280x720 JPEG (about 175 to 205 kB).
The waterline of each picture sits on the game's horizon (row 0.62 of the first two, 0.66 of the third); everything below it is replaced by a 3D mirror pool, drawn by
`src/scenes/EmberValley/PalaceBackdrop.jsx`.

## Cloud Sanctuary backdrop (5000 m onwards)

`sanctuary-dragon.jpg`, `sanctuary-cat.jpg`, `sanctuary-deer.jpg`, `sanctuary-tiger.jpg` and `sanctuary-clouds.jpg` are five 16:9 paintings supplied by the project owner (a girl with a white dragon, a cat, a deer and a white tiger on a cloud sea
under floating golden cities and a shooting star, then the empty cloud sea; originally 1672x941 WebP). Each is resized to 1408x792 JPEG (191 to 255 kB). From 5000 m each is shown for 1000 m in that order, then the cycle
starts again, for ever. The cloud sea of each picture (row 0.70) sits on the game's horizon; a 3D cloud-sea floor, floating islands and golden sparkles are drawn by `src/scenes/EmberValley/SanctuaryBackdrop.jsx`.
