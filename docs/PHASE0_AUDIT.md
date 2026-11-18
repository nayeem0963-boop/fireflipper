# Fire Flipper — Phase 0 Gameplay Audit

Scope: read-only audit of the codebase at commit `44239da`. No gameplay code was changed.
Method: read every file under `src/` and `scripts/`, ran `npm run test:sim` (34/34 pass) and
`npm run build` (OK, one 1.19 MB / 328 KB gzip chunk), and measured the flight envelope and
difficulty curve headlessly against the real simulation. Numbers below marked *(measured)* come
from those runs; the rest come from reading code. Nothing was tested in a real browser or on a
device, so rendering, feel and touch findings are code-derived and labelled as such.

---

## 1. Executive summary

The core is a clean, small (~3.2k lines), well-separated codebase: a pure-JS fixed-timestep
simulation, thin R3F renderers, a Zustand store for UI state and two small event/input buses. It
is a good foundation for the roadmap, and most of what the later phases need to *plug into*
already exists.

What does **not** exist, and the roadmap should not assume it does:

| Roadmap assumption | Reality |
| --- | --- |
| "Preserve… bird customization" | **There is no customization system.** Bird colours are a hard-coded `COLORS` constant in `Firebird.jsx`; there is no skin selection, storage, or UI. Only the placeholder bird exists. |
| "Power-up systems, if already implemented" | **None.** Only fire orbs. |
| Progression / achievements / missions | **None.** Persisted state is `bestScore`, `soundEnabled`, `quality`. |
| Daily Fire Challenge | UI card says "Coming soon". The sim *is* seed-deterministic, so it is feasible. |
| Multiple environments | One hard-coded level (Ember Valley); world constants are global. |
| Mobile dive | Dive is keyboard-only. Touch players cannot dive. |

Biggest gameplay weaknesses (detail in §3): difficulty plateaus at ~1,500 m and a simple
autopilot clears 3,000 m on 40/40 seeds; orbs are free (never risk/reward) and flat-valued; no
pacing variety in the track; no resume grace after pause; portrait look-ahead is shorter than one
section at top speed; and a device-detection bug puts every Safari/Firefox user on the "low"
render tier.

---

## 2. System-by-system findings

### 2.1 Flight physics & bird movement — `systems/physics/flight.js`, `constants.js`
**What exists.** Gravity −22, flap sets `vy` to 7.6 (+30% carry of remaining upward speed), hold
reduces gravity ×0.7 *only while rising*, dive ×2.1 gravity to −17 with smooth recovery (30 u/s²),
rise cap 9, fall cap −11, soft ceiling at y = 4.4, lava floor at y = −3.2. Pure functions over a
plain `bird` object. Collision radius 0.36.

**Measured feel envelope:**
- Single tap: rises **1.28 u** over 0.33 s. Tap-and-hold: **1.84 u** over 0.48 s.
- Flap then no input → lava in **1.01 s** from start height.
- Spamming flaps pins the bird to the ceiling (y = 4.40) — fine on its own, see 3.2.
- Horizontal speed 6.5 → 10.5 u/s, linear over the first 1,500 m.

**Strengths.** Responsive (input applied on the next 8.3 ms step), bounded, deterministic,
frame-rate independent (test compares 120 Hz vs 240 Hz).

**Weaknesses.**
- Hold is a "bigger single flap" rather than a distinct skill: it only matters during the rise,
  so there is no sustained-glide or fine height control beyond tap cadence.
- Ceiling is a free safe zone: hanging obstacles are the only counter. The gap clamp
  (`ceilingY − gap/2 − 0.2`) keeps corridors reachable, but there is no ceiling hazard or cost.
- `flapCarry`/`maxRiseSpeed` interaction caps rapid tapping (rise cap 9 vs impulse 7.6), which is
  good for fairness but means tap-spam and skilled play converge on similar altitude gain.

### 2.2 Controls — `hooks/useGameInput.js`, `systems/input/inputBus.js`, `GameScreen.jsx`
**What exists.** Keyboard (Space/↑/W flap+hold, ↓/S dive, Esc/P pause) and pointer events
(mouse/touch/pen) are normalised into abstract actions. Multi-touch aware (hold lasts until the
last pointer lifts), blur clears held state, context menu suppressed, retry guarded for 450 ms.

**Strengths.** Clean abstraction (gamepad/remapping can slot into `inputBus`). Good guard against
accidental retry. Input on HUD buttons never flaps (pointer bound to the play surface).

**Weaknesses.**
- **No dive on touch.** The start prompt hides the dive tip when `isCoarsePointer()`. Any phase
  that relies on dive (e.g. later power-ups or dive-for-points mechanics) needs a touch gesture.
- No gamepad, no key remapping (the bus supports adding them).
- Dive is ignored in `READY` and is cleared on death/reset — correct, noted for completeness.

### 2.3 Bird animation — `components/scene/Firebird.jsx`, `PlayerBird.jsx`
**What exists.** Wings run a real flap stroke (`flapStroke`) driven by `sinceFlap`, tuck back
in a dive (`vy`), go limp when dead; body pitch follows velocity (clamped −1.0…0.5 rad); halo dims
on death; crest flicker; tail sway.

**Strengths.** State-driven (reads `flight`), props-stable ("keep props stable so a GLB swap is
local"), one point light, additive sprite glow.

**Weaknesses.**
- Colours are a module constant. Customization will need `Firebird` to accept a palette/skin prop
  (most material colours are inline) — a contained refactor, but it does not exist yet.
- *(Code-derived, not visually verified.)* The visual head/beak sit ≈0.55–0.65 u ahead of bird
  centre while the collision circle's front edge is 0.36 u. The beak can visually overlap an
  obstacle face by ~0.3 u before a hit registers. This is the "fair" direction (never dies before
  touching) but players may read it as the bird passing through rock. Needs an on-device look.
- Per-frame `Math.sin` animation and a `pointLight` on the bird are cheap; no concern.

### 2.4 Camera & forward visibility — `scenes/EmberValley/CameraRig.jsx`, `cameraConfig.js`
**What exists.** FOV 50, z = 11. Landscape: bird ≈27% from the left; portrait: pulls back
(`z = 11 + (1 − aspect)·14`) and leads 68% of half-width (bird ≈16% from left). Vertical follow is
damped (`birdY·0.3 + 0.55`, clamped). Flap/orb FOV kick (≤ +3°), decaying crash shake.

**Computed visible track ahead of the bird** (code-derived):

| Viewport | Units ahead | Seconds at 6.5 u/s | Seconds at 10.5 u/s |
| --- | --- | --- | --- |
| Desktop 16:9 | ≈13 u | ≈2.0 s | ≈1.25 s |
| Phone portrait ~9:19.5 | ≈6.7 u | ≈1.0 s | **≈0.64 s** |

Sections are ≈0.71 s apart at top difficulty, so on portrait phones at max speed you see **less
than one section ahead**. `EdgeWarning` (+0.45 s) mitigates but is a patch on a fundamental
framing limit.

**Weaknesses.** FOV kick changes visible width slightly (≤ ~6%) at the exact moment of a flap;
shake uses `Math.random` in render (cosmetic, fine). The README states ~1.0 s of portrait look-ahead
"at starting speed" — accurate, but it is not stated that this falls to ~0.64 s at top speed.

### 2.5 Obstacle generation, placement, collision — `systems/obstacles/*`, `physics/collision.js`
**What exists.** Five patterns (gate, column, floatingRocks, formation, passage) unlock by
distance; each returns a guaranteed corridor and the range the bird can exit at. The spawner picks
the next corridor centre inside the band *reachable from every possible exit height* using
conservative rise (3.2 u/s) / drop (4.5 u/s) rates. Generation is ahead-of-bird (46 u),
pooled (`ObjectPool`), seed-deterministic (verified: same seed ⇒ identical layout). Collision is
2D circle-vs-box/circle with slightly inset colliders; broad-phase by x.

**Strengths.** Fairness is designed in rather than hoped for, and is tested. No tunnelling risk:
max per-step travel is 0.09 u horizontal / 0.14 u vertical vs a 0.36 radius. Colliders are inset
(hex column 0.8 of visual width, rocks 0.86) so deaths read as fair.

**Weaknesses.**
- **Every section is a single vertical corridor with a uniformly random centre.** No rhythm, no
  deliberate pacing, no rest beats, no set-pieces, no multi-lane choices, no moving hazards.
  Variety is cosmetic (rock vs column), not mechanical.
- **Difficulty is a pure function of distance and stops at 1,500–1,600 m** (`difficultyAt`
  saturates at 1; speed saturates at 1,500 m). *(measured)* Gate gap 4.3 → 3.0 u, section spacing
  12 → 7.9 u, speed 6.5 → 10.5 u/s; after that, run 4,000 m = run 1,600 m.
- Fairness test uses **one** controller on 40 seeds to 3,000 m. It proves reachability for that
  strategy, not that the game is *challenging*: the bot never dies. It does not cover other
  patterns' edge cases with hold/dive.
- `lo > hi` fallback in `fillTrack` silently clamps to a midpoint when no reachable centre
  exists; nothing asserts this never yields an unreachable corridor.
- Reachability constants (`MAX_RISE_RATE`, `MAX_DROP_RATE`) and `speedAt` are **baked into the
  fairness model**. Anything that changes bird speed or climb (speed boosts, slow-mo, big wings)
  must update or bypass this model.

### 2.6 Collectibles, spawning & scoring — `OrbField.jsx`, `spawner.js`, `scoring.js`
**What exists.** One pickup type (fire orb, 5 pts). Placed as 3-orb trails before ~30% of
sections plus in-pattern lines; always on a safe path. Score = metres + 5·orbs. Rendered as two
InstancedMeshes.

**Measured balance.** At 1,500 m the bot collected 173 orbs → **37% of score**, matching the README's
~39% target. Distance points scale with speed (≈6.5 → 10.5 pts/s), so score/second rises over the run.

**Weaknesses.**
- **Orbs are free.** They are always on the safe line, so collecting them costs the player
  nothing; there is no reason to deviate. The bot collected ~0.12 orbs/m *without trying*. No
  risk/reward, no rare/high-value pickups, no combo or multiplier.
- Orb pickup sound is a single fixed pitch; no escalation feedback.
- Score is mostly passive time-alive: a high score and a long survival are the same thing, so
  "mastery" has only one axis.

### 2.7 Power-ups
**None implemented.** Integration notes in §5.

### 2.8 Game over, retry, pause — `GameScreen.jsx`, `useGameStore.js`, `PauseMenu.jsx`
**What exists.** Phases `READY → RUNNING → DYING (1.1 s) → OVER`, store mirrors them plus
`PAUSED`. Run end is guarded (once only). Retry via button or Space after 450 ms. Auto-pause on tab
hide / window blur. Rendering stops while paused (`frameloop="demand"`).

**Strengths.** Robust lifecycle guards, single crash path (`die()`), score frozen at death,
repeated restarts tested (pool sizes bounded).

**Weaknesses.**
- **No resume grace.** `resume()` is instant. After a demand-mode pause the first frame's delta
  can be up to the 66 ms clamp, so a player can lose ~0.07 s of simulation and die while still
  reaching for the screen. A 3-2-1 or brief invulnerability fixes it. *(Code-derived.)*
- The game-over screen is a result card with no "reason to retry": no near-miss to personal best,
  no progress, no goal for next run. Delta-to-best is not shown.
- Pausing is only possible in `RUNNING`; fine.

### 2.9 Mobile controls & responsive gameplay
**What exists.** `touch-action: none`, pointer events, safe-area insets, 44-ish px tap targets
(`--tap`), start prompt suggests rotating phone, fullscreen button, DPR caps.

**Weaknesses.**
- No dive gesture, no haptics, no orientation guidance beyond the start prompt.
- **Device-tier bug:** `isLowPowerDevice()` uses `navigator.deviceMemory || 4` then `memory <= 4`.
  `deviceMemory` is undefined in Safari and Firefox, so it falls back to 4 and the condition is
  **always true there** → those browsers (including desktop) always get the *low* tier (no AA, DPR
  1.25, 60 embers) under "Auto". Chromium desktop with ≥6 cores and ≥8 GB gets high. Also
  `cores <= 4` marks many ordinary laptops as low. *(Code-derived; trivial to confirm in console.)*

### 2.10 Performance & frame-rate independence
**Strengths.** Fixed 120 Hz sim with accumulator and render interpolation (`alpha`); frame delta
clamped to 1/15 s (max 8 steps/frame); no per-frame allocations in hot paths; instanced rendering
(~7 draw calls for the field); pooled records; adaptive DPR via `PerformanceMonitor`; HUD updates
throttled to 10 Hz and only on change; rendering paused when hidden/paused.

**Weaknesses.**
- Single 1.19 MB (328 KB gz) JS chunk loaded eagerly, including the full game and `three`. The home
  screen pays for the game. No code-splitting.
- Below 15 fps the sim slows rather than skipping (intentional spiral-of-death guard) — acceptable,
  but there is no performance telemetry to know how often it happens.
- No FPS / frame-time instrumentation, no performance budget, no automated browser test.
- Low-tier detection bug above skews real-world performance.

### 2.11 Audio — `systems/audio/sfx.js`
Synthesised Web Audio: flap, orb, crash. Properly unlocked on gesture. **No music, no ambience,
no UI sounds**; no pitch/combo escalation. Adding power-up or achievement cues is straightforward
(`tone`/`noiseBurst` helpers exist).

### 2.12 State & persistence — `useGameStore.js`, `utils/storage.js`
Zustand store holds UI-reactive state; per-frame data stays in the sim. `storage.js` is safe
against blocked storage and migrates the old `fireflapper:` prefix. **No schema/version, no
profile object**; keys are individual values. Progression, currencies, unlocks and achievements
will need a single versioned `profile` record.

### 2.13 Tests & architecture
- `scripts/sim-test.mjs`: hand-rolled assertions, no framework. 34 checks: collision primitives,
  score formula, flight (incl. frame-rate independence, hold, dive), crash/over events, orb
  collection, pooling over 200 restarts, and the 40-seed autopilot.
- **No** rendering tests, UI tests, input tests, store tests, lint, type-check, CI (`.github/`
  absent), or performance tests.
- Architecture rules in the README are accurate and followed (sim has no React/Three imports).
- README project-tree has `styles/` and `utils/` mis-nested under `scripts/` (doc typo).

---

## 3. Prioritised weaknesses

**High (affect the roadmap's core goals)**
1. Difficulty plateau + trivially solved track: no escalation past ~1,600 m; bot never dies.
2. Orbs are risk-free and flat; score is dominated by passive survival → little mastery incentive.
3. Track has no pacing/variety beyond pattern skins.
4. No progression layer of any kind (profile, currency, unlocks, achievements).
5. Portrait look-ahead (~0.64 s at top speed) is shorter than a section.

**Medium**
6. No resume grace after pause.
7. Touch has no dive; hold semantics are weak (only helps while rising).
8. `isLowPowerDevice()` misclassifies Safari/Firefox (and many laptops) as low-power.
9. Game-over has no retry hook (delta to best, next goal).
10. Possible beak-vs-collider visual mismatch (verify on device).

**Low**
11. Eager 1.19 MB bundle. 12. No music/ambience. 13. README tree typo. 14. Fairness test covers a
single strategy.

---

## 4. Reusable systems (do not rebuild)

| System | Where | Reuse for |
| --- | --- | --- |
| Pure fixed-step sim, headless-testable | `createGameSim.js` | Every gameplay phase; keep new rules here |
| Seeded RNG (`createRng`, `.range`, `.chance`) | `utils/random.js` | Daily challenge, reproducible tests, replays |
| `ObjectPool` | `obstacles/ObjectPool.js` | Pickups, power-ups, hazards, particles |
| Pattern builder API + `{length, lo, hi, free}` contract | `patterns.js` | New obstacle types and set-pieces |
| Reachability-constrained spawner | `spawner.js` | Keep as the fairness backbone |
| Event bus + sim event queue | `gameEvents.js`, `useGameLoop.js` | Achievements, combo, audio/VFX hooks |
| Input action bus | `inputBus.js` | Touch dive, gamepad, remap |
| `BurstParticles` (pooled Points) | `components/scene` | Power-up / combo VFX |
| `EdgeWarning` | `components/scene` | Pattern for off-screen hazard warnings |
| InstancedMesh rendering pattern | `ObstacleField`, `OrbField` | New pickups/hazards at ~1–2 draw calls each |
| Safe storage wrapper | `utils/storage.js` | Base for a versioned profile |
| `Firebird` props contract | `Firebird.jsx` | Skin/palette props, GLB swap |
| Quality settings + `PerformanceMonitor` | `useRenderSettings`, `SceneCanvas` | Gate heavier VFX by tier |

---

## 5. Conflicts & integration hazards for upcoming phases

Hard-coded assumptions that new features will collide with. Plan changes here **before** building:

1. **`orbs` is a single hard-coded type.** `sim.orbs` pool, `sim.orbsCollected`, `OrbField` (MAX 64),
   `setHud(distance, score, orbs)` (positional), `endRun({score, distance, orbs})`, `lastResult`,
   `sim-test.mjs`. Power-ups and orb variants should generalise to a `pickups` pool with a `kind`,
   not add a parallel system.
2. **Score formula lives in three places.** `computeScore` (sim getter), the store, and
   `GameOverPanel` (`result.orbs * SCORING.orbPoints` displayed as "(+N)"). Combos/multipliers will
   make the panel's derived number wrong. Make the sim own an `orbPoints` total and ship it in
   `results()`.
3. **Death has two call sites** (`die()` from ground and from obstacle loop). Shield/second-chance
   must intercept in one place; refactor to a single `tryDie(cause)` first.
4. **`speedAt(distance)` is used by the spawner's time budget and by the sim.** Speed boosts,
   slow-mo, or dash break the reachability guarantee and the "distance = x" scoring. Decide whether
   effects change *speed* (then the fairness model needs the effect) or only *bird properties*.
5. **`WORLD`/`PHYSICS`/`SCORING` are global frozen singletons** and `createGameSim()` takes no
   config. "Increasingly challenging environments" needs a level/biome config injected into the sim
   and spawner. `EmberValleyScene` and `gameInstance.js` bind one global `game`.
6. **Difficulty is `f(distance)` only** (`difficultyAt`, `pickPattern`, `gapFor`, speed ramp). Any
   adaptive/wave difficulty replaces these, not layers on them.
7. **Fairness test depends on `sim.track.corridors`** and a specific controller; new obstacle types
   must publish corridors or the test goes blind.
8. **Render caps** (`ObstacleField` MAX, `OrbField` MAX) silently drop instances when exceeded
   while collision still exists. Currently safe (pool peak 64/32); revisit when adding types.
9. **Persistence** needs a single versioned profile before progression lands; ad-hoc keys will not
   migrate cleanly.
10. **No customization system exists**, so "preserve customization" is really "design it so a
    palette is a prop". Do this before adding any new bird visuals.

---

## 6. Recommended order (input for Phase 1+)

Do *not* start with new content. Suggested sequence:
1. **Foundation refactors (small, test-covered):** single `tryDie(cause)`; `pickups` pool with `kind`;
   sim-owned `results()` incl. orb points; level/biome config object passed to `createGameSim`;
   versioned `profile` in storage.
2. **Feel & fairness:** resume countdown/grace; touch dive; fix `isLowPowerDevice`; tune hold.
3. **Difficulty & pacing:** replace the flat plateau with a wave/rest curve and set-pieces; extend
   the test bot to a second strategy and add a "bot should eventually die" assertion.
4. **Reward loop:** combo/multiplier, risk-placed orbs, power-ups, then progression/achievements
   and the Daily Challenge (seed already supported).
5. **Customization and environments** on top of the config and profile seams above.

Add a minimal CI job running `npm run build && npm run test:sim` early; there is none today.

---

## Appendix: how the numbers were produced
Headless script against `createGameSim` at 120 Hz: tap/hold peaks, time-to-lava, difficulty/spacing/
gap/speed at 0/500/1,500/3,000 m, same-seed layout determinism, and orb share for the repo's own
autopilot strategy over 1,500 m (seed 5). Camera look-ahead is computed from
`CameraRig`/`cameraConfig` formulas, not measured on a device.
