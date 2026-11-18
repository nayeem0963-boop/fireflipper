# Volcanic Coast backdrop

`coast-a.jpg`, `coast-b.jpg` and `coast-c.jpg` are the three coast paintings supplied by the project owner for the 500 to 1000 m stretch of
the game, cropped to their sky-and-horizon band (the top 462 of 824 rows, resized to 1600 x 370). The sea and sand below the horizon are
drawn in 3D by `src/scenes/EmberValley/VolcanoBackdrop.jsx`. A tree-trunk obstacle that appeared in the bottom-left of the first image was
retouched out (the neighbouring rocks were mirrored over it).

## Arctic Ice Shelf backdrop

`arctic-a.jpg`, `arctic-b.jpg` and `arctic-c.jpg` are three arctic paintings (an ice shelf under an aurora with a research camp, the same shelf beside a
canyon and a research station, and a finer render of the second), supplied by the project owner for the 1500 to 2000 m stretch. Each is cropped at its own
horizon (the top 440 rows of the first, the top 350 of the others, out of 824) and resized to 1600 px wide. The snowfield, the camp's tents, snowmobile, mast
and flagged cairn, and the slate outcrops are drawn in 3D by `src/scenes/EmberValley/ArcticBackdrop.jsx`.

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
