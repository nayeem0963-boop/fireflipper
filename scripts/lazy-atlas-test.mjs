/**
 * Delayed atlas loading tests (no browser). Run with: npm run test:atlas
 * The hazard atlas and the power-up atlas are downloaded ATLAS_LEAD metres before the first moment either can be on screen (components/scene/lazyAtlas.js), never twice, with a retry on failure, and a
 * sprite is drawn only once its atlas has loaded. The score-orb atlas is untouched. Looks only: no gameplay module is involved.
 */
import { readFileSync } from 'node:fs';
import { createGameSim, PHASE } from '../src/systems/game/createGameSim.js';
import { FLIERS, SLOTS as FLIERS_SLOTS } from '../src/systems/fliers/fliers.js';
import { SLOTS as ITEM_SLOTS } from '../src/systems/powerups/powerups.js';
import { PHYSICS } from '../src/systems/physics/constants.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) { failures++; console.log(`  FAIL ${name} ${detail}`); } else console.log(`  ok   ${name}${detail ? ` (${detail})` : ''}`);
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

// ---- a stand-in for the browser's <img>, so three's real TextureLoader runs in Node
const requests = [];
let behaviour = () => 'load'; // what the next request does: 'load' | 'error'
globalThis.document = {
  createElementNS: () => {
    const l = {};
    const img = {
      addEventListener: (t, f) => { l[t] = f; },
      removeEventListener: (t) => { delete l[t]; },
      set src(u) { requests.push(u); const r = behaviour(u); queueMicrotask(() => (r === 'load' ? l.load?.call(img) : l.error?.call(img))); },
    };
    return img;
  },
};
const { createLazyAtlas, ATLAS_LEAD } = await import('../src/components/scene/lazyAtlas.js');
const nativeSetTimeout = globalThis.setTimeout; // kept apart: the failure test swaps in fake timers
const tick = () => new Promise((r) => nativeSetTimeout(r, 0));

console.log('\n1. The loader');
{
  check('the lead is 150 m', ATLAS_LEAD === 150);
  let loads = 0;
  const a = createLazyAtlas('/x/a.webp', () => loads++);
  check('nothing is requested before request() is called', requests.length === 0 && a.state === 'idle' && a.texture === null);
  a.request(); a.request(); a.request();
  await tick();
  check('many request() calls make exactly one download (no duplicate request) and one load callback', requests.length === 1 && loads === 1 && a.state === 'loaded' && !!a.texture);
  a.request(); await tick();
  check('a request after it has loaded does nothing', requests.length === 1);
  a.dispose();
  check('dispose frees the texture', a.texture === null);

  // failure: retried twice (fake timers), then given up quietly
  requests.length = 0; behaviour = () => 'error';
  const realSet = globalThis.setTimeout; const pending = [];
  globalThis.setTimeout = (f, ms) => { pending.push([f, ms]); return pending.length; };
  let called = 0;
  const b = createLazyAtlas('/x/b.webp', () => called++);
  let threw = false;
  try {
    b.request(); await tick();
    check('a failed load is retried after a pause (1.5 s)', requests.length === 1 && pending.length === 1 && pending[0][1] === 1500 && b.state === 'loading');
    pending.shift()[0](); await tick();
    check('and once more after a longer pause (4 s)', requests.length === 2 && pending.length === 1 && pending[0][1] === 4000);
    pending.shift()[0](); await tick();
    check('after the retries it stops quietly: no further request, no throw, no texture, no callback', requests.length === 3 && pending.length === 0 && b.state === 'failed' && b.texture === null && called === 0);
    b.request(); await tick();
    check('a failed atlas is not requested again every frame', requests.length === 3);
  } catch (e) { threw = true; console.log(e); }
  check('a failure never throws into the game loop', !threw);
  // disposing while a retry is pending cancels it
  requests.length = 0;
  const c = createLazyAtlas('/x/c.webp', () => {});
  c.request(); await tick();
  const clears = []; const realClear = globalThis.clearTimeout; globalThis.clearTimeout = (t) => clears.push(t);
  c.dispose();
  check('disposing while a retry is pending cancels it', clears.length === 1);
  globalThis.clearTimeout = realClear; globalThis.setTimeout = realSet; behaviour = () => 'load';
}

console.log('\n2. Lead time: the download starts well before the first possible appearance');
{
  // the numbers the two fields use (components/scene/FlierField.jsx and ItemField.jsx)
  const flierLoadAt = Math.max(0, FLIERS_SLOTS[0].e - 90 - ATLAS_LEAD);
  const itemLoadAt = Math.max(0, ITEM_SLOTS[0].x - 60 - ATLAS_LEAD);
  console.log(`  hazard atlas starts at ${flierLoadAt.toFixed(0)} m (first hazard at ${FLIERS_SLOTS[0].e.toFixed(0)} m); power-up atlas starts at ${itemLoadAt.toFixed(0)} m (first item due at ${ITEM_SLOTS[0].x.toFixed(0)} m)`);
  check('the hazard atlas starts at least 150 m before the earliest distance a hazard is drawn (its encounter minus the 90 m cull)', FLIERS_SLOTS[0].e - 90 - flierLoadAt >= ATLAS_LEAD && flierLoadAt > 0);
  check('the power-up atlas starts at least 150 m before the earliest distance an item is drawn (its slot minus the 60 m draw range)', ITEM_SLOTS[0].x - 60 - itemLoadAt >= ATLAS_LEAD && itemLoadAt > 0);
  // real generated tracks: no item is ever placed before its first slot, so none can be drawn before the load distance + 150 m
  let earliest = Infinity;
  FLIERS.enabled = false; // this corridor-following bird cannot dodge a flying hazard, and only the items are of interest here
  for (let seed = 1; seed <= 40; seed++) {
    const sim = createGameSim();
    sim.reset(seed);
    sim.flap();
    for (let i = 0; i < 120 * 400 && sim.distance < 1500 && sim.phase === PHASE.RUNNING; i++) {
      for (const it of sim.items.active) earliest = Math.min(earliest, it.x);
      const c = sim.track.corridors.find((k) => k.x1 > sim.distance - 0.3);
      const target = c ? Math.max(c.lo + 0.8, c.center - 0.6) : 0;
      if (sim.bird.vy < 0 && (sim.bird.y < target || (c && sim.bird.y < c.lo + 0.5))) sim.flap();
      sim.step(PHYSICS.fixedStep);
    }
  }
  FLIERS.enabled = true;
  check('in 40 generated tracks no power-up is ever placed before the first slot', earliest >= ITEM_SLOTS[0].x, `earliest ${earliest.toFixed(1)} m`);
  const fastest = 25; // m/s, well above the game's top speed on this stretch
  check('150 m is at least 6 s of flight even at 25 m/s (the file is about 100 to 200 KB)', ATLAS_LEAD / fastest >= 6);
}

console.log('\n3. The fields');
{
  const lazy = strip(read('src/components/scene/lazyAtlas.js'));
  const fliers = strip(read('src/components/scene/FlierField.jsx'));
  const items = strip(read('src/components/scene/ItemField.jsx'));
  const orbs = strip(read('src/components/scene/OrbField.jsx'));
  check('both fields download through the lazy loader and no longer start a texture load of their own', /createLazyAtlas\(ATLAS_URL/.test(fliers) && /createLazyAtlas\(ATLAS,/.test(items) && !/TextureLoader/.test(fliers) && !/TextureLoader/.test(items));
  check('each calls request() from its frame loop once the bird reaches its load distance', /dist >= LOAD_AT\) atlas\.request\(\)/.test(fliers) && /dist >= LOAD_AT\) atlas\.request\(\)/.test(items));
  check('a sprite is drawn only when its atlas has loaded (the existing loaded flag is set in the load callback)', /loaded\.current = true/.test(fliers) && /loaded\.current = true/.test(items) && /loaded\.current\)/.test(fliers) && /if \(loaded\.current\)/.test(items));
  check('the texture is released when the field unmounts (dispose also cancels a pending retry)', /atlas\.dispose\(\)/.test(fliers) && /atlas\.dispose\(\)/.test(items) && /texture\?\.dispose\(\)/.test(lazy) && /clearTimeout/.test(lazy));
  check('the hazards stay opt-out: ?fliers=0 downloads no hazard atlas', /FLIERS\.enabled && dist >= LOAD_AT/.test(fliers));
  check('the score-orb atlas is unchanged: still loaded when the field mounts', /new TextureLoader\(\)\.load\(ATLAS/.test(orbs) && !/lazyAtlas/.test(orbs));
  check('nothing in the simulation imports the loader or a renderer (looks only)', !/lazyAtlas|FlierField|ItemField/.test(strip(read('src/systems/game/createGameSim.js'))));
}

console.log(failures ? `\n${failures} failed` : '\natlas loading tests passed');
process.exit(failures ? 1 : 0);
