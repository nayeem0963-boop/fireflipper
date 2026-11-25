# Fire Flipper

**Flip. Burn. Survive.** A 3D fantasy arcade game for the browser, coming to `fireflipper.com`.

> Status: **pass 2: core flight gameplay.** Playable one-touch flying with physics, procedural
> obstacles, fire orbs, collisions, scoring, game over and retry. Backend, accounts and deployment
> are intentionally not implemented yet.

## Tech stack

| Purpose         | Package                       |
| --------------- | ----------------------------- |
| UI              | React 19, plain CSS           |
| Build / dev     | Vite 8 (`@vitejs/plugin-react`) |
| 3D rendering    | three.js, React Three Fiber 9 |
| 3D helpers      | @react-three/drei             |
| Game state      | Zustand 5                     |

JavaScript (ES modules) only, no TypeScript. Requires Node.js 22.12+.

## Getting started

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build to dist/
npm run preview   # serve the production build
npm run test:sim  # headless gameplay tests (physics, collisions, scoring, track fairness)
```

To test on a phone or tablet on the same Wi-Fi network: `npm run dev -- --host`, then open the
printed network URL.

## Project structure

```
public/                 static assets served as-is
  models/ textures/ audio/ images/
src/
  App.jsx               screen router (home ↔ game, and the Art Lab), nothing else
  main.jsx              React entry
  art/                  the Art Lab, a standalone 3D artwork playground (see "Art Lab" below); lazy-loaded
  store/
    useGameStore.js     Zustand store: screens, run status, HUD values, settings
  components/
    scene/              3D building blocks: Firebird, PlayerBird, ObstacleField, OrbField,
                        BurstParticles, EmberParticles, SceneCanvas
    game/               gameplay screen composition (GameScreen)
    ui/                 2D interface: HomeScreen, GameHUD, StartPrompt, PauseMenu,
                        GameOverPanel, SettingsPanel, icons
  scenes/
    Showcase/           menu-screen 3D scene
    EmberValley/        first level: composition, camera rig, parallax backdrop
  systems/              game logic, independent of React rendering
    game/               createGameSim (the whole simulation, pure JS), the live instance,
                        useGameLoop (fixed-timestep bridge into R3F)
    physics/            constants, flight model, 2D collision tests
    obstacles/          patterns, procedural spawner (fairness rules), ObjectPool
    scoring/            pure scoring helpers
    input/              input action bus (flap press/release, dive, pause)
    events/             gameplay event bus (start, flap, orb, crash, over)
    audio/              synthesized Web Audio sound effects
  hooks/                React hooks: input binding, audio, render quality, auto-pause
scripts/
  sim-test.mjs          headless tests (npm run test:sim)
  styles/               global tokens + per-screen CSS
  utils/                storage, device detection, fullscreen, math, procedural textures
```

### Architecture rules

- **Rendering** lives in `components/scene` and `scenes/`. It reads simulation state each frame and
  never owns game rules.
- **Simulation** (`systems/game/createGameSim.js`) is plain JavaScript with no React or Three.js.
  It runs at a fixed 120 Hz timestep, and rendering interpolates between steps, so physics is
  frame-rate independent. The same code runs in the browser and in the headless tests.
- **Game state** that the UI reacts to lives in the Zustand store. Per-frame data (positions,
  velocities, pooled obstacles) stays in the simulation. The store only receives discrete events
  (start, crash, game over) and HUD snapshots at 10 Hz, only when values change.
- **Coordinates:** x is distance along the track. The bird always sits at x = `distance`, and
  renderers draw everything at `x - distance`, so the world scrolls toward the bird.
- **Input** goes through `systems/input/inputBus.js`: keyboard and pointer events become abstract
  actions (flap press/release, dive, pause), so gamepad support and remapping can slot in later.
- **Feedback** (sound, particles) subscribes to `systems/events/gameEvents.js` and never touches
  game rules.

### Gameplay rules

- **Flight:** a flap sets upward speed. Holding softens gravity while rising (a higher climb), and
  releasing lets gravity take over. Down/S dives faster, with a smooth recovery afterwards. The ground
  is lava, and the ceiling is a soft limit.
- **Sections:** gates, single columns, floating rocks, rock formations and narrow passages. Gaps
  shrink, spacing tightens, speed rises (6.5 → 10.5 u/s) and new section types unlock with distance.
- **Fairness:** each corridor's centre is constrained to be reachable from anywhere the bird could
  have left the previous section, using conservative climb (3.2 u/s) and drop (4.5 u/s) rates. An
  autopilot in `npm run test:sim` survives 40 of 40 random tracks to 3,000 m.
- **Scoring:** 1 point per metre plus 5 per fire orb. Orb supply (passage lines every 3 units, a
  trail before 30% of sections) is tuned so orbs make up about 39% of a skilled 3,000 m run (~1,950
  orb points against 3,000 distance points): a bonus, not the main source of points. Best score is
  saved locally; session best is kept until the page closes. Crashes and pickups can only register
  once (orbs leave the pool immediately, and both the simulation and the store guard the end of a run).
- **Portrait screens:** the camera pulls back further and leads the bird more (it sits about 16%
  from the left edge), giving about 1.0 s of visible track at starting speed. Obstacles just beyond
  the right edge also glow along that edge up to 0.45 s before they appear, and the dark gaps between
  glows show where the opening is. The start prompt suggests turning the phone sideways.

### Performance notes

- One opaque WebGL context per screen, device-pixel-ratio capped (2 on desktop, 1.25 on low-power),
  and lowered automatically by drei's `PerformanceMonitor` when FPS drops.
- Rendering stops (`frameloop="demand"`) while paused or while a modal covers the menu scene.
- Embers are a single `THREE.Points` draw call mutated in place, with no per-frame allocations.
- Glow comes from additive sprites and emissive materials rather than post-processing.
- Obstacles and orbs are pooled records rendered through InstancedMesh: about 7 draw calls for
  the whole field, with no per-frame allocations. Spark bursts use one pooled `THREE.Points`.
- Procedural textures are disposed on unmount; JSX geometries and materials are disposed by R3F.
- GLB models load via drei's `useGLTF` from `public/models/birds/`. The Fire Eagle (`fire-eagle.glb`, ~100 kB)
  is re-skinned in `FireEagle.jsx`; the Firebird stands in while it loads. See `public/models/CREDITS.md`.

## Controls

| Action        | Keyboard           | Touch / mouse            |
| ------------- | ------------------ | ------------------------ |
| Flap / start  | Space, Up arrow, W | Tap or click the scene   |
| Climb higher  | Hold the flap key  | Keep your finger down    |
| Dive          | Down arrow, S      | (release and fall)       |
| Pause         | Esc, P             | Pause button             |
| Retry         | Space (game over)  | Retry button             |

The run also pauses automatically when the tab is hidden or the window loses focus.

## Bird customisation

Three birds (FlameBird, Honeybell (the blue-and-yellow macaw) and Morpho Butterfly),
each in three skins (Fire, Blue, White): 9 in all. FlameBird, the Fire Flipper mascot, is first and is the bird a new player starts with (a saved choice of Honeybell or Morpho is kept; a save that chose a bird no longer offered shows FlameBird); it is a rigged model whose real flight clip drives its wings, and its Fire skin shows the model's own painted colours. Bulbuli, the Rainbow Macaw, the Toco Toucan and the Fire Eagle have been removed (their code and model files are gone; a save that chose one shows FlameBird). The Flipper and the Scarlet Macaw are also out of the list; the Flipper's model remains only as the gold Celestial reward skin. Fire is always free; Blue and White unlock at best scores of
600 and 1,500. Each skin has its own cosmetic trail colours and tints the orb-pickup sparks. Everything is visual:
birds share one hitbox and one physics model (`npm run test:avatars` guards against gameplay fields on a bird).
Honeybell and the Morpho Butterfly are third-party models (CC BY 4.0); FlameBird was made for this game; see `public/models/CREDITS.md` and the in-app credits.
The Fire Eagle (`public/models/birds/fire-eagle.glb`) is the one skeletal model: `FireEagle.jsx` plays its `Fly` clip from the flight state and
re-skins it with the avatar's 8-colour palette, a flame shell and glow sprites. It falls back to the Firebird while loading.

## Search engines and sharing (SEO)

The game is one page (`https://fireflipper.com/`) drawn on a canvas, so its search presence is the page head plus a block of real text inside `#root` of `index.html` that React replaces when the game loads (crawlers and visitors without JavaScript see it; it also paints before the JavaScript arrives). What is there, all checked by `npm run test:seo` against a real production build:

- **Head:** a 41-character title, a 153-character description, a canonical URL on the production domain, a robots directive (`index, follow` with large image previews), Open Graph and X/Twitter card tags (`summary_large_image`) with the social image `public/images/og-image.jpg` (1200 x 630, 98 KB, the canyon painting with the game's title; only crawlers download it), language, theme colour, icons (`favicon.ico`, the SVG, 192/512 px PNGs, `apple-touch-icon.png`) and `site.webmanifest`.
- **Structured data:** one JSON-LD block with a `WebSite` and a `VideoGame` (free, single player, browser). It states only what is true: no author, publisher, rating or review.
- **Crawlable text:** one `h1` ("Fire Flipper"), then `h2`s: Five worlds, How to play, Features. The game's own home screen has the same single `h1`.
- **Files:** `public/robots.txt` (allow all, names the sitemap), `public/sitemap.xml` (the one URL), `public/404.html` (custom, `noindex`, links home; Netlify serves it for unknown URLs).
- **Previews stay out of search:** a Netlify deploy preview or branch deploy (`CONTEXT` is not `production`) is built with `noindex, nofollow` and a `robots.txt` that disallows everything (`vite.config.js`); its canonical still points at the production domain.
- **Cache rules:** the new small files are revalidated (`public/_headers`).

To do by hand (they need your accounts): add `https://fireflipper.com/` in Google Search Console (and Bing Webmaster Tools), submit `https://fireflipper.com/sitemap.xml`, request indexing of the home page, and make sure the Netlify primary domain is `fireflipper.com` (redirect `www` to it) so it matches the canonical URL. Update `lastmod` in `sitemap.xml` when you ship a notable change.

## Game versions

The menu lists **v1 (Original)** and **v2 (New Runner)**. Switching is instant (no reload), the choice is saved, and `?version=v1` /
`?version=v2` opens straight into a version (a link beats the saved choice).

- **v1 is the original flying game**, exactly as it was: you fly a bird (and skin) through corridors of rocks, over a lava floor.
- **v2 is a ground-runner.** You run as **Aisha** (from the Frost game) **on the land**: the floor of whichever of the five worlds you are in (canyon
  dust, snowfield, starlit sea, pink floor, cloud sea), with no lava. TAP jumps, HOLD jumps higher (a quick release is a short hop), and Down drops
  fast. Its own obstacles are low rocks, ice spikes and fallen logs to jump, and pits (crevasses) in the land to jump across, each drawn in the
  world's own palette, with orb lines on the ground and orb arcs over what you jump. Flying-only layers (hazards, flying hazards, power-ups) are off.
- **Shared by both:** the five worlds and their scenery, the 10,000 m journey and its milestones, the run speed curve, the scoring, the HUD, the
  controls, the effects and **Auto play** (each version has its own bot).
- **Progress is separate per version:** best score, stats, achievements, the daily goal and the journey record are kept per version, so a runner score
  is never compared with a flyer score. v1 keeps the original storage keys, so nothing already saved moves.

How it is built:

- `src/systems/versions/versions.js`: the registry (`GAMES_CONFIG`). v1 is the baseline; v2 is v1 plus overrides: a `ruleset` (`'flight'` or `'runner'`)
  and `playerConfig` (`avatarType`, `assetPath`, `scale`, `offset`, `centre`, `rotation`, `upright`, `clips`, `trailColor`).
- `src/systems/runner/`: the runner simulation (`createRunnerSim.js`), its movement (`physics.js`), constants (`constants.js`), obstacle generator
  (`track.js`) and Auto play bot (`autopilot.js`). It has the same outward shape as the flying simulation, so the loop, HUD, events and scene work
  with either. It never reads an avatar or a version; the store and the scene choose the simulation (`hooks/useGameSim.js`).
- **Fair by construction:** her full jump is known exactly, so a section is only built when one held jump clears all of it (at the slowest speed it can
  be met at), pits are held well under a jump's reach, and there is always room to land, react and jump again. `npm run test:runner` re-checks every
  section on 24 full tracks and has the bot fly the finish line on many seeds.
- `components/scene/PlayerAvatar.jsx` draws the avatar for a version; `PlayerBird` only places the player from the simulation. v2 draws Aisha
  (`public/models/v2/runner.glb`, from `nayeem0963-boop/frostgirl`; see `public/models/CREDITS.md`) with `RunnerAvatar.jsx`: idle while waiting, a run
  cycle matched to the ground speed (no sliding feet), a jump pose while rising, a fall pose while dropping, and a stumble when the run ends. If the
  file is missing, the v1 bird stands in (with one console note). `RunnerObstacleField.jsx` draws v2's obstacles and pits.
- **To use a different runner:** replace `public/models/v2/runner.glb` (or change `assetPath`), then tune `scale`, `offset`, `rotation`, `upright` and
  `clips` in `versions.js` so her feet stand on the land and she faces +X.
- `npm run test:versions` and `npm run test:runner` guard all of this, including that neither simulation can see a version or an avatar.

## Progression

Run loop: fly, collect orbs and streaks, dodge for near misses, beat your best, unlock skins, go again with a goal.
`src/systems/progression` holds 19 achievements (distance, collection, near misses, streaks, records), lifetime stats,
a deterministic daily goal (same for everyone each UTC day, with a day streak) and the "next goal" picker. The goal is
shown on the start prompt, new achievements and the daily result appear compactly on the game-over screen, and the
Achievements panel lists everything, including skin unlock milestones. Local only (no accounts or leaderboard yet),
and nothing in it affects gameplay. `npm run test:progression` covers the logic.

## Art Lab (3D artwork playground)

A standalone place to experiment with digital 3D artwork: shaders, lighting, procedural geometry, materials and camera
moods. It has no game loop, no score and no physics, and shares nothing with the runner except the app shell (the canvas
wrapper, the buttons and the theme).

**Open it** with the **Art Lab** card beside the v1 / v2 picker on the home screen, or go straight to it with `/?art` (handy for a bookmark or
for `npm run dev`). **Leave it** with the back button or `Esc`. It is a separate lazy-loaded chunk (about 19 kB plus one
small chunk per piece), so players who never open it never download it.

**Controls** (a panel on the right; a bottom sheet on a phone; `H` hides it for a clean view or a screenshot):

| Control | What it does |
| --- | --- |
| Piece | Switch the artwork (`[` and `]` step through them) |
| View | Camera presets Hero / Close-up / Overview (`1` `2` `3`), Reset view (`R`), Pause / Play (`Space`), Save PNG, global speed, colour palette |
| Helpers | Studio room, grid, axes, wireframe |
| Piece parameters | Sliders, switches, selects and colour pickers built from the piece's own schema |

Everything you set (piece, parameters, palette, camera preset, speed, helpers) is remembered between visits under its own
storage key. The camera is a normal orbit camera: drag to orbit, scroll or pinch to zoom, right-drag to pan.

**The fourteen pieces** (each is a definition plus a component in `src/art/pieces/`; every one responds to Speed, Pause, the four palettes and the quality tier):

| Piece | What it is | Made with |
| --- | --- | --- |
| Ribbon Knot | A ribbon twisted along a torus knot, with a counter-ribbon | Generated geometry (`geometry/ribbonKnot.js`), physical metal |
| Iridescent Study | A noise-pushed sphere ringed by glass | A hand-written `ShaderMaterial` (fresnel rim, thin-film hue) and `MeshPhysicalMaterial` transmission |
| Light Orbit | Breathing metal forms lit by three circling coloured lights | One `InstancedMesh`, real point lights, halos |
| Vortex Core | Nested wireframe tori round a pulsing orb, with orbiting embers | Grid-line geometry (`geometry/torusGrid.js`), GPU embers (`shaders/pointFields.js`) |
| Fractal Lattice | A matrix of cubes that swell, rise and turn as noise flows through | One `InstancedMesh` driven by CPU fractal noise (`noise.js`) |
| Quantum Prism | A faceted gem that splits a beam into a fan of colour, turning on two axes | Flat-shaded lathe gem (`geometry/diamond.js`), transmission with dispersion |
| Starlight Canopy | A spiral galaxy of tens of thousands of stars, with rings of light | `geometry/galaxy.js`, a vertex shader that turns and twinkles the stars |
| Cyber Helix | Two metal strands with rungs and pulses racing up and down | Tube geometry along a helix (`geometry/helix.js`), glowing points |
| Bioluminescent Lotus | Low-poly petals that open and close round pulsing stamens | `geometry/petal.js`, flat shading, glowing points |
| Monolith Grid | An obsidian slab over a neon terrain that ripples where you touch it | A displaced plane with grid lines drawn in the fragment shader (`shaders/terrain.js`), pointer events |
| Plasma Sphere | A boiling, sun-like sphere with glowing veins and a corona | A displaced sphere with a heat-ramp shader (`shaders/plasma.js`) |
| Neural Landscape | A grid of glowing points rolling in waves, coloured by height | Points whose heights and colours are written into the geometry each frame |
| Particle Dancer | A dancer in arabesque made of thousands of glowing points, with swirling ribbons, on rolling waves of particles | A procedural point-cloud figure (`geometry/dancer.js`) animated in a vertex shader (`shaders/dancer.js`), sine-wave terrain points, glowing `Line` ribbons; blue-purple-gold or the active palette |
| Solar System | The Sun and its eight planets on elliptical orbits, with Earth's moon, the asteroid belt and Saturn's rings (a showcase: not to scale) | Plasma-shader Sun with a real point light, procedurally painted planet textures (`geometry/solarSystem.js`) in natural colours or the active palette, orbit lines, name labels, point-cloud belt and stars; the camera may travel further out (`maxDistance`) |

**Bloom** (the **Bloom** section of the panel, on by default): the scene is drawn into a high-dynamic-range buffer, everything brighter than the *threshold* is blurred at several scales, and the blur is added back with the chosen *strength* and *radius*. It uses the post-processing passes that ship with three.js (`EffectComposer`, `UnrealBloomPass`, `OutputPass`), so it needs no extra dependency, and it is a separate lazy chunk (`src/art/Bloom.jsx`), loaded only when it is switched on. Turning it off gives rendering back to react-three-fiber exactly as before. **Save PNG** includes the bloom. The pieces' additive halos (`src/art/Glow.jsx`) and reflections from a procedural environment built from `Lightformer`s (nothing is fetched from the network) still work with it off. With bloom on, the whole picture goes through tone mapping, so backdrops and unlit colours look a little darker and more contrasty than with it off.

### How to add a new artwork

A piece is two files in `src/art/pieces/` and one line in the registry.

1. **The definition**, `myPiece.js`: pure data, so the tests can check it without a browser.

   ```js
   export default {
     id: 'my-piece',                    // lowercase slug, unique
     title: 'My Piece',
     blurb: 'One sentence about it.',
     params: {                          // the HUD builds its controls from this
       speed:  { type: 'range',  label: 'Pulse',  min: 0, max: 3, step: 0.05, default: 1 },
       style:  { type: 'select', label: 'Style',  options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], default: 'a' },
       glow:   { type: 'toggle', label: 'Glow',   default: true },
       tint:   { type: 'color',  label: 'Tint',   default: '#ff7a2a' },
     },
     // Optional:
     camera: { hero: { position: [5, 2, 7] } },   // override a camera preset for this piece
     lighting: 'dark',                              // 'studio' (default) or 'dark' (the piece lights itself)
     backdrop: 'black',                             // optional: a deep black room instead of the palette's backdrop
     floorY: -3,                                    // where the grid and floor sit
   };
   ```

2. **The component**, `MyPiece.jsx`: ordinary react-three-fiber content. It receives four props and returns scene content
   (no `<Canvas>`, no lights are required: the stage already has studio lighting and a reflection environment).

   ```jsx
   import { useRef } from 'react';
   import { useFrame } from '@react-three/fiber';

   export default function MyPiece({ params, palette, clock, quality }) {
     const mesh = useRef();
     useFrame(() => { mesh.current.rotation.y = clock.current.t * params.speed; });
     return (
       <mesh ref={mesh}>
         <icosahedronGeometry args={[1, quality === 'low' ? 2 : 5]} />
         <meshStandardMaterial color={palette.colors[0]} metalness={0.9} roughness={0.2} />
       </mesh>
     );
   }
   ```

   - `params`: the current, already validated values (every key in your schema).
   - `palette`: `{ id, name, colors: [4 hex], accent, light, bg: [2 hex] }`, so a piece follows the palette switcher.
   - `clock`: `{ current: { t } }`, art time in seconds. It already includes the speed setting and stops on Pause, so
     read `clock.current.t` instead of keeping your own time.
   - `quality`: `'high'` or `'low'`. Use it to cut vertex counts, instances and transmission on phones.
   - Shared helpers you can reuse: `usePaletteColors(palette)` (the palette as three.js colours), `Glow` (an additive halo), `noise.js` (seeded random and CPU noise), `shaders/noise.js` (GPU simplex noise) and the point shaders in `shaders/pointFields.js`.
   - Wireframe, grid, axes, the camera presets and Save PNG work for every piece with no extra code. Rebuild geometry
     in `useMemo` (not per frame) and dispose what you create in a `useEffect` cleanup.

3. **Register it**, one line in `src/art/pieces/index.js`:

   ```js
   import myPiece from './myPiece.js';
   // ...
   piece(myPiece, () => import('./MyPiece.jsx')),
   ```

`npm run test:art` then checks the new piece's id, schema (ranges, defaults, options), camera overrides and that its
component file is registered, that its component reads the shared clock and the palette (so Speed, Pause and the themes work), and that every slider default sits on its own step, and fails if anything in `src/art` imports the simulation or the game scenes.

**Files:** `src/art/` holds `ArtLabScreen.jsx` (screen and keys), `ArtStage.jsx` (lights, environment, controls, camera
rig, helpers), `ArtHud.jsx` and `ParamControls.jsx` (the panel), `useArtStore.js` (its own small store), `params.js`
(schemas), `palettes.js`, `cameraPresets.js`, `geometry/`, `shaders/` and `pieces/`; the styles are `src/styles/art.css`.

## Auto play (watch-only)

The home screen's **Watch auto play** button starts a bot that flies the real game while you watch. It searches 1.2 s
ahead over the real flight physics and obstacles (`src/systems/bot/autopilot.js`), shows its inputs as TAP / HOLD
lights, and offers **Play it yourself** and **Exit**. Nothing is scored or saved (no best score, stats, achievements or
daily progress), and there is no game-over screen: if the bot ever crashes it restarts. **This feature must stay in
every future version unless the owner says otherwise** (see `CLAUDE.md`); `npm run test:autoplay` guards it.

## Testing and performance

`npm run test:all` runs the headless suites: simulation (physics, collisions, orbs, scoring, track fairness),
avatars (cosmetic-only birds), progression, auto play and the run-lifecycle store (pause/resume, retry/reset,
game over). `npm run test:e2e` drives the production build in a browser on desktop and on phone portrait and
landscape (needs Playwright). The 3D scenes are lazy-loaded so the menu paints first (initial JS about 284 kB);
obstacles, orbs and the mountain layers are instanced meshes, so a gameplay frame is about 47 draw calls, and
particle systems use fixed buffers (no per-frame allocation).

## Themes (red / blue)

A Red | Blue switch on the home top bar (and in Settings) restyles the whole game. **Red** is the original Ember
Valley; **Blue** is a Frost Cavern. A theme changes the interface colours (CSS variables, `styles/global.css`), the
scenery (sky, ground, mountains, obstacles, orbs, embers, lights, `systems/theme/themes.js`), and the game-over wording.
It does not colour the birds: a bird's colour is its own choice in every theme (Fire is free for every bird, Blue unlocks
at a best score of 600 and White at 1,500), and switching theme keeps the bird you picked. Themes are looks
only: the simulation has no theme input, and `npm run test:theme` checks both themes define every colour, that
obstacles and orbs keep strong contrast against the background, and that a run is identical in both.

## Arctic Ice Shelf (1500 to 2000 m)

The second scenery zone, built the same way as the canyon from three arctic paintings (`public/images/backdrop/arctic-*.jpg`): an ice shelf under an aurora
with a peach horizon. Each painting is cropped at its horizon, sized from the camera so it fills the view, and dissolves into the next at about 1720 m and 1860 m
(the last two are near-identical renders, so that handover is subtle). The snowfield, the slate outcrops and a research camp (orange dome tents, snowmobile, radio
mast, flagged cairn) are 3D, so there is depth and parallax. The paintings only load from 1380 m on. The Amazon cross-fades into it around 1500 m, and it fades back
to the original Ember Valley / Frost Cavern scenery by 2000 m, so the four zones hand over with no gap. Obstacles keep the original themed look here. The painted
zones share `ZoneParts.jsx` (the painting blend, the gradient sky and the parallax layers).

**Edge warning on pale scenery.** In portrait the screen-edge warning for approaching obstacles used additive glow, which washes out to white on the pale
pale scenery (the canyon, the arctic, the palace) and hides the gaps. There it now draws normal-blended bars in the theme's deep daytime colour, pale for far and saturated for near.

## Celestial Realm (2000 to 3000 m)

The fifth zone is a night of floating crystal cities among galaxies, a ringed planet and pastel nebulae, from three cosmic paintings (`public/images/backdrop/celestial-*.jpg`). They
are whole scenes, not horizon bands, so each fills the sky (scaled to cover the view, with no edge ever showing) and slowly **slides as you fly**: the view starts on the floating cities
at 2000 m and climbs through the swirling galaxy to the planet, nebulae and comet by 3000 m. The paintings dissolve at about 2330 m and 2660 m (the three share one sky, so only the cities
change). The floor is a starlit cloud sea, and small floating crystal islands (grass top, rock underneath, pastel spires) drift past at two depths and bob gently, all instanced. The Arctic
cross-fades into it around 2000 m, and it fades back to the original scenery by 3000 m. The paintings load only from 1880 m.

Obstacles keep their shapes here but turn dark indigo with glowing cyan caps, and floating rocks get a glowing cyan outline, so they read against the black void, the pastel nebulae
and the pale crystal spires alike (`npm run test:biome` checks the contrast against every backdrop colour, in the paintings' palette). Colliders are untouched, and a fall reads "Fell through the clouds".
Nothing in the simulation reads the zones.

## Rose Sky Palace (3000 to 5000 m)

The sixth zone, the longest at 2,000 m, is a pink-and-gold sunset over white filigree palaces with floating islands, waterfalls and a mirror-still pool, from three palace paintings
(`public/images/backdrop/palace-*.jpg`). Each painting is scaled to about 1.6 times the visible height with its **waterline on the horizon**: the sunset sky and palaces fill the view above it, and a 3D lavender
pool with golden lantern glints and soft reflection streaks takes over below it. The pictures drift slowly sideways as you fly and dissolve into each other at about 3660 m and 4330 m (over 70 m, longer than
elsewhere because the scenes differ a lot). Small floating white-stone islands with pink trees bob past at two depths. The Celestial Realm cross-fades into it around 3000 m, and it fades back to the original
Ember Valley / Frost Cavern scenery by 5000 m. The paintings load only from 2880 m.

Obstacles keep their shapes but turn **deep teal with white caps** (the colours opposite pink), and floating rocks get a white outline, so they read against the pink sky, the white stone, the dark wood and the crimson
foliage; `npm run test:biome` checks the contrast against every backdrop colour. A fall reads "Splashed into the palace pool". Daytime orbs and the portrait edge warning use their pale-scenery looks here.
The scene's lights, fog and sky now blend over every zone in a loop (`ZONE_IDS` in `systems/world/biomes.js`), and recoloured obstacle sets are generated per zone (`TINTED_ZONES` in `ObstacleField.jsx`), so adding
another zone is mostly data. Nothing in the simulation reads the zones.

## Red Rock Canyon (0 to 1500 m)

The first 1500 m is a red sandstone canyon at sunset, from three paintings (`public/images/backdrop/canyon-*.jpg`), **one for each 500 m**: an arch and a misty gorge (0 to 500 m), pillars and a natural bridge in the low sun
(500 to 1000 m), a winding river canyon (1000 to 1500 m). Each painting is a whole scene, scaled to about 1.55 times the visible height with its valley floor on the horizon: the cliffs, arches and sunset sky fill the view above it, and a
dusty faceted 3D canyon floor takes over below it. They drift slowly sideways as you fly and dissolve into each other at 500 m and 1000 m (over 60 m); red sandstone mesas stand at two depths for parallax. Only the first painting loads at
start-up (about 140 kB); the others load from about 250 m and 750 m. It cross-fades into the Arctic around 1500 m.

**Retired scenes.** The Sundarbans and Amazon scenery and the Volcanic Coast backdrop that used to fill this range are gone (their images are deleted). The animal and plant obstacle looks built for them (tigers, crocodiles, bats, beehives, toucans, jaguars,
sloths, morpho butterflies, ridged tree-trunk poles, rock pillars) are **kept in the repo but not live**: `components/scene/obstacleStyles.js`, `animalModels.js` and the geometry helpers still build them, `ACTIVE_OBSTACLE_LOOKS` in `systems/world/biomes.js` is empty,
and `npm run test:obstacles` still checks their sizes against their colliders. To bring a look back, add its id to `ACTIVE_OBSTACLE_LOOKS` and map a track range to it in `obstacleStyleAt`. (They were last live in commit `9a63602`.)

**Obstacles and orbs in the canyon.** Obstacles keep their shapes but turn deep indigo with cream caps, and floating rocks get a cream outline, so they read against the orange rock, the purple-pink sky and the dark shadows. Orbs are a cream core in a deep violet halo (they would
vanish orange-on-orange otherwise), and the portrait edge warning uses deep violet bars. `npm run test:biome` checks the contrast of all of these against every backdrop colour from the paintings. Nothing in the simulation reads the zones.

## Continuous moving environment, step 1: scroll driver

`src/systems/world/scrollDriver.js` holds the pure functions that turn the run distance (`sim.renderDistance()`) into scenery offsets:
layer speeds far 0.05 / mid 0.25 / near 0.7 world units per metre, seamless looping (`loopOffset`), and the sideways slide of the painted
backdrops (`paintingSlide`). Each painting now slides across its whole stretch of the run (it used to crawl at about 1% of its width) and is
sized so it never shows an edge. Offsets depend only on distance, so they are frame-rate independent, freeze on pause and use no wall clock.
`npm run test:scroll` covers this (part of `test:all`).

### Step 2: painted depth layers

With the `depth` prop, `PaintedHorizon` draws each painting three times through the same texture: the whole picture (far), the side cliffs through a
soft alpha mask (mid) and the near edges (near). The layers slide at 0.05 / 0.08 / 0.10 units per metre (`DEPTH_SLIDE`), aligned at the middle
of each painting's stretch, so any ghosting is largest at the ends of the stretch, where the painting is dissolving anyway. On for the canyon,
celestial and palace zones; the arctic zone is replaced in step 4. Cost: two extra draw calls per visible painting, no extra textures.

### Step 3: foreground layer

`ForegroundLayer.jsx` adds a thin strip of low props (canyon rocks, snow mounds, crystals, blossom bushes) standing on the floor 8 units in front of the
camera, along the bottom edge of the screen. Placement maths is in `src/systems/world/foreground.js`: a prop's top is always kept below the screen position
of the ground at the front of the gameplay plane (minus a margin), so nothing can cover the bird, an obstacle, an orb or an edge warning. When the camera rides
high the strip falls off-screen and nothing is drawn. Props are world-fixed (they move with the track), instanced (one draw call per live zone, at most two
during a cross-fade), non-colliding, and read only `renderDistance()`. `npm run test:foreground` checks the safety rule with a real camera across aspects,
heights and fields of view.

### Step 4: Frosty Polar (1500 to 2000 m)

The arctic zone is now **Frosty Polar**, with three sub-scenes from the owner's panoramas: Glacier Valley (1500 to 1665 m), Crystal Ice Canyon (1665 to 1830 m)
and Aurora Lake (1830 to 2000 m), dissolving over 40 m at 1665 and 1830 m with their horizons aligned. The old arctic paintings and research camp are gone; 3D ice crystals and
slate outcrops give depth. The art is the owner's 16:9 set (1408x792 here; see `public/images/backdrop/README.md`). Because the sub-scenes are only 165 m long, the slide
is capped (`SLIDE_CAP`, 0.2 units per metre) so the backdrop never outruns the 3D layers.

### Step 5: ambient animation and texture lifecycle

- **Texture lifecycle** (`residency` in `scrollDriver.js`, used by `PaintedHorizon`): a painting loads when the run passes its `loadAt` and its texture is disposed 100 m after the end of its stretch
  (or after a restart far before it); a load that finishes after its painting was unloaded is freed at once. The first canyon painting is never unloaded, so a retry starts without a reload.
  Later Celestial and Palace paintings now load about 150 m ahead each (`loadAt`) instead of all at once. Peak painting texture memory drops from 61.5 MB (all twelve) to about 23 MB.
- **Ambient animation** (`systems/world/ambient.js`, `AmbientEffects.jsx`), driven only by the run distance: 40 drifting particles per zone, one draw call, all behind the flight plane (canyon dust, snow,
  rising sparkles, petals), and an aurora shimmer (additive curtains) over Crystal Ice Canyon and Aurora Lake. Island bobbing now follows the distance too, so scenery no longer uses the wall clock.
  `EmberParticles` and the bird animations still use the clock (they are not scenery scrolling).
- `npm run test:ambient` covers residency, the memory budget, particle safety and the no-wall-clock rule. In development `window.__fireflipper.gl` exposes the renderer for stats.

### Cloud Sanctuary (5000 m onwards, endless)

This replaces the original scenery after 5000 m (the owner's later request): the Cloud Sanctuary zone starts at 5000 m (cross-fading with the palace) and never ends. Its five paintings are shown for 1000 m each (dragon, cat, deer, tiger,
empty clouds) and the cycle repeats for ever (`cyclePlan` in `scrollDriver.js`, `LoopingPaintings` in `ZoneParts.jsx`). At most two paintings are on the GPU at a time (the next loads 150 m ahead, the previous is
disposed 100 m after the cut). Obstacles keep their original look. The zone weights now add up to 1 at every distance, so the original mountains never come back.

### Step 6: test matrix

- `npm run test:fps` (part of `test:all`): every distance-driven scenery value at the 19 test distances (0, 450, 500, 950, 1000, 1450, 1500, 1665, 1830, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000 m) is identical for runs rendered at 30, 60 and 120 fps and with uneven pacing, and
  no value changes between two frames by more than the run's own movement.
- `npm run test:matrix` (needs Playwright; starts the dev server, so not part of `test:all`): all 19 distances on desktop 1534x630, phone portrait and phone landscape (no page or console errors, painted scene, HUD on screen, draw calls <= 70, GPU textures <= 32), then pause (scenery frozen
  at a canyon, a Frosty and a sanctuary distance), three retry laps (GPU textures do not grow), and a 0 to 20000 m soak. `MATRIX_ONLY=pause,retry` runs only some parts.

### Canyon obstacle redesign, phase 1: geometry and fairness contract

`src/components/scene/canyonRocks.js` builds the canyon's new obstacle geometry (hoodoo shaft and cap, rock fin, arch lintel, passage slab, boulder) from the owner's four reference paintings, as vertex-coloured faceted
low-poly meshes (about 700 triangles for all six). Nothing is wired into the game yet. Collision is unchanged, so every shape keeps a contract with its collider (never narrower than the hitbox, a flat gap face, boulders at least as
large as their circle); `npm run test:rocks` checks it against the real geometry. Preview: `npm run dev`, then `/gallery.html?set=canyon&z=17`.

### Canyon obstacle redesign, phase A: polygon colliders (switched off until phase C)

`src/systems/obstacles/rockShapes.js` defines the outlines of the canyon's hoodoos, rock fins, arch lintels, arch spans, ledges and boulders and the convex polygons the simulation collides with
(`shape: 'poly'` in `collision.js`: a union of convex quads, allocation-free). Which look an obstacle gets comes from a hash of its position, so generated tracks are unchanged (a test compares a fingerprint of 8 seeds out to
3000 m with the one recorded before). Shapes only apply before `WORLD.rockShapesEnd` (1500 m, the canyon's end) and only add room around the guaranteed corridors. They are behind `ROCK_SHAPES.enabled`, which stays
off until the matching geometry is drawn, so the game plays exactly as before for now. `npm run test:colliders` covers it.

### Canyon obstacle redesign, phase B: geometry from the collider outlines

`src/components/scene/canyonRocks.js` is rebuilt from the same outline tables as the colliders (`systems/obstacles/rockShapes.js`): a pole's rings sit exactly on the outline's control points, with vertices on the left and right extremes, so the
silhouette across the track is the collider's outline. `poleInstances()` lists the instances that draw one pole (a head, whole stem segments or a stretched foot), the same placement list the tests assemble.
Eleven pieces, one InstancedMesh each: hoodoo head and segment, lintel head and segment, fin head (up and down) and foot, arch band, ledge band, slab body, boulder (about 650 triangles all together). Not drawn in the game yet (phase C).
`npm run test:rocks` compares the assembled silhouettes with the real colliders (worst difference 0.0000); preview with `npm run dev` and `/gallery.html?set=canyon&z=26&cx=3`.

### Canyon obstacle redesign, phase C: drawn and collided in the canyon

Before 1500 m the canyon now has hoodoos, rock fins (rising and hanging), arch lintels, arch spans over terraced ledges (passages) and faceted boulders, drawn from the geometry of phase B and collided with the
polygons of phase A (`ROCK_SHAPES.enabled`, on by default; set it to `false` in `systems/obstacles/rockShapes.js` to bring the original indigo canyon obstacles and their colliders back, in one line). Each pole's draw list is
worked out once when it spawns, so the renderer allocates nothing per frame. Passage slabs are a band at the gap face plus stacked 3-tall blocks of layered sandstone. From 1500 m on, obstacles are unchanged.

### Canyon obstacle redesign, phase D: readability tuning

The rock palette is checked against the canyon paintings (median luminance of the band behind the gameplay area, 0.09 to 0.15, measured): the body colour is `#ee8434` (2.0:1 against the brightest median), sunlit strata and tops 2.9:1 and 4.1:1, shade `#e2632f` 1.5:1,
and only the undersides (`#b84a2c`) blend in. `npm run test:rocks` keeps these ratios. Browser matrix on the phase C build: 62 cases, at most 61 draw calls and 27 GPU textures.

### Zone obstacle kits (canyon redesign applied to the other zones), step 1: infrastructure and Frosty Polar

The canyon's rock obstacles became a general system of per-zone **kits** (`KITS` in `systems/obstacles/rockShapes.js`): each kit lists its pole looks (rising and hanging; `capped` = a head and a repeating stem, `blade` = tip to foot), a passage's arch span and
ledge shape, and a palette (`KIT_STYLE` in `components/scene/rockSets.js`). The simulation picks the kit from the track position (`KIT_STARTS`, checked against the scenery zones' starts) and each shape's look from a hash of its position, so generated tracks stay
identical. Colliders and geometry come from the same tables for every kit (`npm run test:colliders`, `npm run test:rocks`). Built so far: **canyon** (hoodoos, fins, lintels) and **Frosty Polar** (ice spires, ice blades, icicles, ice keystones, an ice arch over a snow-capped shelf, ice floes).
Switch a kit off with `ROCK_SHAPES.kits.<kit> = false` (the zone's original obstacles and colliders come back); every zone now has a kit. Draw calls: about 33 of the frame's total are the player bird, up to about 24 the two zones' scenery at a border and up to about 20 obstacles; the matrix budget is 80.

### Zone obstacle kits, step 2: Celestial City and Rose Sky Palace

**Celestial City** (2000 to 3000 m): crystal gems on beaded stems and monoliths rising, hanging shards and crystal clusters, a star-gate arch over a cloud ledge, glowing asteroid boulders, in bright lavender crystal with white highlights (the paintings are dark, median luminance 0.10 to 0.19).
**Rose Sky Palace** (3000 to 5000 m): fluted marble columns with capitals and obelisks rising, finials and corbels hanging, a grand arch over a terrace, garden-stone boulders, in deep teal marble with white capitals (the paintings are bright, 0.25 to 0.30).
Same rules and tests as the other kits (`npm run test:colliders`, `npm run test:rocks`: silhouette equals collider, nothing in a guaranteed corridor, tracks unchanged, palette readable against the zone's paintings).

### Zone obstacle kits, step 3: Cloud Sanctuary

**Cloud Sanctuary** (5000 m onwards): bulging cloud pillars and golden spires rising, hanging pendants and gilded keystones, a cloud arch over a ledge, cloud-puff boulders, in sapphire stone banded with white and white caps
(the paintings are bright, median luminance 0.38 to 0.51, and the figures wear sapphire robes). Every zone from 0 m to infinity now has its own obstacle kit; the tests cover all five (`npm run test:colliders` flies six tracks to 6400 m and checks 3,500 obstacles and about a million corridor points,
and a corridor-following bot to 5800 m on 16 seeds). Draw calls at the 5000 m border: up to about 70.

### Biome hazards, phase 1: the modifiers, the flight hooks and the bot (now on by default)

`src/systems/hazards/biomeHazards.js` holds the hazard rules of each zone as **pure functions of the run distance** (no clock, no random numbers, so pause, retry and stage changes need no reset and generated tracks are unchanged):
`hazardsAt(d, fx, corridors)` fills the bird modifiers (gravity scale, flap strength, a vertical acceleration for updrafts and gusts, the flap carry and dive recovery for the frosty slide) and `obstacleHazard(o, d, out)` the dynamic state of an obstacle
(brittle canyon caps, phase barriers, pistons, bobbing platforms; every offset points away from the obstacle's corridor). Every window is telegraphed 0.65 s ahead (`LEAD_S`), and a zone's hazards fade in and out over 40 m at its borders.
`flight.js` takes an optional `fx` (identical physics without it, checked bit for bit); the simulation computes `sim.hazard` each step and the Auto play bot plans with the same function. `HAZARDS.enabled` is **on by default** (every hazard is telegraphed, see phase 3); `?hazards=0` switches them off for comparison or rollback. `npm run test:hazards` covers it.

### Biome hazards, phase 2: reserved runway and obstacle hazards in the collisions (on by default)

- **Reserved runway.** The bird-modifier windows (updraft, gust, low-gravity pocket) are only allowed in open space, but the track left only 3 to 7 m between sections, so on real tracks they acted on about 3% of the canyon and nowhere else. With the hazards on, the spawner now keeps every section out of a window's band
  (`runwayAfter` in `biomeHazards.js`: the window, its 0.65 s telegraph and the settling room), drawing no random number. Windows are rarer (`every`: 140 m canyon, 120 m frosty, 160 m sanctuary) and now act on 9.4% of the canyon, 6.0% of Frosty and 10.5% of the Sanctuary, at their full nominal length;
  the cost is 11% fewer obstacle sections over a run. With the hazards off (`?hazards=0`) the spawner is unchanged. Because they are now on by default, **generated tracks differ from the versions before the hazards** (same seed, fewer and shifted sections). (`speedAt` moved to `systems/physics/speed.js` to avoid a circular import; the spawner still re-exports it.)
- **Moving and phasing obstacles.** The simulation computes `o.dy`, `o.solid`, `o.pulse`, `o.rumble`, `o.dyn` for every obstacle from the bird's distance. The bird is tested in the obstacle's own moved frame (`b.y - o.dy`), a phased-out barrier is skipped (no hit, no near miss), and moving obstacles use an 85% hitbox
  (the bird radius shrinks by `DYNAMIC_INSET`, about 0.054; static shapes keep exact silhouettes). The Auto play bot plans with the same function. The renderer applies `dy` to every piece; until phase 3 a passable phase barrier is simply not drawn.
- Tests: `npm run test:hazards` now also covers the telegraph on real tracks (80 windows, 0.62 to 0.65 s), the reserved bands, the collisions (a retracted piston's vacated space is survivable and the unmoved collider would have hit; a translucent barrier is passable and a solid one kills) and Auto play to 5600 m.

### Biome hazards, phase 3: the telegraphs (on by default)

Everything the player must see before a hazard acts is drawn (nothing is drawn or computed with `?hazards=0`). Pure maths in `systems/hazards/telegraph.js`, the renderer in `scenes/EmberValley/HazardTelegraph.jsx`:
- **Windows** (updraft, gust, low-gravity pocket): a soft column with crisp edge lines over the stretch of track, brightening through the 0.65 s lead and pulsing while it acts, plus particles inside it (rising heat, blowing snow, slow glints).
  The canyon's updraft is warm additive light; Frosty Polar's gust (blue) and the Sanctuary's low gravity (violet) are tinted with darker particles, because additive white vanished on snow and cloud (the particle colours are tested against the paintings' measured luminance).
- **Phase barriers** (Celestial City): drawn as a dithered translucent ghost while passable (three's `alphaHash` with a per-instance alpha, so no sorting and no depth problems), firming up over their warning, then solid. They glow warm just before they turn solid.
- **Pistons** (Palace): a glowing rail beside the pole spanning its travel, brighter just before the piston comes back. **Brittle caps** (canyon): a warm glow and a tremble of at most 0.05 (inside the moving obstacles' 15% forgiveness) before the cap sinks.
- **Bobbing platforms** (Sanctuary) bob (they move with their colliders). They do not tilt: a tilted slab would no longer match its collider.
- Draw calls: the telegraph is 4 draw items with at most 3 visible at once; with the hazards on the zone-border peak stays at 78 on phone (the budget is 80). Everything stands behind the gameplay plane or beside an obstacle, so it cannot cover the bird, an obstacle or an orb.
`npm run test:matrix` now runs with the hazards on; `MATRIX_HAZARDS=0 npm run test:matrix` runs it with them off.

### Biome hazards, phase 4: sign-off (on by default)

- **Stress and soak.** `npm run test:hazards` now also crosses every zone border at 21 offsets (84 runs: no exception, every value finite, a reset mid-window leaves nothing behind). `npm run test:hazards-soak` (minutes, not part of `test:all`; run it alone, a busy machine inflates the timings):
  the corridor-following bot flies 60 of 60 seeds to 8 km and Auto play 10 of 10 to 5.6 km with the hazards on; Auto play's planning takes a median of 1.4 ms (p99 5.4 ms) with them on against 1.1 ms (p99 3.7 ms) off; the hazards add about 1.5 us to a 120 Hz simulation step (0.02% of its budget);
  `hazardsAt` costs about 0.09 us and `obstacleHazard` about 0.23 us per call.
- **Browser.** `npm run test:e2e` runs every flow with the hazards on and also loads the production build with `?hazards=0` on desktop and both phone layouts, running Auto play for 8 s and a manual run with no page or console error. `npm run test:matrix`: 62 cases, at most 61 draw calls and 28 GPU textures; with the hazards on the zone-border peak is 78 on phone (budget 80).
- **On by default.** `HAZARDS.enabled` is `true` in `systems/hazards/biomeHazards.js`; `?hazards=0` turns them off (rollback: set it to `false`). Not yet tried on a physical phone; force strengths and window frequency are untuned by feel. The flag is read once at load: switching it mid-run is not supported (obstacles keep their last hazard state until the next retry).

## Journey to the Celestial City (the original adventure, release edition)

*Five worlds. One extraordinary journey.* The run is now a journey with a finish line at **10,000 m**. This supersedes the older notes above that give the world borders as 1,500 / 2,000 / 3,000 / 5,000 m and the Sanctuary as endless.

- **Worlds (one source of truth: `src/systems/world/worlds.js`).** Canyon 0-2,000 m, Frosty Polar 2,000-4,000, Celestial Realm 4,000-6,000, Rose Sky Palace 6,000-8,000, Cloud Sanctuary 8,000-10,000. The scenery zones (`BIOMES`), the obstacle kits and the hazards (`KIT_STARTS`), the painting dissolves and preloads (`paintingCuts`: each world's paintings share its 2,000 m equally; the five Sanctuary paintings get 400 m each) and the aurora all derive from it. The borders belong to the world that starts there, are crossed once, in order, and depend on distance only.
- **Difficulty (`spawner.js`, `patterns.js`, `constants.js`).** Before, difficulty and speed reached their maximum at about 1,600 m and stayed there. Now difficulty climbs in a straight line from 0 (at 40 m) to 1 at the finish line (world averages 0.1, 0.3, 0.5, 0.7, 0.9), so there is no step at any border, and the speed ramp is stretched from 1,500 m to 6,000 m. Nothing is harder than the old maximum (same gaps and spacing at the end). The hard patterns arrive later: boulders after 250 m, wall formations after 600 m, tunnels (the canyon's arches) after 1,000 m. **This makes the first worlds noticeably easier and slower than before: it is a deliberate change that has not been playtested by a human.**
- **Milestones.** The simulation announces a `MILESTONE` event when the bird survives a border (2,000 / 4,000 / 6,000 / 8,000 m); a compact banner under the HUD shows "World N completed" for 3.6 s (it ignores the pointer, never pauses anything, one at a time). A crash in the same step as a border wins: nothing is announced.
- **The ending.** The track stops building 40 m before the line. Crossing 10,000 m alive moves the simulation to a new `COMPLETE` phase (once; a crash wins a same-step tie; scored distance is exactly 10,000 m): obstacles stop, input is ignored, the bird glides on untouchable. The screen shows a 6.8 s celebration over the live scene (the Celestial City painting fades in, "Journey Complete", sparkles; skippable with Skip, Enter or Escape after 1.2 s so the last taps cannot skip it; plain results at once under reduced motion), then the final screen (distance, score, orbs, worlds 5/5, rewards, Replay Journey / View Rewards / Return to Main Menu). No camera change was made. Auto play reaching the line just restarts, with no rewards.
- **Rewards (`src/systems/rewards/rewards.js`).** Treasure Cache at 2,000 m; Celestial City Orb at 4,000 m; Celestial Bird Skin at 8,000 m; Journey Champion Trophy and **Celestial Feather** (legendary, the primary prize) at the finish line. 6,000 m has a banner only. Granting is pure and idempotent, happens only when the simulation reports a survived milestone, and is saved at once in localStorage (`fireflipper:journey`, through the existing `utils/storage.js`; a corrupt save is sanitised). Replaying never grants twice; opening the collection grants nothing. The Celestial skin is a gold Flipper (`REWARD_AVATARS`, outside the 18-skin collection) equipped from the Rewards screen; like every bird it is cosmetic only (a test checks that no gameplay module imports avatars, skins or rewards).
- **Screens.** `RewardsPanel` (collection, locked/unlocked, rarity, how to earn, progress), `JourneyEnding` (celebration and final screen), `MilestoneToast`, a Rewards button and the edition title on the home screen, rewards and worlds lines on Game Over. Reward art is original inline SVG (`RewardArt.jsx`); the reference sheet is not shipped.
- **Tests.** `npm run test:journey` (boundaries, difficulty, milestones, the ending and its races, rewards, persistence across a "refresh", UI wiring); the rest of `test:all` was updated to the new borders (the golden layout fingerprint now compares shapes on against off). `test:e2e` and `test:matrix` pass (77 cases, at most 61 draw calls, 27 textures).
- **Not verified:** nothing was run on a physical phone (only emulated viewports in Chromium with software GL); the ending's sound and timing were not heard or felt; the new difficulty feel needs human play; Auto play was only checked headlessly to 10 km.

### Journey Preview (watch the whole journey, nothing is saved)

A secondary button on the home screen, next to "Watch auto play". The Auto play bot flies a verified track seed from 0 to 10,000 m through all five worlds, with the normal transitions, the milestone banners (marked "preview", with the rewards each one *would* give), the full ending and a final screen that is clearly labelled "Journey Preview · nothing was saved" (Watch Again / Exit Preview). It can be left at any time (Exit in the overlay, the back button, Exit Preview). If the bot ever crashes it starts the next verified seed, so it keeps going until a journey is flown to the end (the bot completed 40 of 40 seeds in a headless check).

- **Three modes, kept apart.** Normal Play (real rewards and progress); Auto play (`demo`: the bot, nothing saved, no banner or ending, as before); Journey Preview (`demo` + `preview`). The preview is Auto play plus a second flag, so every guard that already ignored Auto play also ignores it.
- **Isolation, in layers.** (1) The store only writes progression (journey and rewards, best score, stats, achievements, daily goal, flown) through `persistProgress`, which refuses while `demo` or `preview` is set, whoever calls it. (2) `endRun` and `milestoneReached` have their own preview branches that return before the real path and never read or write the real journey record. (3) The simulated rewards come from `systems/rewards/preview.js`, a pure module with no storage or store access. (4) The simulation, physics, collisions, scoring, spawner, hazards and bot know nothing about the preview (a test checks the sources). Nothing about flight, difficulty, borders, scoring or the reward schedule was changed.
- **Same routing as the game.** The loop's event-to-store routing moved to `systems/game/routeEvents.js` so the tests run exactly what the game runs.
- **Tests.** `npm run test:preview` flies a whole preview through the real simulation, bot and store against a seeded fake localStorage: it reaches exactly 10,000 m and the ending, four preview banners, five simulated rewards; storage is byte-identical and not one write happens; the real state objects are the same; exiting clears every flag; a normal run afterwards grants and saves the real rewards; and the races (a milestone or completion after a crash, a second completion, a contradictory flag state, plain Auto play reaching the line, every flag combination) change nothing. `test:e2e` also starts the preview on all three layouts, checks it is labelled, and checks that exiting leaves saved data untouched. The preview's sound (milestone chime, finish fanfare) plays as in real play; plain Auto play stays quiet about them.

## Score orb families (painted orbs, one per world)

The orbs are five painted spheres, one per world, in journey order. Purely visual; collection (a circle test of 0.35 + the bird's radius on `orb.x` / `orb.y`), hitboxes, values, spawn rate and positions, scoring, physics, obstacles, difficulty and borders are untouched (`npm run test:orbs` checks the sources and that a seed's orbs are the same).

| Family | World | Picture |
|---|---|---|
| Solar | Red Rock Canyon | the sun: molten gold plasma |
| Frost | Frosty Polar | a frosted crystal sphere with an icy blue core |
| Cosmic | Celestial Realm | a violet glass sphere with a galaxy and runes |
| Nature | Rose Sky Palace | an emerald glass sphere with ferns and glowing roots |
| Celestial | Cloud Sanctuary | a pink glass sphere with a galaxy and angel wings |

- **Artwork:** `public/images/orbs/orbs.webp` is one 960 x 192 atlas (58 KB, with transparency), one 192 px cell per family, cut from the five supplied paintings (see the README there for how). It is one texture, loaded once; until it arrives, the glow discs alone mark the orbs.
- **Adapted for play:** the picture is drawn 1.0 across (about the old glow's size, inside the unchanged collection reach) with **no outline, border or underlay**: just the painting. A brightness multiplier steers readability: the two darkest pictures are lifted (Cosmic 1.55, Nature 1.45) and the two palest deepened a little (Frost and Celestial 0.85). Motion: a gentle bob, a size pulse and a rocking tilt (not a spin, which would turn the painted highlights), with a different phase for every orb.
- **Distribution** (`systems/world/orbFamilies.js`, pure): a world's orbs are its own family, except that through the second half of the world a growing share (up to 40%) are the next world's family, so a border is a gradual mix; the last world is pure Celestial. The family is chosen per 30 m cluster by a hash of the position (a trail stays one family; no random numbers; the same every run). Roughly 87-95% of each world is its own family.
- **Readability:** without an outline the pale glass pictures (Frost on the snow, Celestial on the pale clouds) are the faintest. The obstacles' flat-colour contrast rule says little about a detailed painting, so the test only checks the brightness rule above; judge these two on a phone.
- **Cost** (`components/scene/OrbField.jsx`): one InstancedMesh per family that has an orb on screen (hidden otherwise): about 1 to 2 draw calls (no glow disc any more), the same as or fewer than the old orbs. One 0.98 MB texture (peak 28 of 32). Ten orbs on screen cost about 300 triangles; the old sphere orbs cost 3,600. Nothing is allocated per frame. The bob, pulse and tilt (at most 0.15, 14% and 0.35 rad) only move the picture, never the simulation's orb.
- The theme's old orb colours (`scene.orbCore`, `orbHalo`, the canyon's `orbs`) are no longer used by the orbs (they still feed the edge-warning bars and their tests); the orbs look the same in the red and blue themes. (An earlier procedural version of the five families was replaced by these pictures.)

## Power-ups: the magnet and the shield

Two rare pickups, drawn from two supplied pictures (a magnet in a golden bubble, a winged gold shield in a blue bubble) cut out with no outline and colour-graded per world (`public/images/powerups/powerups.webp`: 5 worlds by 2 kinds, 192 px cells, 99 KB; see `ItemField.jsx`). The rules are in `systems/powerups/powerups.js` and enforced by the simulation; `npm run test:powerups` covers them.

- **Magnet:** 8 s. Score orbs within 4 m drift toward the bird (14 m/s); an orb still counts only when the existing circle test says it touches the bird, and scoring is unchanged (an orb is 5). Picking up another refreshes the 8 s.
- **Shield:** lasts 15 s (`SHIELD_S`; a second shield refreshes the timer) and absorbs ONE crash (an obstacle, the lava or a flying hazard); if the timer runs out first it is gone unused. The HUD shows the seconds left (blinking in the last 3 s, as does the bubble). On a crash: the bird is put back in the middle of the section's guaranteed gap (or bounced off the floor), is immune for 1.5 s (flickering bubble), and the shield is spent. A second crash after the immunity is fatal. A crash in the step that crosses the finish line is saved and the journey still completes once; without a shield it is a crash, never a completion.
- **Where:** about ten in the journey, one every 800 to 1,200 m, alternating magnet and shield. A due item goes 5 m before the next obstacle section that has no orb trail, in line with the middle of that section's guaranteed gap (reachable by construction), so it is never inside a section or an active hazard window and never overlaps an orb. No random number is drawn for an item: every generated obstacle and orb is identical with and without power-ups (`POWERUPS.enabled = false` removes the items; a test compares them).
- **Feel and feedback:** items are 1.3 across (orbs 1.0) and bob, pulse and rock; the HUD pill shows the magnet's seconds and the shield icon with its seconds left while held; a soft bubble surrounds the bird while shielded; pickup and shield-break sounds. The shield also has no effect on the rules for any bird: every bird flies the same.
- **Auto play and Journey Preview** treat items like orbs when planning, and picked up some on every journey in the tests (two full journeys to the finish line). Nothing about power-ups is saved.
- **Budgets:** with items on screen, 49 to 56 draw calls and up to 30 GPU textures (the new atlas adds one when an item first appears; the budget is 32, so there is little headroom left).
- **Balance note:** the magnet raises score potential and the shield makes the first mistake free, so the early worlds feel easier (the 15 s shield timer limits how long it can wait for a mistake); this is new gameplay and has not been playtested by a human.

## Flying hazards (five effects, one new type per world)

Five effects from the supplied paintings cross the sky toward the bird, introduced one world at a time and kept in the later ones (cumulative). The rules, schedule, paths and hit tests are pure functions in `systems/fliers/fliers.js` (enforced by the simulation, planned with by Auto play, drawn by `FlierField.jsx`); `npm run test:fliers` covers them. No outline: each is cut out of its painting with soft transparency and colour-graded for every world it appears in (`public/images/hazards/`, built by `scripts/build-hazard-atlas.py`).

| World | New hazard | Role |
|---|---|---|
| 1 Red Rock Canyon | crystal burst (id `smoke`) | **harmless** burst of fire crystals (ice crystals in the cold worlds, graded per world) that drifts across, drawn behind the obstacles, orbs and bird (it can never hide anything) |
| 2 Frosty Polar | fire ring | **gate**: a hoop to fly through |
| 3 Celestial Realm | energy ring | **gate** |
| 4 Rose Sky Palace | ember tornado | **lethal** (a tall capsule) |
| 5 Cloud Sanctuary | metal disc | **lethal** |

- **Gates:** only the TOP and BOTTOM of a ring's rim are lethal. Seen from the side a hoop's left and right rim cannot be avoided when flying through it, so they are not lethal; the bird passes if its centre is within about 0.57 m of the ring's centre, or it can simply go round. (An earlier draft made the whole rim lethal, which made flying through impossible: a test caught it.)
- **Forgiveness:** lethal shapes use 75% of their drawn size (and the rim's middle 75%). A shield absorbs a hit: it puts the bird in a ring's hole or clear above or below the shape, with the usual 1.5 s immunity.
- **Flight:** each hazard flies toward the bird on a straight line in (distance, track x) and sways on a sine; its place is a pure function of the bird's distance, so it is frame-rate independent, frozen by pause, reset by a retry, and Auto play predicts it exactly. It is visible from the right edge, at least about 1.4 s (disc) to 3 s (crystal burst) before it can touch. Every hazard is animated (looks only, the hitbox never moves): the disc spins and throbs, the fire and energy rings spin (in opposite directions) and flicker, the tornado twists and squeezes, the crystal burst tilts and pulses; all driven by the bird's distance, so a pause freezes them.
- **Schedule:** about 30 events: one every ~400 m in World 1 down to ~200 m in World 5 (jittered by hashes). The first event of a world after 400 m into it is always the world's new type; after that the new type and the older ones alternate. Never within 120 m of another, never overlapping a biome hazard window.
- **The track makes room:** every event reserves a band `[e - 8, e + 22]` m; the spawner starts the next obstacle section after it (the same way the biome hazards reserve runway). No random number is drawn, so the sections are the same sequence, just shifted. **This lowers the obstacle density a little (about 5% in World 1 to 11% in World 5) and changes generated tracks again**; with `?fliers=0` (or `FLIERS.enabled = false`) there are no hazards and no bands.
- **Auto play and Journey Preview** plan with the same functions and flew two whole journeys through every hazard in the tests. Tests that fly a corridor-following bird, which cannot dodge, run with the hazards off.
- **Budgets:** one extra 960 x 576 texture (153 KB); with hazards, orbs and both power-ups on screen 53 to 54 draw calls.
- **Balance note:** this adds new lethal hazards and fewer obstacle sections; the feel of every world after World 1 has changed and has not been playtested by a human.

## The Flipper is a blue-and-yellow macaw

The original bird (`components/scene/Firebird.jsx`, still built from primitive shapes) is redesigned as a blue-and-yellow macaw: cobalt-blue back and head, long, narrow, swept-back blue wings whose trailing edge is a row of separate flight feathers, over a yellow wing lining, a green forehead, a yellow breast and belly, a white face patch with a dark chin strap, a big dark hooked beak, and a long graduated tail of five leaf-shaped blue feathers with yellow tips. The flame crest and the fire-coloured plumes are gone; its trail is now a blue shimmer with gold sparks.

- **Colourways:** the Flipper's base colour (still called "Fire", like every bird's base colour) is the macaw's own blue and yellow (an empty palette: the bird's defaults). Blue and White recolour the same macaw, as does the gold Celestial reward skin; each defines its own `crown`, `face` and `chin` colours (`systems/skins/skins.js`, `avatars.js`).
- **Cosmetic only:** the same size, animation system (wing beats, tuck, limp, secondary motion) and 0.36 hitbox as before; the simulation never reads the avatar (`npm run test:avatars` checks the design and that).
- **There is now also a separate "Blue-and-Yellow Macaw" bird** in the picker (a GLB model, wings spread), which looks similar; it was left as it was.
