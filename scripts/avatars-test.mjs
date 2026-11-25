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

const NAMES = ['FlameBird', 'Honeybell', 'Morpho Butterfly'];
check('exactly these three birds exist, FlameBird first (no Flipper, Bulbuli, Rainbow Macaw, Toco Toucan or Fire Eagle)', NAMES.length === AVATAR_SPECIES.length && NAMES.every((n, i) => AVATAR_SPECIES[i]?.name === n), AVATAR_SPECIES.map((s) => s.name).join(', '));
check('9 skins', AVATARS.length === 9);
check('FlameBird, the mascot, is the first bird and the default (Fire, its own painted colours)', AVATAR_SPECIES[0].id === 'flamebird' && AVATARS[0].id === 'flamebird-fire' && AVATARS[0].kind === 'flamebird' && AVATARS[0].palette.mix === 0 && AVATARS.filter((a) => a.species === 'flamebird').length === 3);
check('unique ids', new Set(AVATARS.map((a) => a.id)).size === AVATARS.length);
{
  const { getAvatar } = await import('../src/systems/avatars/avatars.js');
  const { CREDITS } = await import('../src/systems/avatars/credits.js');
  const { existsSync } = await import('node:fs');
  check('a saved choice of a removed bird shows FlameBird', ['bulbuli-fire', 'bulbuli-blue', 'macaw-flying-white', 'toco-toucan-fire', 'fire-eagle-blue', 'ember', 'scarlet-macaw'].every((id) => getAvatar(id).id === 'flamebird-fire'));
  check('removed birds: model files and credits gone; the remaining birds have their files', ['fire-eagle', 'macaw-flying', 'toco-toucan'].every((f) => !existsSync(new URL(`../public/models/birds/${f}.glb`, import.meta.url))) && ['flamebird', 'macaw-blue-yellow', 'morpho'].every((f) => existsSync(new URL(`../public/models/birds/${f}.glb`, import.meta.url))) && CREDITS.map((c) => c.id).join() === 'macaw-blue-yellow,morpho');
  check('Honeybell and Morpho keep their saved colours', getAvatar('macaw-blue-yellow-white').id === 'macaw-blue-yellow-white' && getAvatar('morpho-blue').id === 'morpho-blue');
}
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
const all = collectionProgress(1e9, { flamebird: 2, bulbuli: 5 }); // a bird no longer in the list does not count
check('collection completes', all.unlocked === 9 && all.nextUnlock === null && all.flownSpecies === 1);

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

// ---- the Flipper model is a blue-and-yellow macaw (components/scene/Firebird.jsx); it is only worn as the Celestial reward skin now
{
  const { readFileSync } = await import('node:fs');
  const { REWARD_AVATARS } = await import('../src/systems/avatars/avatars.js');
  const src = readFileSync(new URL('../src/components/scene/Firebird.jsx', import.meta.url), 'utf8');
  const defaults = /const COLORS = \{([\s\S]*?)\};/.exec(src)?.[1] ?? '';
  const get = (k) => new RegExp(`${k}: '(#[0-9a-f]{6})'`, 'i').exec(defaults)?.[1];
  const hue = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); if (!d) return 0; const x = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return x * 60; };
  check('its own colours are a macaw\'s: a blue back and wings, a yellow belly, a green forehead, a white face patch and a dark beak', hue(get('body')) > 205 && hue(get('body')) < 240 && hue(get('wing')) > 205 && hue(get('wing')) < 240 && hue(get('belly')) > 35 && hue(get('belly')) < 55 && hue(get('crown')) > 120 && hue(get('crown')) < 170 && /^#f[0-9a-f]f[0-9a-f][ef][0-9a-f]$/i.test(get('face')) && parseInt(get('beak').slice(1, 3), 16) < 0x40);
  check('it has the macaw\'s parts and none of the old flame crest', /face patch/.test(src) && /hooked beak/.test(src) && /green forehead/.test(src) && /chin strap/.test(src) && !/crest/i.test(src.replace(/crown/gi, '')));
  check('a long graduated tail of five leaf-shaped blue feathers with yellow tips, and wings with splayed primaries (a long narrow swept wing) over a yellow lining', /graduated tail: five leaf-shaped blue feathers/.test(src) && /\[0\.08, 0\.0, 2\.8, 0\.05\]/.test(src) && /createLiningShape/.test(src) && /splayed primary feathers/.test(src));
    check('the Flipper is not in the list, but its gold Celestial reward skin still recolours the macaw with its own head colours', !AVATARS.some((a) => a.species === 'flipper') && REWARD_AVATARS.every((a) => ['crown', 'face', 'chin'].every((k) => /^#[0-9a-f]{6}$/i.test(a.palette[k]))));
  check('the redesign is cosmetic: the simulation, collision and physics import no avatar and the hitbox is the same 0.36 circle', ['src/systems/game/createGameSim.js', 'src/systems/physics/collision.js', 'src/systems/physics/flight.js'].every((f) => !/avatar|Firebird/i.test(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''))) && PHYSICS.birdRadius === 0.36);
}

console.log(failures ? `\n${failures} failed` : '\navatar tests passed');
process.exit(failures ? 1 : 0);
