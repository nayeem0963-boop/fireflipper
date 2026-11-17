# Fire Flipper: notes for Claude

Fire Flipper is a 3D browser arcade game (React 19, React Three Fiber, three.js, Zustand, Vite),
live at fireflipper.com. Architecture, gameplay rules and controls are in `README.md`; read it
before changing gameplay or rendering code.

## Workflow (cloud sessions, GitHub, Netlify)

- `master` is the production branch. Netlify publishes fireflipper.com from it, so merging to
  `master` is a production release.
- Never push, commit or merge to `master`. Work on a feature branch and open a pull request.
  Only the owner merges.
- Never enable auto-merge, never force-push a shared branch, and never change GitHub or Netlify
  settings.
- Before asking for review, run `npm run check` (lint, headless tests, production build) and
  report the result honestly in the pull request. If it fails, fix the cause or say why it fails.
- Every pull request gets a Netlify Deploy Preview with the complete game. The owner tests it
  there; describe in the pull request what to try (screens, controls, phone portrait/landscape).
- Keep pull requests small and focused, one feature or fix each.

## Commands

```bash
npm ci            # install exactly what package-lock.json specifies (Node 22.12+, see .nvmrc)
npm run check     # everything below, in order; must pass before review
npm run lint      # ESLint, zero warnings allowed
npm test          # headless gameplay tests (physics, collisions, scoring, track fairness)
npm run build     # production build into dist/
npm run dev       # dev server (not needed in cloud sessions; use the Deploy Preview)
```

## Rules for changes

- Preserve existing gameplay unless the task is to change it. Gameplay rules live in the pure
  simulation (`src/systems/`); renderers only read it.
- Any change to physics, collisions, obstacles or scoring needs matching tests in
  `scripts/sim-test.mjs`, and the fairness autopilot must still pass.
- The bird's collider (`BIRD_HITBOX` in `src/systems/physics/constants.js`) is fitted to the
  drawn bird. Refit it whenever the bird model or its scale in `PlayerBird.jsx` changes.
- Don't add dependencies without a clear need, and say why in the pull request.
- Don't remove assets without checking every reference to them.
- Lint uses only the classic React hooks rules: React Three Fiber code deliberately mutates
  Three.js objects inside `useFrame`.
- No secrets in the repo. The game needs no environment variables.
