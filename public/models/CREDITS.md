# Model credits

The in-app list is `src/systems/avatars/credits.js` (Settings > Credits). The two third-party bird models (Honeybell and the Morpho Butterfly)
are CC BY 4.0; FlameBird was made for this game.

## birds/flamebird.glb (FlameBird, the mascot)

- Made for Fire Flipper: a Meshy AI character (the approved "FlameBird 50K" model), rigged and animated in Blender 5.3 by
  the scripts in the FlameBird rig work folder (`fireflipper_upgrade/FlameBird/rig_work`): a 29-bone avian skeleton,
  region-limited weights and five clips (FB_Idle, FB_WingFlap, FB_Fly, FB_TailSway, FB_Celebrate), exported with
  2048 px WebP textures (about 5.2 MB). The mesh, UVs and painted textures are the original model's.
- Drawn at runtime by `src/components/scene/FlameBird.jsx` (Blue and White re-colour the texture by brightness).

TODO: confirm the terms that apply to the Meshy-generated mesh (they depend on the Meshy plan it was made under) before
shipping this publicly.

## v2/runner.glb (the v2 player: Aisha)

- Source: Aisha, the heroine of the Frost game, from your own repo `nayeem0963-boop/frostgirl`
  (`public/assets/expedition/aisha.glb`, commit 80f95b2), copied unchanged.
- Per that repo's `docs/FROST.md`, the character is a Meshy AI model (rigged), and its eight animation clips
  (idle, walk, run, sprint, jump, land, slide, celebrate) were exported with Mixamo bone names and merged into one rig by
  its asset script, then optimised (webp textures, quantised geometry; about 56k vertices, 3.2 MB).
- It is drawn at runtime by `src/components/scene/RunnerAvatar.jsx` using the settings in `src/systems/versions/versions.js`.

TODO: confirm the terms that apply to the Meshy-generated mesh (they depend on the Meshy plan it was made under) and to
the Mixamo animations before shipping this publicly.
