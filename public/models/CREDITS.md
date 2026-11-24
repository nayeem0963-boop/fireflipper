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

## v2/runner.glb (the v2 player: Aisha)

- Source: Aisha, the heroine of the Frost game, from your own repo `nayeem0963-boop/frostgirl`
  (`public/assets/expedition/aisha.glb`, commit 80f95b2), copied unchanged.
- Per that repo's `docs/FROST.md`, the character is a Meshy AI model (rigged), and its eight animation clips
  (idle, walk, run, sprint, jump, land, slide, celebrate) were exported with Mixamo bone names and merged into one rig by
  its asset script, then optimised (webp textures, quantised geometry; about 56k vertices, 3.2 MB).
- It is drawn at runtime by `src/components/scene/RunnerAvatar.jsx` using the settings in `src/systems/versions/versions.js`.

TODO: confirm the terms that apply to the Meshy-generated mesh (they depend on the Meshy plan it was made under) and to
the Mixamo animations before shipping this publicly.
