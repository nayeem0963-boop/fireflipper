# Fire Flapper

**Flap. Burn. Survive.** A 3D fantasy arcade game for the browser, coming to `fireflapper.com`.

> Status: **initial setup pass.** The app shell, home screen, 3D placeholder scene and game-screen
> foundation are in place. Flight physics, obstacles, collisions, audio, backend and deployment are
> intentionally not implemented yet.

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
    scene/              reusable 3D building blocks (Firebird, EmberParticles, SceneCanvas)
    game/               gameplay screen composition (GameScreen)
    ui/                 2D interface: HomeScreen, GameHUD, PauseMenu, SettingsPanel, icons
  scenes/
    Showcase/           menu-screen 3D scene
    EmberValley/        first level (scrolling backdrop for now)
  systems/              game logic, independent of React rendering
    runtime.js          mutable per-frame state (distance, last flap time)
    physics/            physics constants (flight model to come)
    scoring/            pure scoring helpers + distance tracker
    obstacles/          ObjectPool (spawner/collision to come)
    input/              input action bus (flap, pause)
  hooks/                React hooks: input binding, render quality, auto-pause
  styles/               global tokens + per-screen CSS
  utils/                storage, device detection, fullscreen, math, procedural textures
```

### Architecture rules

- **Rendering** lives in `components/scene` and `scenes/`. It reads simulation state each frame and
  never owns game rules.
- **Game state** that the UI reacts to lives in the Zustand store. **Per-frame state** (positions,
  velocities, pooled objects) lives in `systems/` as plain mutable objects. The store receives
  throttled snapshots (the HUD updates at 10 Hz), so React never re-renders at 60 fps.
- **Input** goes through `systems/input/inputBus.js`: raw keyboard and pointer events are mapped to
  abstract actions (`flap`, `pause`), so touch, gamepad and remapping slot in later.
- **Scoring, physics and obstacles** are plain JS modules that can be unit-tested without a browser.

### Performance notes

- One opaque WebGL context per screen, device-pixel-ratio capped (2 on desktop, 1.25 on low-power),
  and lowered automatically by drei's `PerformanceMonitor` when FPS drops.
- Rendering stops (`frameloop="demand"`) while paused or while a modal covers the menu scene.
- Embers are a single `THREE.Points` draw call mutated in place, with no per-frame allocations.
- Glow comes from additive sprites and emissive materials rather than post-processing.
- `ObjectPool` is ready for obstacle and particle recycling; GLB models will load via drei's `useGLTF`
  from `public/models/`.

## Controls (current)

| Action | Keyboard            | Touch / mouse          |
| ------ | ------------------- | ---------------------- |
| Flap   | Space, Up arrow, W  | Tap or click the scene |
| Pause  | Esc, P              | Pause button           |

Flapping only plays a wing-beat animation for now. There is no physics yet.
