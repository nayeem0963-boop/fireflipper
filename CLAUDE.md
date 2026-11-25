# Fire Flipper: standing instructions

- **Keep Auto play.** The watch-only Auto play mode (home screen button, `src/systems/bot/`, `DemoOverlay`, the `demo`
  flag in the store) must stay in every future version. Do not remove or disable it unless the owner explicitly says so.
  `npm run test:autoplay` guards it; run it with the other tests (`test:sim`, `test:avatars`, `test:progression`).
- Birds and skins are cosmetic only: no gameplay advantage from the selected bird.
- **Game versions (v1 / v2).** v1 is the original flying game and must stay exactly as it was: nothing added for v2 may change it.
  v2 is the ground-runner (`src/systems/runner`): its own ruleset (she runs on the land, TAP jumps, its own obstacles and pits) on the
  shared worlds, run-speed curve, scoring, HUD and controls. Each version has its own simulation and its own Auto play bot (`test:autoplay`
  guards v1's, `test:runner` v2's); both must keep working. Neither simulation imports `src/systems/versions`: the store and the scene pick
  the simulation, and an avatar is only drawn. Best score, stats, achievements, the daily goal and the journey are kept per version
  (v1 keeps the original storage keys). `npm run test:versions` and `npm run test:runner` guard all of it.
- **After every phase**: run `npm run test:all` (sim, avatars, progression, autoplay, store), `npm run build`, and, where
  a browser is available, `npm run test:e2e` (production-build smoke test on desktop, phone portrait and landscape).
  Keep the Retry footer on screen at 1534x630 and on phones, and keep bird physics identical for every bird (in v1; the runner has one fixed ruleset).
