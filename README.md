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
                        BurstParticles, FlightFx (near-miss streaks, impact ring), EmberParticles, SceneCanvas
    game/               gameplay screen composition (GameScreen)
    ui/                 2D interface: HomeScreen, GameHUD, StartPrompt, PauseMenu,
                        GameOverPanel, SettingsPanel, icons
  scenes/
    Showcase/           menu-screen 3D scene
    EmberValley/        first level: composition, camera rig, parallax backdrop
  systems/              game logic, independent of React rendering
    game/               createGameSim (the whole simulation, pure JS), the live instance,
                        fixedStep (the fixed-timestep driver, shared with the tests),
                        useGameLoop (bridge into R3F)
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
  It runs at a fixed 120 Hz timestep through `fixedStep.js`, and rendering interpolates between
  steps, so physics is frame-rate independent. The same driver runs in the browser and in the
  headless tests, which compare 30/60/120/240 fps runs and check 75/144 fps and jittery frames. The
  first frame after a pause is dropped so resuming never lurches the simulation forward.
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

- **Flight:** a flap sets upward speed (reach is unchanged: ~1.3 u per tap, ~1.85 u held, which the
  track generator's fairness model depends on). Gravity eases off near the top of a climb for a brief
  hang, and builds as the bird falls, so releasing feels weighted. Holding softens gravity while
  rising. Down/S dives: the dive ramps in over ~0.16 s and relaxes over ~0.22 s instead of snapping.
  The ground is lava, and the ceiling is a soft limit.
- **Body language (visual only):** pitch and bank are damped springs in the simulation, wings beat
  faster while climbing, spread into a glide when falling and tuck in a dive, and the tail and crest
  lag the body. A short squash-and-stretch follows each flap. None of this touches the collider.
- **Near misses:** passing an obstacle with under 0.3 u of clearance (one cue per 0.35 s) emits a
  `nearMiss` event: light streaks along the bird's edge, a few sparks, a whoosh that is louder the
  closer the shave, and a tiny FOV pulse. No score effect yet.
- **Impacts:** a crash freezes the world for ~75 ms (hit-stop), then sparks and rock chips fly back
  along the flight line, an expanding ring flashes, and the camera wobbles briefly. Lava has its own
  version (embers thrown up, a flattened splash ring, a hiss). The crash event carries its `cause`.
- **Camera:** the view widens slightly with speed and dives and leads a little toward the direction
  of travel, all capped (total FOV change <= 4.5 deg, framing shift <= 0.25 u). With
  `prefers-reduced-motion` the shake and FOV effects are cut to a fraction.
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
