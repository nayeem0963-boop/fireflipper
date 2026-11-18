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

## Sundarbans (first 500 m)

The first 500 m of every run is the Sundarbans mangrove delta, recreated for Fire Flipper in the style of the
Bulbuli project's Sundarbans scene (nothing is copied: it is all built from primitives, so no extra assets): pale
teal sky and haze, three parallax layers of faceted mangroves with stilt roots, tidal-water floor with ripples, breathing-root
spikes and grass tufts, dark-bark obstacles with moss / plank caps, daylight lighting, and saturated orbs that stay visible
on the bright background. Between 420 and 500 m the mangroves sink while the mountains rise, and the original scenery
(Ember Valley or Frost Cavern, per theme) takes over. `systems/world/biomes.js` holds the zone data; `SundarbansBackdrop.jsx`
draws it (about 8 instanced draw calls). It is looks only: obstacles, collisions, speed and scoring depend on distance alone, and
`npm run test:biome` checks the fade, the contrast of obstacles against the Sundarbans backdrop, and that no simulation code reads the zone.
In dev builds `window.__fireflipper.game` lets you jump along the track for screenshots.

## Amazon (1000 to 1500 m)

A second scenery zone, recreated in the style of the Bulbuli project's Amazon scene (built from primitives; no assets copied):
tall slender rainforest trunks with buttress roots, boughs and dense faceted crowns in three parallax layers, an overhead leaf
canopy, a leaf-litter forest floor, ferns, swaying hanging vines, soft light shafts and a teal-green haze. Obstacles turn sunlit
wood with bright caps so they stand out against the dark trunks and leaves, and a fall reads "Fell to the forest floor". It grows in over
1000 to 1080 m and fades out over 1420 to 1500 m (scenery sinks while the mountains rise), the group is hidden outside the zone so it
costs nothing elsewhere, and it is about 9 instanced draw calls inside it. Zone data and the blend maths are in
`systems/world/biomes.js` (`BIOMES`, `zoneWeight`, `biomeWeights`); `AmazonBackdrop.jsx` draws it. Looks only: `npm run test:biome`
checks both zones' ranges and fades, that they never overlap, obstacle contrast against each backdrop, and that no simulation code reads them.
