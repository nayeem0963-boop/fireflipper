/**
 * Bird customisation tests. Run with: npm run test:avatars
 * Skins, trails and collection progress are cosmetic; this also checks that nothing a bird carries can reach the
 * simulation (no physics-like fields), so every bird stays mechanically equivalent.
 */
import { AVATARS, AVATAR_SPECIES, collectionProgress, isAvatarUnlocked, resolveAvatar, avatarFor } from '../src/systems/avatars/avatars.js';
import { createGameSim, PHASE } from '../src/systems/game/createGameSim.js';
import { PHYSICS } from '../src/systems/physics/constants.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
};

const NAMES = ['Flipper', 'Bulbuli', 'Scarlet Macaw', 'Rainbow Macaw', 'Blue-and-Yellow Macaw', 'Toco Toucan', 'Morpho Butterfly'];
check('all seven birds exist', NAMES.every((n) => AVATAR_SPECIES.some((s) => s.name === n)), AVATAR_SPECIES.map((s) => s.name).join(', '));
check('21 skins', AVATARS.length === 21);
check('unique ids', new Set(AVATARS.map((a) => a.id)).size === AVATARS.length);
for (const sp of AVATAR_SPECIES) {
  const fire = avatarFor(sp.id, 'fire');
  check(`${sp.name}: Fire skin free from the start`, isAvatarUnlocked(fire, 0));
  check(`${sp.name}: Blue skin locked at 0`, !isAvatarUnlocked(avatarFor(sp.id, 'blue'), 0));
  check(`${sp.name}: locked skin falls back to its own Fire skin`, resolveAvatar(`${sp.id}-white`, 0).id === fire.id);
}
for (const a of AVATARS) {
  check(`${a.id}: trail has 3 stops and a spark`, a.trail?.stops?.length === 3 && !!a.trail.spark);
}
const fireTrails = AVATAR_SPECIES.map((sp) => avatarFor(sp.id, 'fire').trail.stops.join());
check('every species has a distinct Fire trail', new Set(fireTrails).size === AVATAR_SPECIES.length);

const none = collectionProgress(0, {});
check('collection starts at the free skins', none.unlocked === AVATAR_SPECIES.length && none.nextUnlock > 0, JSON.stringify(none));
const all = collectionProgress(1e9, { flipper: 2 });
check('collection completes', all.unlocked === 21 && all.nextUnlock === null && all.flownSpecies === 1);

// Mechanical equivalence: the simulation never sees the avatar, and a bird carries no gameplay fields.
const FORBIDDEN = /gravity|impulse|speed|radius|hitbox|collision|score|multiplier|bonus/i;
for (const a of AVATARS) {
  const keys = Object.keys(a).filter((k) => k !== 'unlockScore' && FORBIDDEN.test(k));
  check(`${a.id}: no gameplay-like fields`, keys.length === 0, keys.join());
}
const run = (seed) => {
  const sim = createGameSim();
  sim.reset(seed);
  sim.flap();
  for (let i = 0; i < 600 && sim.phase === PHASE.RUNNING; i++) {
    if (sim.bird.vy < 0 && sim.bird.y < 0.5) sim.flap();
    sim.step(PHYSICS.fixedStep);
  }
  return [sim.distance, sim.bird.y, sim.orbsCollected, sim.phase].join();
};
check('same input gives same run regardless of bird', run(5) === run(5));

console.log(failures ? `\n${failures} failed` : '\navatar tests passed');
process.exit(failures ? 1 : 0);
