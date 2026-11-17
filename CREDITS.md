# Credits

## Fire-lit wildlife bird models

The six "fire-lit wildlife" birds you can fly as in Fire Flipper are 3D models made by other artists and shared on
Sketchfab under the [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
licence (CC BY 4.0), which allows commercial use and modification provided the author is credited, a link to the
licence is given, and changes are indicated. They are credited in the game too (Settings > Credits, and under each bird
in the bird picker). The same list lives in code in `src/systems/avatars/credits.js`, and a test keeps the two in sync.

The models came to this project via the Bulbuli World Explorer game, where they were already simplified and baked into
static geometry (noted per model below).

| Bird in the game | Model                                            | Author                                         | Source                                                                                                                       |
| ---------------- | ------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Blaze Macaw      | "Scarlet Macaw"                                  | [Mateus Schwaab](https://sketchfab.com/Mehrus) | [Sketchfab](https://sketchfab.com/3d-models/scarlet-macaw-0bb61160866b4811bd79b6d11e3d8907)                                  |
| Rainbow Phoenix  | "Low poly Rainbow Macaw In Flying 3D Model Free" | [iRahulRajput](https://sketchfab.com/rt699448) | [Sketchfab](https://sketchfab.com/3d-models/low-poly-rainbow-macaw-in-flying-3d-model-free-7ac34a313b63475cabcadaf48b92b80b) |
| Sapphire Macaw   | "Macaw+3d+model"                                 | [iRahulRajput](https://sketchfab.com/rt699448) | [Sketchfab](https://sketchfab.com/3d-models/macaw3dmodel-0a16d7ad853e475f87a3694baa8ed46c)                                   |
| Ember Toucan     | "Toco Toucan Bird 3D Model Free"                 | [iRahulRajput](https://sketchfab.com/rt699448) | [Sketchfab](https://sketchfab.com/3d-models/toco-toucan-bird-3d-model-free-384e7f893a1d4148b2ced5cb184956b3)                 |
| Inferno Harpy    | "Harpy Eagle"                                    | [G-Box](https://sketchfab.com/gabszf)          | [Sketchfab](https://sketchfab.com/3d-models/harpy-eagle-3ced481e50d24b38a87406708cb7a2c4)                                    |
| Magma Hoatzin    | "hoatzin"                                        | [graduisc](https://sketchfab.com/graduisc)     | [Sketchfab](https://sketchfab.com/3d-models/hoatzin-607caf85a0f24586bb8b70a124d168a1)                                        |

### Changes made to the models

Before Fire Flipper (for the Bulbuli World Explorer game):

- **Scarlet Macaw:** flying pose baked into a static model (skeleton and animations removed), scaled to life size,
  material converted, re-centred.
- **Rainbow macaw:** baked into one static model, textures reduced to one JPEG, re-centred.
- **Macaw+3d+model:** a 91,000-triangle model simplified to about 15,500 triangles, textures reduced to one JPEG,
  re-centred.
- **Toco Toucan:** a 424,000-triangle model simplified to about 17,000 triangles, scaled to life size, textures reduced
  to one JPEG, re-centred.
- **Harpy Eagle:** simplified to about 17,500 triangles, scaled to life size, textures reduced to one JPEG, re-centred;
  baked into static geometry.
- **hoatzin:** a 519,000-triangle sculpt simplified to about 26,700 triangles, scaled to life size, textures reduced,
  re-centred; baked into static geometry.

By Fire Flipper (all six):

- Re-coloured at run time as a fire bird: the plumage is tinted with a flame gradient, and extra glow, a flame tail and
  a light are added.
- Turned to face the direction of flight (and, for the harpy eagle and the rainbow macaw, tilted to fly level) and
  scaled to fit the game. The model files themselves are unchanged.

## Everything else

Fire Flipper's own code, its original firebird and its procedural sound and music are the project's own.
