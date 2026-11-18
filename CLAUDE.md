# Fire Flipper: standing instructions

- **Keep Auto play.** The watch-only Auto play mode (home screen button, `src/systems/bot/`, `DemoOverlay`, the `demo`
  flag in the store) must stay in every future version. Do not remove or disable it unless the owner explicitly says so.
  `npm run test:autoplay` guards it; run it with the other tests (`test:sim`, `test:avatars`, `test:progression`).
- Birds and skins are cosmetic only: no gameplay advantage from the selected bird.
