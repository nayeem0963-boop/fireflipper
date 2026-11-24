# Fire Flipper: standing instructions

- **Keep Auto play.** The watch-only Auto play mode (home screen button, `src/systems/bot/`, `DemoOverlay`, the `demo`
  flag in the store) must stay in every future version. Do not remove or disable it unless the owner explicitly says so.
  `npm run test:autoplay` guards it; run it with the other tests (`test:sim`, `test:avatars`, `test:progression`).
- Birds and skins are cosmetic only: no gameplay advantage from the selected bird.
- **Game versions (v1 / v2) change only how the player is drawn** (`src/systems/versions`). The simulation must never import them;
  keep v1 exactly as the original game. `npm run test:versions` guards it.
- **After every phase**: run `npm run test:all` (sim, avatars, progression, autoplay, store), `npm run build`, and, where
  a browser is available, `npm run test:e2e` (production-build smoke test on desktop, phone portrait and landscape).
  Keep the Retry footer on screen at 1534x630 and on phones, and keep bird physics identical for every bird.
