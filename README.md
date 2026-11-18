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
npm run test:sim  # headless gameplay tests (physics, collisions, scoring, track generation), ~10 s
npm run test:route # real-flight-physics proof that generated tracks are survivable, ~2 min
npm run test:bot  # the auto play bot survives thousands of metres at 60/30/20 fps, ~8 min
npm run balance   # scoring balance model: how much of a score comes from distance
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
                        BurstParticles, FlightFx (near-miss streaks, impact ring), HazardField (boulders,
                        lava columns, spinners, fire rings), BirdAuras (shield bubble, magnet rings), EmberParticles, SceneCanvas
    game/               gameplay screen composition (GameScreen)
    ui/                 2D interface: HomeScreen, GameHUD (with StreakMeter and GainFeed), StartPrompt,
                        PauseMenu, GameOverPanel (score ledger), SettingsPanel, icons
  scenes/
    Showcase/           menu-screen 3D scene
    EmberValley/        the journey's scene: composition, camera rig, Environment (fog, lights, lightning),
                        Sky (a four-colour shader), Scenery (instanced parallax layers), Backdrop
  systems/              game logic, independent of React rendering
    game/               createGameSim (the whole simulation, pure JS), the live instance,
                        fixedStep (the fixed-timestep driver, shared with the tests),
                        useGameLoop (bridge into R3F)
    physics/            constants, flight model, 2D collision tests
    obstacles/          patterns, procedural spawner, route planner (fairness proof), moving-hazard
                        timeline (dynamics), renderer capacities, ObjectPool
    bot/                auto play: autopilot (search planner over the real flight model), demo
                        instance, per-section tips
    scoring/            pure scoring helpers; streak tiers and multipliers
    world/              the journey: five environments, blending between them, per-environment
                        obstacle mixes, scenery budget (pure data, shared by generator, renderers, tests)
    input/              input action bus (flap press/release, dive, pause)
    events/             gameplay event bus (start, flap, orb, crash, over)
    audio/              synthesized Web Audio sound effects
  hooks/                React hooks: input binding, audio, render quality, auto-pause
scripts/
  sim-test.mjs          headless tests (npm run test:sim)
  route-test.mjs        survivability search over the real flap physics (npm run test:route;
                        --sight and --sabotage modes, see the file header)
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
- **The journey:** five environments laid end to end. Nothing is ever a hard cut: every visual
  parameter (sky, fog, light, colours, particles, how much of each kind of scenery is standing) is
  blended between neighbours over 70 m either side of each boundary, and each environment's
  obstacles phase in over the same stretch (about half strength at the boundary, full 70 m later).
  A banner announces each new land, low on the screen so it never covers the track.

  | Distance | Environment | Look and atmosphere | Signature obstacles |
  | --- | --- | --- | --- |
  | 0 to 500 m | Volcanic Plains | red-black sky, lava glow, basalt peaks, rising embers | gates, columns, floating rocks, split gates, formations, lava columns |
  | 500 to 1,000 m | Rocky Canyon | amber haze, stepped red cliffs, drifting dust, a faint wind | tunnels, passages, formations, falling boulders |
  | 1,000 to 1,500 m | Floating Islands | dusk-purple sky, islands of stone with a lava glow beneath, slow motes | island chains (slabs to squeeze between), floating rocks, spinners |
  | 1,500 to 2,000 m | Burning Forest | deep red sky, burning trees, flickering firelight, dense sparks | groves (staggered trees to weave), lava columns |
  | 2,000 m on | Ash Storm | grey ash sky and drifting clouds, falling ash blown sideways, wind, rare soft lightning, thick fog | ashfall (volleys of small boulders), spinners, tunnels |

  Each environment draws from its own mix of obstacles (adjacent environments differ by at least a
  quarter of the mix), and the share of moving hazards climbs from 2% in the plains to about a third
  in the storm. After the base curve flattens at 1,600 m, a further ramp (to 3,200 m) tightens gaps
  by up to 0.25 u, narrows spacing and makes moving hazards more common. Gaps never go below 2.7 u.
- **Obstacles** (each has its own colour and silhouette; static pillars and rocks stay brown, and
  take on each environment's tint: sandstone, dusk-purple basalt, glowing charcoal, ash-grey):

  | Type | What it asks of you | First appears |
  | --- | --- | --- |
  | Gate, single column | pass through a gap | start |
  | Floating rocks | pass above or below | 80 m |
  | Split gate | a wide safe opening, or a narrow risky one just above/below it | 150 m |
  | Rock formation | a wall of stacked rocks with one gap | 200 m |
  | Lava columns | geysers on a steady beat: fly high above them, or time the low route | 280 m |
  | Narrow passage | a long tunnel | 400 m |
  | Falling boulders | a red lane glows, then a boulder drops through it and reaches a set height as you arrive | 500 m |
  | Winding tunnel | a tunnel whose corridor steps up and down: precision flying | 500 m |
  | Spinner | a red-hot bar turning at a steady rate: go over, under, or time it | 1,000 m |
  | Island chain | three floating slabs alternately above and below the straight line | 1,000 m |
  | Grove | narrow trees from above and below, with the opening swinging between them | 1,500 m |
  | Ashfall | a volley of three small boulders in lanes ~3 u apart | 2,000 m |
  | Fire ring (bonus) | an optional hoop in open space: fly through its middle for +8 | 120 m |

  Moving hazards always get at least 10.5 m of run-up and never follow each other, so every hard
  moment is followed by a breather. No more than 4 sections start within any 30 m.
- **Risk and reward:** every section has a safe route. Harder routes pay more: the narrow opening
  of a split gate carries a line of four to five orbs (the safe one at most one) and sometimes a
  **gem** (25 points, cyan, only ever on a risky route); spinners and boulders place orbs at the
  height of the danger; lava columns have orbs low between the vents. Fire rings pay 15.
- **Fairness: unavoidable combinations cannot ship.** Horizontal speed depends only on distance, so
  the instant the bird reaches any position is known in advance, and moving hazards are authored
  by what they are doing at that instant (and are pure functions of run time). Every section the
  generator proposes is checked by a route planner (`systems/obstacles/planner.js`): from every
  height the bird could be at when entering it, some route must exist at the conservative climb
  (3.2 u/s) and drop (4.5 u/s) rates, with the bird inflated by a margin (0.1 u static, 0.28 u
  for moving hazards) and a ±0.12 s timing tolerance on moving ones. Moving hazards must also be
  avoidable from *any* height with only 11 u of warning, about what a narrow phone at top speed
  shows (6.7 u of view plus the edge glow). A rejected section is rolled back and re-drawn, and after
  repeated rejections a roomy plain gate replaces it. About 15% of proposals are rejected.
- **Scoring** (all values in `systems/physics/constants.js`):

  | Source | Base points | Multiplied? |
  | --- | --- | --- |
  | Distance | 1 per metre | **never** |
  | Fire orb | 2 | yes |
  | Gem (rare, risky routes only; also banked as currency) | 12 | yes |
  | Fire ring (optional) | 8 | yes |
  | Near miss (passing within 0.3 u; tighter pays more) | 2 to 5 | yes |
  | A second shield while one is held | 10 | no |

  Distance is the backbone of every score and is never touched by the multiplier. Everything
  else is a bonus, paid at the streak multiplier at the moment it is earned.
- **Streak and multiplier:** every orb, gem or fire ring adds 1 to the streak and restarts a
  2.6 s timer. The multiplier is ×2 at 5, ×3 at 14, ×4 at 28 and ×5 at 45 in a row, and the item
  that reaches a tier is paid at it. The streak **ends** if the timer runs out before the next
  collection (a missed opportunity) or if a shield takes a hit for you. Power-ups and near misses
  neither add to nor break it. The HUD shows the multiplier large, the streak length, how many more
  reach the next tier, and the timer draining; a rising chime, a spark burst and a pop play on every
  tier, and a short falling blip when a streak of 3 or more is lost. Orb pickups rise in pitch as
  the streak grows. Every point earned is listed briefly as "+6 Orb ×3", and the game-over
  screen shows where the whole score came from.
- **Collectibles** (each differs in shape as well as colour):

  | Pickup | Look | Effect |
  | --- | --- | --- |
  | Fire orb | gold sphere | score, streak |
  | Gem | cyan diamond | score, streak, banked in your profile (total on the home screen) |
  | Shield | green hexagonal plate | absorbs one collision, then 1.5 s of grace to get clear; a hit on lava becomes a bounce; costs the streak |
  | Magnet | magenta ring | for 8 s pulls orbs within 3.4 u toward you (not gems) |

  Shields and magnets appear about every 260 to 420 m on the safe line, never inside an obstacle.
- **Balance:** `npm run balance` models idealised collectors on real generated tracks with the
  real streak rules. Share of a 3,000 m score that comes from distance: about 83% for a casual
  player (70% of safe-line orbs), 65% skilled (plus 40% of risky ones), 48% elite (90% and 70%),
  and 36% for the impossible every-pickup ceiling. The tests fail if these drop below 75, 60, 42
  and 33%. It is a model, not telemetry: re-tune against real play.
- Best score is saved locally; session best is kept until the page closes. Crashes and pickups can
  only register once (pickups leave the pool immediately, and both the simulation and the store
  guard the end of a run).
- **Portrait screens:** the camera pulls back further and leads the bird more (it sits about 16%
  from the left edge), giving about 1.0 s of visible track at starting speed. Obstacles just beyond
  the right edge also glow along that edge up to 0.45 s before they appear, and the dark gaps between
  glows show where the opening is. The start prompt suggests turning the phone sideways.

### Environments and mobile performance

- **Cheap by construction.** The backdrop is a fixed set of instanced layers (peaks, cliffs,
  islands, trees, clouds); a layer whose environment is not standing is hidden and costs nothing,
  and the most that is ever drawn at once (mid-transition) is 9 backdrop draw calls. The old
  backdrop drew every mountain as its own mesh. Measured in the plains in headless Chromium: **28-57
  draw calls per frame before, 10-38 after** (desktop) and 16-44 before, 10-39 after (phone
  viewport). Geometries 78 to 56, textures 6 to 5. No new texture files: the sky is a tiny
  four-colour shader, the clouds and flames reuse two small canvas textures.
- **One blend per frame.** Fog, background, lights, ground and obstacle tints are a handful of
  uniform writes from one shared blended state; nothing is allocated per frame.
- **Low-power devices** get about 60% of the scenery instances, 5 clouds instead of 8, and a
  smaller particle pool.
- **Forward visibility is protected.** Fog never starts nearer than 14 u or ends nearer than 40 u
  in any environment or transition, light never drops below a floor, glowing obstacle caps are
  drawn without fog (at least 20x brighter than the fog behind them), and storm lightning only ever
  brightens. All checked by the tests. Reduced-motion turns off lightning and light flicker.

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

## Auto play

"Watch auto play" on the home screen starts a demo where a bot flies and the player only watches.
Nothing is scored: no best score, gems, streak or stats are saved, and there is no game-over panel
(the demo restarts itself after a crash). A bar shows the controls (TAP and HOLD keys light up as the
bot presses them) and a tip about the section ahead, "Next land" skips to the next environment, and
"Play it yourself" starts a real run.

The bot (`systems/bot/autopilot.js`) is a receding-horizon search over the game's own flight model
(`stepFlight`/`applyFlap`), looking 2.2 s ahead with three actions per 0.1 s (nothing, tap, tap and
hold). It plans in small slices per frame, compensates for planning latency, and uses the route
planner as a long-range check. It only presses the same inputs a player can.

The run also pauses automatically when the tab is hidden or the window loses focus.
