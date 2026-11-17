# Fire Flipper

**Flip. Burn. Survive.** A 3D fantasy arcade game for the browser, coming to `fireflipper.com`.

> Status: **pass 2: core flight gameplay.** Playable one-touch flying with physics, procedural
> obstacles, fire orbs, collisions, scoring, game over and retry. Backend, accounts and deployment
> are intentionally not implemented yet. The firebird is still a placeholder built from primitives.

## Tech stack

| Purpose      | Package                         |
| ------------ | ------------------------------- |
| UI           | React 19, plain CSS             |
| Build / dev  | Vite 8 (`@vitejs/plugin-react`) |
| 3D rendering | three.js, React Three Fiber 9   |
| 3D helpers   | @react-three/drei               |
| Game state   | Zustand 5                       |

JavaScript (ES modules) only, no TypeScript. Requires Node.js 22.12+.

## Getting started

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build to dist/
npm run preview   # serve the production build
npm run lint      # ESLint
npm run format    # Prettier (format:check in CI)
npm run test:leaderboard  # replay verification and leaderboard logic
npm run balance   # simulated players of four skill levels: where runs end, score mix (informational)
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
    powerups/ skins/ biomes/   shared display data and pure helpers for those features
    input/              input action bus (flap press/release, dive, pause)
    events/             gameplay event bus (start, flap, orb, crash, over)
    audio/              synthesized Web Audio sound effects (sfx.js) and procedural music (music.js)
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
- **Sections:** gates, single columns, floating rocks, rock formations and narrow passages, plus three moving
  hazards: **swinging gates** (from 150 m; the opening slides up and down) and **lava geysers** (from 260 m;
  a telegraphed glow, then an eruption, on a cycle, with low orbs as bait). Gaps shrink, spacing tightens,
  speed rises (6.5 → 10.5 u/s) and new section types unlock with distance.
- **Falling rocks** (from 200 m): a rock hangs above the ceiling, trembling as you approach, and drops when you are 13
  units away, slamming into the ground just behind you. The fall is tied to your _distance_ (not time), so it
  reaches the same height when you cross it at any speed (slow-mo can't shift it), and the lane below it is
  guaranteed clear. Going over the top is the risky route.
- **Air currents** (from 180 m, only in breathers): zones with streaks rising (an **updraft**: lifts you up to
  4.5 u/s, carries you toward an orb arc) or falling (a **downdraft**: pulls harder than gravity, up to -13.5 u/s,
  so holding on to the orbs takes work). They sit in hazard-free stretches, so a wind-blown bird has nothing to hit.
- **Rhythm:** after every 4-6 hazard sections the track opens into a **breather**: an orb arc and no hazards
  (the last two sections before one come slightly faster, so tension builds and releases).
- **Late game:** past the main ramp (about 1,640 m) the track keeps escalating over the next 2,400 m: gaps
  shrink by up to 0.35, spacing by up to 0.9 and speed rises by up to 1 u/s (to 11.5). Without this a perfect
  player never met anything harder than the 1,640 m track.
- **Moving hazards stay fair:** a swinging gate always has a lane that is open at every moment of the swing
  (at least about 2.5 units wide), so no timing is needed, though timing the wide moment gives more room. A
  geyser never erupts above the corridor it guards. Motion is a pure function of run time since the first flap (or,
  for falling rocks, of distance; `systems/obstacles/dynamics.js`), so replays, the server check and the ghost all see
  the same hazards.
- **Fairness:** each corridor's centre is constrained to be reachable from anywhere the bird could
  have left the previous section, using conservative climb (3.2 u/s) and drop (4.5 u/s) rates. An
  autopilot in `npm run test:sim` survives 40 of 40 random tracks to 3,000 m (late game and moving hazards
  included).
- **Near misses:** passing within 0.28 units of an obstacle's surface without touching it pays a
  "Close call" bonus (3 points). Consecutive close calls within 4 s build a streak that multiplies
  the bonus up to 5x. Tracked in the simulation (`trackNearMiss`) and covered by `npm run test:sim`.
- **Power-ups:** glowing gems float between sections (never before 120 m). **Shield** absorbs one
  hit (lava or obstacle) and gives 1.1 s of grace, **Magnet** pulls nearby orbs for 8 s, **Slow-mo**
  cuts track speed to 70% for 5 s. Pooled in the simulation like orbs.
- **Biomes:** from 500 m to 700 m the scenery blends from Ember Valley to Obsidian Reach (fog,
  lights, peaks, ground and sky). Visual only: obstacle layout and physics are unchanged.
- **Daily challenge:** one seeded track per UTC date, the same for everyone. Daily scores are kept
  per date and apart from the free-play best.
- **Bird skins:** four palettes unlocked by best free-play score (0 / 600 / 1,500 / 3,000), chosen in
  Settings.
- **Scoring:** 1 point per metre plus 5 per fire orb. Orb supply (passage lines every 3 units, a
  trail before 30% of sections) is tuned so orbs make up about 40% of a skilled 3,000 m run (~1,950
  orb points against 3,000 distance points): a bonus, not the main source of points. Best score is
  saved locally; session best is kept until the page closes. Crashes and pickups can only register
  once (orbs leave the pool immediately, and both the simulation and the store guard the end of a run).
- **Portrait screens:** the camera pulls back further and leads the bird more (it sits about 16%
  from the left edge), giving about 1.0 s of visible track at starting speed. Obstacles just beyond
  the right edge also glow along that edge up to 0.45 s before they appear, and the dark gaps between
  glows show where the opening is. The start prompt suggests turning the phone sideways.

### Performance notes

- The game screen and the menu's 3D preview are lazy-loaded, and three.js has its own chunk, so the
  menu UI paints before the 3D code arrives (entry bundle ~74 kB gzip, down from ~328 kB).
- One opaque WebGL context per screen, device-pixel-ratio capped (2 on desktop, 1.25 on low-power),
  and lowered automatically by drei's `PerformanceMonitor` when FPS drops.
- Rendering stops (`frameloop="demand"`) while paused or while a modal covers the menu scene.
- Embers are a single `THREE.Points` draw call mutated in place, with no per-frame allocations.
- Glow comes from additive sprites and emissive materials rather than post-processing.
- Obstacles and orbs are pooled records rendered through InstancedMesh: about 7 draw calls for
  the whole field, with no per-frame allocations. Spark bursts use one pooled `THREE.Points`.
- Procedural textures are disposed on unmount; JSX geometries and materials are disposed by R3F.
- GLB models will load via drei's `useGLTF` from `public/models/`.

### Feel

- **Crash:** a 70 ms real-time hit-pause (the sim waits while the camera shake and FOV punch hold),
  skipped when the OS asks for reduced motion.
- **Sound:** flap pitch and level vary slightly so rapid flapping doesn't sound mechanical.
- **Vibration:** short pulses on orbs, near misses, power-ups, shield breaks and crashes (not flaps), where
  the browser supports the Vibration API (Android Chrome and most desktop Chromium; not iOS Safari). A
  Settings switch turns it off.

### Ghost (daily challenge)

Replaying the daily challenge races a translucent pale ghost of your best attempt today. The track is the same
every attempt, so the ghost is meaningful there (free-play seeds are random, so it has none). The ghost is a
second simulation (`systems/replay/ghost.js`) fed the recorded inputs and stepped in lockstep with the live run,
so it flies exactly the path it did before. Only today's best attempt is kept (in local storage, capped at 6,000
input entries).

### First-run coaching

New players see short hints during their first ~70 m (`RunCallouts`); after that the
`tutorialDone` flag is stored locally and they never return.

## Leaderboard (daily challenge)

Scores for the Daily Fire Challenge are verified by the server instead of trusted. The simulation is
deterministic (seeded RNG, fixed timesteps), so the client records its inputs (`sim.inputLog`, a flat
`[tick, code, ...]` list) and the server re-runs them from the date's seed
(`systems/replay/replay.js`) to compute the real score. A claimed score that does not match is rejected.

```
server/leaderboard.js          validation, replay check, ranking (pure; storage is injected)
netlify/functions/             GET /api/leaderboard, POST /api/scores (Netlify Functions + Blobs)
vite.config.js                 same API in `npm run dev` / `preview`, with an in-memory store
```

- **Rules version:** `systems/game/simVersion.js` (`SIM_VERSION`) must be bumped whenever a change could alter what a seed
  and input log produce (physics, spawning, obstacle behaviour, power-ups, scoring). Boards are keyed by date _and_
  version, the server refuses submissions from an out-of-date page (asking the player to reload), and saved ghosts from an
  older version are dropped. Visual, audio and UI changes do not need a bump.
- **Boards:** one per UTC date; only today and yesterday are open. One row per player (their best), top 100.
- **Rate limits** (`server/rateLimit.js`): 20 submissions per hour per IP, 12 per hour per player id, and 120
  leaderboard reads per minute per IP. Checked before the (expensive) replay; rejected submissions count too.
  Over the limit returns `429` with `Retry-After`. IPs and ids are hashed before they are used as storage keys.
- **Name filter** (`server/moderation.js`): 3-16 letters/numbers/spaces/`_`/`-` (NFKC-normalised), reserved
  staff-like names blocked (admin, moderator, fireflipper, ...), and profanity/slurs caught with the
  [`obscenity`](https://www.npmjs.com/package/obscenity) English dataset, also against the name with separators
  removed (`f_u_c_k`). The error message is generic so it does not reveal what matched.
- **Identity:** no accounts yet. The browser keeps a random player id and a display name (3-16 letters or
  numbers); the id is never sent back to other players.
- **Why only the daily challenge:** its seed is fixed per date, so nobody can grind seeds offline to find an
  easy track. Free-play would need server-issued seeds first.
- **Dev:** `npm run dev` stores scores in memory and resets on restart. Production uses Netlify Blobs, which needs
  the site to be deployed on Netlify (the deploy previews run the functions too).
- **Known limits:** a bot that plays a perfect replay still gets through (replay checks stop edited scores, not
  superhuman play); the name filter misses some things and flags a few innocent names (for example "Dick Tracy"),
  and there is no tool yet to remove a row by hand; rate limits are per IP, so shared networks share a quota, and
  they are not atomic, so a burst of simultaneous requests can slip a few extra through; boards use read-modify-write, so two
  submissions at the same instant can drop one; and rare float differences between browser engines could
  reject a legitimate run.

## Controls

| Action       | Keyboard           | Touch / mouse          |
| ------------ | ------------------ | ---------------------- |
| Flap / start | Space, Up arrow, W | Tap or click the scene |
| Climb higher | Hold the flap key  | Keep your finger down  |
| Dive         | Down arrow, S      | (release and fall)     |
| Pause        | Esc, P             | Pause button           |
| Retry        | Space (game over)  | Retry button           |

The run also pauses automatically when the tab is hidden or the window loses focus.
