# Fire Flipper: notes for Claude

Fire Flipper is a 3D browser arcade game (React 19, React Three Fiber, three.js, Zustand, Vite),
live at fireflipper.com. Architecture, gameplay rules and controls are in `README.md`; read it
before changing gameplay or rendering code.

## Workflow (cloud sessions, GitHub, Netlify)

| Branch | Role | Netlify |
| --- | --- | --- |
| `master` | Production. Changes only through a release the owner merges. | fireflipper.com |
| `fireflipper-dev` | Development and integration (GitHub default branch). | Permanent branch deploy at `fireflipper-dev--<project>.netlify.app` |
| feature branches | One per task, created from `fireflipper-dev`. | Not deployed |

- Start every task from the latest `fireflipper-dev` and work on a feature branch.
- Open pull requests against `fireflipper-dev`, never against `master`. Only the owner merges.
- Never push, commit or merge to `master`, and never open a release pull request unless the owner
  asks for one. Releases are `fireflipper-dev` → `master`, merged by the owner with a merge commit
  (not squash), so the two branches keep a shared history.
- Never push directly to `fireflipper-dev`, never force-push or delete `master` or
  `fireflipper-dev`, never enable auto-merge, and never change GitHub or Netlify settings.
- Before asking for review, run `npm run check` (lint, headless tests, production build) and
  report the result honestly in the pull request. If it fails, fix the cause or say why it fails.
- Feature branches get no Netlify deploy. After the owner merges a pull request, the dev URL
  updates and the owner tests the complete game there, so say in the pull request what to try
  (screens, controls, phone portrait/landscape).
- Hotfixes, only when the owner asks: branch from `master`, open a pull request into `master`,
  then a second one merging `master` back into `fireflipper-dev`.
- Keep pull requests small and focused, one feature or fix each.

## Commands

```bash
npm ci            # install exactly what package-lock.json specifies (Node 22, see .nvmrc)
npm run check     # everything below, in order; must pass before review
npm run lint      # ESLint, zero warnings allowed
npm test          # headless gameplay tests (physics, collisions, scoring, track fairness)
npm run build     # production build into dist/
npm run dev       # dev server (not needed in cloud sessions; the owner tests on the dev URL)
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
