# Credits

## Fire-lit wildlife bird models

The five "fire-lit wildlife" birds and butterfly you can fly as in Fire Flipper are 3D models made by other artists and shared on
Sketchfab under the [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
licence (CC BY 4.0), which allows commercial use and modification provided the author is credited, a link to the
licence is given, and changes are indicated. They are credited in the game too (Settings > Credits, and under each bird
in the bird picker). The same list lives in code in `src/systems/avatars/credits.js`, and a test keeps the two in sync.

The models came to this project via the Bulbuli World Explorer game, where they were already simplified and baked into
static geometry (noted per model below).

| Bird in the game      | Model                                            | Author                                         | Source                                                                                                                       |
| --------------------- | ------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Scarlet Macaw         | "Scarlet Macaw"                                  | [Mateus Schwaab](https://sketchfab.com/Mehrus) | [Sketchfab](https://sketchfab.com/3d-models/scarlet-macaw-0bb61160866b4811bd79b6d11e3d8907)                                  |
| Rainbow Macaw         | "Low poly Rainbow Macaw In Flying 3D Model Free" | [iRahulRajput](https://sketchfab.com/rt699448) | [Sketchfab](https://sketchfab.com/3d-models/low-poly-rainbow-macaw-in-flying-3d-model-free-7ac34a313b63475cabcadaf48b92b80b) |
| Blue-and-Yellow Macaw | "Macaw+3d+model"                                 | [iRahulRajput](https://sketchfab.com/rt699448) | [Sketchfab](https://sketchfab.com/3d-models/macaw3dmodel-0a16d7ad853e475f87a3694baa8ed46c)                                   |
| Toco Toucan           | "Toco Toucan Bird 3D Model Free"                 | [iRahulRajput](https://sketchfab.com/rt699448) | [Sketchfab](https://sketchfab.com/3d-models/toco-toucan-bird-3d-model-free-384e7f893a1d4148b2ced5cb184956b3)                 |
| Morpho Butterfly      | "morpho" (a butterfly)                           | [Qween](https://sketchfab.com/QweenH)          | [Sketchfab](https://sketchfab.com/3d-models/morpho-0f2f9980584749fda6875b8ef8617b98)                                         |

### Changes made to the models

Before Fire Flipper (for the Bulbuli World Explorer game):

- **Scarlet Macaw:** flying pose baked into a static model (skeleton and animations removed), scaled to life size,
  material converted, re-centred.
- **Rainbow macaw:** baked into one static model, textures reduced to one JPEG, re-centred.
- **Macaw+3d+model:** a 91,000-triangle model simplified to about 15,500 triangles, textures reduced to one JPEG,
  re-centred.
- **Toco Toucan:** a 424,000-triangle model simplified to about 17,000 triangles, scaled to life size, textures reduced
  to one JPEG, re-centred.
- **morpho:** twenty parts joined into one static model, scaled up to a 30 cm wingspan, textures reduced, re-centred.

By Fire Flipper (all five):

- Re-coloured at run time in three colours (Fire, Blue and White): the plumage is tinted with a flame gradient, and extra
  glow, a flame tail and a light are added.
- Turned to face the direction of flight (and, for the rainbow macaw, tilted to fly level) and scaled to fit the game.
- Given wing beats at run time: the wings are bent about the shoulders by a small shader patch, so they flap without
  the model file being changed.
- For the butterfly, the two wings are also separated into left and right halves at run time so they can beat.

## Code-built birds from the Bulbuli project

The **Bulbuli** birds (in Fire, Blue and White) are not downloaded models. They are built in
code, from primitive shapes, and were ported from the Bulbuli project (the same author as Fire Flipper): the player
bird in `games/PlayerBird3D.jsx`. There is no third-party licence to carry for them. Here they were given fire colour
schemes, glow and a flame tail, and wing beats driven by the game's flight state.

The Bulbuli mascot's 3D model file (`public/models/bulbuli.glb` in that project) was **not** used: it is a Sketchfab
export with no author or licence recorded, so it is not safe to redistribute here until that is known.

## Everything else

Fire Flipper's own code, its original firebird and its procedural sound and music are the project's own.
