/**
 * Delayed atlas loading tests (no browser). Run with: npm run test:atlas
 * The hazard atlas and the power-up atlas are downloaded ATLAS_LEAD metres before the first moment either can be on screen (components/scene/lazyAtlas.js), never twice, with a retry on failure, and a
 * sprite is drawn only once its atlas has loaded. The score-orb atlas is untouched. Looks only: no gameplay module is involved.
 */
import { readFileSync } from 'node:fs';
import { createGameSim, PHASE } from '../src/systems/game/createGameSim.js';
import { FLIERS, SLOTS as FLIERS_SLOTS, flierPlace } from '../src/systems/fliers/fliers.js';
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
  let failed = 0;
  const a = createLazyAtlas('/x/a.webp', () => loads++, () => failed++);
  check('nothing is requested before request() is called', requests.length === 0 && a.state === 'idle' && a.texture === null);
  a.request(); a.request(); a.request();
  await tick();
  check('many request() calls make exactly one download (no duplicate request) and one load callback', requests.length === 1 && loads === 1 && a.state === 'loaded' && !!a.texture);
  a.request(); await tick();
  check('a request after it has loaded does nothing', requests.length === 1);
  a.dispose();
  check('dispose frees the texture', a.texture === null);

  check('a successful load never calls the failure callback', failed === 0);
  // failure: retried twice (fake timers), then given up quietly
  requests.length = 0; behaviour = () => 'error';
  const realSet = globalThis.setTimeout; const pending = [];
  globalThis.setTimeout = (f, ms) => { pending.push([f, ms]); return pending.length; };
  let called = 0;
  let bFailed = 0;
  const b = createLazyAtlas('/x/b.webp', () => called++, () => bFailed++);
  let threw = false;
  try {
    b.request(); await tick();
    check('a failed load is retried after a pause (1.5 s), and is not reported as failed yet', requests.length === 1 && pending.length === 1 && pending[0][1] === 1500 && b.state === 'loading' && bFailed === 0);
    pending.shift()[0](); await tick();
    check('and once more after a longer pause (4 s)', requests.length === 2 && pending.length === 1 && pending[0][1] === 4000);
    pending.shift()[0](); await tick();
    check('after the retries it stops: no further request, no throw, no texture, no load callback, and the failure callback runs exactly once', requests.length === 3 && pending.length === 0 && b.state === 'failed' && b.texture === null && called === 0 && bFailed === 1);
    b.request(); await tick();
    check('a failed atlas is not requested again every frame, nor reported again', requests.length === 3 && bFailed === 1);
  } catch (e) { threw = true; console.log(e); }
  check('a failure never throws into the game loop', !threw);
  // a load that fails once and then succeeds is a success, not a failure
  requests.length = 0; let n = 0; behaviour = () => (n++ === 0 ? 'error' : 'load');
  pending.length = 0;
  globalThis.setTimeout = (f, ms) => { pending.push([f, ms]); return pending.length; };
  let dFail = 0; let dLoads = 0;
  const dd = createLazyAtlas('/x/d.webp', () => dLoads++, () => dFail++);
  dd.request(); await tick(); pending.shift()[0](); await tick();
  check('a load that fails once and then succeeds ends loaded, with the failure callback never called', dd.state === 'loaded' && dLoads === 1 && dFail === 0 && requests.length === 2);
  dd.dispose();
  // disposing while a retry is pending cancels it
  requests.length = 0; behaviour = () => 'error';
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

console.log('\n3. Permanent failure fails open (a hazard that cannot be seen cannot hurt)');
{
  const DT = PHYSICS.fixedStep;
  const P = { x: 0, dx: 0, y: 0 };
  const disc = FLIERS_SLOTS.find((s) => s.kind === 'disc');
  const stage = (slot) => {
    const sim = createGameSim();
    sim.reset(3); sim.flap(); sim.step(DT);
    sim.obstacles.releaseAll(); sim.orbs.releaseAll(); sim.items.releaseAll();
    sim.track.nextX = 1e9;
    sim.distance = sim.prevDistance = slot.e - 0.05;
    flierPlace(slot, sim.distance, P);
    sim.bird.y = P.y; sim.bird.vy = 0; sim.events.length = 0;
    return sim;
  };
  check('by default nothing is unseen (every headless simulation and test is unchanged)', FLIERS.unseen === false);
  const seen = stage(disc);
  seen.step(DT);
  check('control: with the picture loaded, flying into the disc still ends the run', (seen.phase === PHASE.DYING || seen.phase === PHASE.OVER) && seen.crashCause === 'disc');

  // the real loader, failing for good (as the hazard field drives it)
  const realSet = globalThis.setTimeout; const pending = [];
  globalThis.setTimeout = (f, ms) => { pending.push([f, ms]); return pending.length; };
  requests.length = 0; behaviour = () => 'error';
  let warned = 0;
  const atlas = createLazyAtlas('/images/hazards/hazards.webp', () => {}, () => warned++);
  const unseenNow = () => atlas.state !== 'loaded'; // exactly the expression FlierField evaluates every frame
  check('before the download starts the hazards are unseen (and none is anywhere near yet)', unseenNow() === true);
  atlas.request(); await tick();
  FLIERS.unseen = unseenNow();
  const during = stage(disc); during.step(DT);
  check('while the picture is still loading or being retried, a hazard cannot hurt the bird either', FLIERS.unseen === true && during.phase === PHASE.RUNNING && during.crashCause == null);
  pending.shift()[0](); await tick(); pending.shift()[0](); await tick();
  check('after every retry has failed the state is failed, the player is told once, and the hazards stay unseen', atlas.state === 'failed' && warned === 1 && unseenNow() === true && requests.length === 3);
  FLIERS.unseen = unseenNow();
  const dead = stage(disc); dead.step(DT);
  check('PERMANENT FAILURE: flying straight into the disc no longer ends the run (it is invisible, so it is harmless)', dead.phase === PHASE.RUNNING && dead.crashCause == null && FLIERS.unseen === true);
  let alive = true;
  for (let i = 0; i < 240; i++) { dead.bird.vy = 0; dead.step(DT); if (dead.phase !== PHASE.RUNNING) alive = false; }
  check('and the bird flies on through it for two seconds unharmed', alive && dead.distance > disc.e + 3);
  const ring = FLIERS_SLOTS.find((s) => s.kind === 'firering'); const rim = stage(ring);
  flierPlace(ring, rim.distance, P); rim.bird.y = P.y + 1.2; rim.step(DT);
  check('a ring\'s rim is harmless too while unseen', rim.phase === PHASE.RUNNING);
  check('the obstacles and the lava are NOT affected by the failure: a column still ends the run', (() => { const s = createGameSim(); s.reset(3); s.flap(); for (let i = 0; i < 120 * 40 && s.phase === PHASE.RUNNING; i++) s.step(DT); return s.phase !== PHASE.RUNNING; })());
  globalThis.setTimeout = realSet; behaviour = () => 'load';

  // when the picture does load, everything is as before
  FLIERS.unseen = false;
  const back = stage(disc); back.step(DT);
  check('once the picture has loaded (unseen false) the disc is lethal again, exactly as before', back.phase !== PHASE.RUNNING && back.crashCause === 'disc');
  FLIERS.unseen = false;
}

console.log('\n4. The fields');
{
  const lazy = strip(read('src/components/scene/lazyAtlas.js'));
  const fliers = strip(read('src/components/scene/FlierField.jsx'));
  const items = strip(read('src/components/scene/ItemField.jsx'));
  const orbs = strip(read('src/components/scene/OrbField.jsx'));
  check('both fields download through the lazy loader and no longer start a texture load of their own', /createLazyAtlas\(\s*ATLAS_URL/.test(fliers) && /createLazyAtlas\(ATLAS,/.test(items) && !/TextureLoader/.test(fliers) && !/TextureLoader/.test(items));
  check('each calls request() from its frame loop once the bird reaches its load distance', /dist >= LOAD_AT\) atlas\.request\(\)/.test(fliers) && /dist >= LOAD_AT\) atlas\.request\(\)/.test(items));
  check('a sprite is drawn only when its atlas has loaded (the existing loaded flag is set in the load callback)', /loaded\.current = true/.test(fliers) && /loaded\.current = true/.test(items) && /loaded\.current\)/.test(fliers) && /if \(loaded\.current\)/.test(items));
  check('the texture is released when the field unmounts (dispose also cancels a pending retry)', /atlas\.dispose\(\)/.test(fliers) && /atlas\.dispose\(\)/.test(items) && /texture\?\.dispose\(\)/.test(lazy) && /clearTimeout/.test(lazy));
  check('the hazards stay opt-out: ?fliers=0 downloads no hazard atlas', /FLIERS\.enabled && dist >= LOAD_AT/.test(fliers));
  check('the hazard field sets the fail-open flag every frame from the atlas state, resets it on unmount, and warns once on permanent failure', /FLIERS\.unseen = atlas\.state !== 'loaded'/.test(fliers) && /FLIERS\.unseen = false/.test(fliers) && /console\.warn\(/.test(read('src/components/scene/FlierField.jsx')));
  check('the power-up field is unchanged by the fail-open fix (no failure callback, no flag)', !/onFail|unseen|console\.warn/.test(items) && /createLazyAtlas\(ATLAS,/.test(items));
  check('the simulation reads only the flag, never the renderer', /FLIERS\.enabled && !FLIERS\.unseen/.test(strip(read('src/systems/game/createGameSim.js'))));
  check('the score-orb atlas is unchanged: still loaded when the field mounts', /new TextureLoader\(\)\.load\(ATLAS/.test(orbs) && !/lazyAtlas/.test(orbs));
  check('nothing in the simulation imports the loader or a renderer (looks only)', !/lazyAtlas|FlierField|ItemField/.test(strip(read('src/systems/game/createGameSim.js'))));
}

console.log(failures ? `\n${failures} failed` : '\natlas loading tests passed');
process.exit(failures ? 1 : 0);
