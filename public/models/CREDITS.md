# Model credits

The in-app list is `src/systems/avatars/credits.js` (Settings > Credits). The two third-party bird models (Honeybell and the Morpho Butterfly)
are CC BY 4.0; the Phoenix was made for this game.

## birds/phoenix.glb (the Phoenix, the default bird; replaced FlameBird)

- Made for Fire Flipper from `fireflipper_upgrade/FlameBird/phoenix_hawk_model.glb` (2.6M triangles), by the scripts in
  `fireflipper_upgrade/FlameBird/phoenix_work`: reduced to 50K triangles in Blender 5.3, a 28-bone avian skeleton with
  region-limited weights, six clips (FB_Idle, FB_WingFlap, FB_Fly, FB_Glide, FB_TailSway, FB_Celebrate; Fly and WingFlap
  follow the beat timing in `flameBirdMotion.js`), then gltf-transform: dedup, prune, resample, WebP textures (colour
  2048 px, normal and roughness/metal 1024 px) and EXT_meshopt_compression (about 2.4 MB). The UVs and painted textures
  are the original model's.
- Drawn at runtime by `src/components/scene/FlameBird.jsx` (Blue and White re-colour the texture by brightness).

TODO: record where `phoenix_hawk_model.glb` came from (for example a Meshy AI generation) and confirm the terms that apply
to it before shipping this publicly.

## v2/runner.glb (the v2 player: Aisha)

- Source: Aisha, the heroine of the Frost game, from your own repo `nayeem0963-boop/frostgirl`
  (`public/assets/expedition/aisha.glb`, commit 80f95b2), copied unchanged.
- Per that repo's `docs/FROST.md`, the character is a Meshy AI model (rigged), and its eight animation clips
  (idle, walk, run, sprint, jump, land, slide, celebrate) were exported with Mixamo bone names and merged into one rig by
  its asset script, then optimised (webp textures, quantised geometry; about 56k vertices, 3.2 MB).
- It is drawn at runtime by `src/components/scene/RunnerAvatar.jsx` using the settings in `src/systems/versions/versions.js`.

TODO: confirm the terms that apply to the Meshy-generated mesh (they depend on the Meshy plan it was made under) and to
the Mixamo animations before shipping this publicly.
