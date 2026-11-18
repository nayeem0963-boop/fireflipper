# Fire Flipper

**Flip. Burn. Survive.** A 3D fantasy arcade game for the browser, coming to `fireflipper.com`.

> Status: **pass 2: core flight gameplay.** Playable one-touch flying with physics, procedural
> obstacles, fire orbs, collisions, scoring, game over and retry. Backend, accounts and deployment
> are intentionally not implemented yet. The firebird is still a placeholder built from primitives.

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
  App.jsx               screen router (home ↔ game), nothing else
  main.jsx              React entry
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
- GLB models will load via drei's `useGLTF` from `public/models/`.

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

Seven birds (Flipper, Bulbuli, Scarlet Macaw, Rainbow Macaw, Blue-and-Yellow Macaw, Toco Toucan, Morpho Butterfly),
each in three skins (Fire, Blue, White): 21 in all. Fire is always free; Blue and White unlock at best scores of
600 and 1,500. Each skin has its own cosmetic trail colours and tints the orb-pickup sparks. Everything is visual:
birds share one hitbox and one physics model (`npm run test:avatars` guards against gameplay fields on a bird).
Bird models are third-party (CC BY 4.0); see `public/models/CREDITS.md` and the in-app credits.

## Progression

Run loop: fly, collect orbs and streaks, dodge for near misses, beat your best, unlock skins, go again with a goal.
`src/systems/progression` holds 19 achievements (distance, collection, near misses, streaks, records), lifetime stats,
a deterministic daily goal (same for everyone each UTC day, with a day streak) and the "next goal" picker. The goal is
shown on the start prompt, new achievements and the daily result appear compactly on the game-over screen, and the
Achievements panel lists everything, including skin unlock milestones. Local only (no accounts or leaderboard yet),
and nothing in it affects gameplay. `npm run test:progression` covers the logic.

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
scenery (sky, ground, mountains, obstacles, orbs, embers, lights, `systems/theme/themes.js`), the game-over wording, and
which bird colour is free: every bird starts in the theme's own colour (Fire in red, Blue in blue), the other warm/cool
colour unlocks at a best score of 600 and White at 1,500. Each theme remembers its own bird choice. Themes are looks
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
slate outcrops give depth. The images are placeholders until higher-resolution versions arrive (see `public/images/backdrop/README.md`). Because the sub-scenes are only 165 m long and the pictures very wide, the slide
is capped (`SLIDE_CAP`, 0.2 units per metre) so the backdrop never outruns the 3D layers.
