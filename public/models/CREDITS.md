# Model credits

The in-app list is `src/systems/avatars/credits.js` (Settings > Credits). Most bird models are CC BY 4.0;
the Fire Eagle is the exception.

## birds/fire-eagle.glb (Fire Eagle)

- Source: "Eagle" (rigged, animated `Fly` clip) from the Omabuarts Studio animal set,
  Copyright 2020 Omabuarts Studio. Licence: https://omabuarts.com/license (not CC BY).
- Obtained from the glTF copy at `mitmedialab/text2vid` (`animals/Eagle_Fly.gltf`).
- Modified only by packing the .gltf into a single binary .glb (no geometry, skeleton or animation
  changes). All fire styling (palette, glow, flame shell, wing-tip sparks) is applied at runtime in
  `src/components/scene/FireEagle.jsx`.

TODO: the licence page could not be read when this model was added. Confirm it permits commercial use
and note any required attribution before shipping.
