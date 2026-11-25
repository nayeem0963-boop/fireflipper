/**
 * Game version tests. Run with: npm run test:versions
 * v1 is the baseline (the original flying game) and v2 overrides the player's visuals and which simulation runs (the ground-runner). This
 * checks the registry, that v1 still draws the original bird at the original size on the original simulation, how a version is chosen
 * (link, saved choice, menu), and that neither simulation can see a version or an avatar. The runner's own rules are in test:runner.
 */
import { readFileSync, readdirSync } from 'node:fs';
import {
  GAMES_CONFIG,
  VERSION_IDS,
  DEFAULT_VERSION_ID,
  getVersion,
  isVersionId,
  resolveInitialVersionId,
  urlForVersion,
  avatarAssetUrl,
  usesOriginalAvatar,
  isUpright,
  isRunner,
  trailForVersion,
} from '../src/systems/versions/versions.js';
import { useGameStore, SCREENS } from '../src/store/useGameStore.js';
import { createGameSim, PHASE } from '../src/systems/game/createGameSim.js';
import { PHYSICS } from '../src/systems/physics/constants.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
};
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const st = () => useGameStore.getState();

// ---- the registry
const v1 = getVersion('v1');
const v2 = getVersion('v2');
check('v1 and v2 are listed, in that order, once each', VERSION_IDS.join() === 'v1,v2' && GAMES_CONFIG.length === 2);
check('v1 is the default', DEFAULT_VERSION_ID === 'v1');
check('an unknown id gives the baseline', getVersion('v9') === v1 && getVersion(undefined) === v1 && getVersion(null) === v1);
check('isVersionId only accepts the real ids', isVersionId('v1') && isVersionId('v2') && !isVersionId('v3') && !isVersionId('') && !isVersionId(null));
check('every version has a title, a description and a player config', GAMES_CONFIG.every((v) => v.title && v.description && v.playerConfig));
check('the registry is frozen (a version cannot be edited at run time)', Object.isFrozen(GAMES_CONFIG) && GAMES_CONFIG.every((v) => Object.isFrozen(v) && Object.isFrozen(v.playerConfig)));

// ---- v1 is the original game, unchanged
check('v1 draws the original bird', v1.playerConfig.avatarType === 'v1_original' && usesOriginalAvatar(v1));
check('v1 keeps the original size and position (0.6, no offset)', v1.playerConfig.scale.join() === '0.6,0.6,0.6' && v1.playerConfig.offset.join() === '0,0,0');
check('v1 has no trail override and no asset', v1.playerConfig.trailColor === undefined && v1.playerConfig.assetPath === '' && avatarAssetUrl(v1) === '');
const skinTrail = { stops: ['#111', '#222', '#333'], spark: '#444', style: 'sparks' };
check('v1 keeps the skin trail untouched', trailForVersion(v1, skinTrail) === skinTrail);

// ---- v2 is v1 plus player-visual overrides only
check('v2 draws the runner', v2.playerConfig.avatarType === 'v2_runner' && !usesOriginalAvatar(v2));
check('v1 runs the flying simulation and v2 the ground-runner', v1.ruleset === 'flight' && v2.ruleset === 'runner' && !isRunner(v1) && isRunner(v2));
check('v2 is a running model (upright) and v1 stays the flying one', isUpright(v2) && !isUpright(v1) && v1.playerConfig.upright === undefined);
check('v2 has the same fields as v1 (nothing else is configurable: its ruleset and its player visuals)', Object.keys(v2).sort().join() === Object.keys(v1).sort().join());
const PLAYER_KEYS = ['avatarType', 'assetPath', 'scale', 'offset', 'height', 'centre', 'rotation', 'upright', 'clips', 'trailColor'];
check('v2 player config only uses the documented visual fields', Object.keys(v2.playerConfig).every((k) => PLAYER_KEYS.includes(k)), Object.keys(v2.playerConfig).join());
const GAMEPLAY = /gravity|impulse|speed|radius|hitbox|collision|score|multiplier|bonus|physics|spawn/i;
check('no version field is gameplay-like', GAMES_CONFIG.every((v) => ![...Object.keys(v), ...Object.keys(v.playerConfig)].some((k) => GAMEPLAY.test(k))));
check('v2 has an asset path (a .glb under public/, no leading slash)', /^[^/].*\.glb$/i.test(v2.playerConfig.assetPath), v2.playerConfig.assetPath);
check('v2 scale and offset are three finite numbers, scale non-zero', [v2.playerConfig.scale, v2.playerConfig.offset].every((a) => a.length === 3 && a.every(Number.isFinite)) && v2.playerConfig.scale.every((s) => s > 0));
check('the asset URL is built from the path', avatarAssetUrl(v2) === `/${v2.playerConfig.assetPath}`, avatarAssetUrl(v2));
check('a leading slash in the path is tolerated', avatarAssetUrl({ playerConfig: { assetPath: '/models/v2/x.glb' } }) === '/models/v2/x.glb');
const t2 = trailForVersion(v2, skinTrail);
check('v2 trail uses its colour and keeps the skin trail style', t2.stops.length === 3 && t2.stops.every((c) => c === v2.playerConfig.trailColor) && t2.spark === v2.playerConfig.trailColor && t2.style === 'sparks');

// ---- the v2 asset in the repo is a real GLB with the clips the config names
{
  const buf = readFileSync(new URL(`../public/${v2.playerConfig.assetPath}`, import.meta.url));
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const names = (gltf.animations ?? []).map((a) => a.name);
  check('the v2 file is a binary glTF', buf.readUInt32LE(0) === 0x46546c67 && buf.readUInt32LE(4) === 2);
  const { clips } = v2.playerConfig;
  const clipOf = (d) => (typeof d === 'string' ? d : d.clip);
  check('every clip the config names exists in the model', Object.values(clips).every((d) => names.includes(clipOf(d))), names.join());
  const dur = (n) => Math.max(...gltf.animations.find((a) => a.name === n).samplers.map((s) => gltf.accessors[s.input].max[0]));
  check('every clip range lies inside its clip', Object.values(clips).every((d) => typeof d === 'string' || !d.range || (d.range[0] >= 0 && d.range[0] < d.range[1] && d.range[1] <= dur(d.clip) + 1e-3)));
  check('the model is rigged (one skin)', (gltf.skins ?? []).length === 1);
  const needs = (gltf.extensionsRequired ?? []).filter((e) => !['KHR_mesh_quantization', 'EXT_texture_webp'].includes(e));
  check('it needs no decoder the game does not have (no Draco or meshopt)', needs.length === 0, needs.join());
}

// ---- choosing a version: link, saved choice, default
check('?version=v2 opens v2', resolveInitialVersionId('?version=v2', null) === 'v2');
check('the link beats the saved choice', resolveInitialVersionId('?version=v1', 'v2') === 'v1' && resolveInitialVersionId('?version=v2', 'v1') === 'v2');
check('the saved choice is used without a link', resolveInitialVersionId('', 'v2') === 'v2' && resolveInitialVersionId('?hazards=0', 'v2') === 'v2');
check('an invalid link or saved value falls back safely', resolveInitialVersionId('?version=nope', 'zzz') === 'v1' && resolveInitialVersionId('?version=', 7) === 'v1' && resolveInitialVersionId(undefined, undefined) === 'v1');
check('the URL keeps other parameters and the hash', urlForVersion('http://x.test/play?hazards=0&version=v1#top', 'v2') === '/play?hazards=0&version=v2#top', urlForVersion('http://x.test/play?hazards=0&version=v1#top', 'v2'));
check('the URL gets the parameter when it had none', urlForVersion('http://x.test/', 'v2') === '/?version=v2');

// ---- the store: switching versions
check('the store starts in v1 (no link, nothing saved)', st().versionId === 'v1');
st().selectVersion('v2');
check('the menu can switch to v2 without a reload', st().versionId === 'v2');
st().selectVersion('v3');
st().selectVersion(undefined);
check('an unknown version is ignored', st().versionId === 'v2');
st().selectVersion('v1');
check('and back to v1', st().versionId === 'v1');
st().selectVersion('v2');
st().startGame();
st().selectVersion('v1');
check('the version cannot change mid-run', st().screen === SCREENS.GAME && st().versionId === 'v2');
st().exitToMenu();
st().selectVersion('v1');
check('it can change again from the menu', st().versionId === 'v1');

// a bare `window` with no `location` (some tests stub one) must not break the store
{
  globalThis.window = {};
  let ok = true;
  let fresh;
  try {
    fresh = await import('../src/store/useGameStore.js?bare-window=1');
  } catch {
    ok = false;
  }
  delete globalThis.window;
  check('the store loads when window has no location, starting in v1', ok && fresh.useGameStore.getState().versionId === 'v1');
}

// ---- choosing a version never touches the flying simulation: v1 plays exactly as it did
const run = (seed) => {
  const sim = createGameSim();
  sim.reset(seed);
  sim.flap();
  for (let i = 0; i < 900 && sim.phase === PHASE.RUNNING; i++) {
    if (sim.bird.vy < 0 && sim.bird.y < 0.5) sim.flap();
    sim.step(PHYSICS.fixedStep);
  }
  return [sim.distance, sim.bird.y, sim.orbsCollected, sim.score, sim.phase].join();
};
st().selectVersion('v1');
const before = run(11);
st().selectVersion('v2');
st().selectVersion('v1');
check('the flying game plays the same run after the version was switched to v2 and back', before === run(11));

const dirs = ['src/systems/game', 'src/systems/physics', 'src/systems/obstacles', 'src/systems/hazards', 'src/systems/fliers', 'src/systems/scoring', 'src/systems/bot', 'src/systems/runner'];
const simFiles = dirs.flatMap((d) => readdirSync(new URL(`../${d}`, import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => `${d}/${f}`));
const simSrc = strip(simFiles.map(read).join('\n'));
check('the simulations (flying and runner), physics, collisions, spawners, hazards, scoring and the Auto play bots import no version code', simFiles.length > 10 && !/versions|versionId|useGameVersion|playerConfig/.test(simSrc), `${simFiles.length} files`);
const flightOnly = ['src/systems/game/createGameSim.js', 'src/systems/physics/flight.js', 'src/systems/physics/collision.js', 'src/systems/physics/constants.js', 'src/systems/obstacles/spawner.js', 'src/systems/obstacles/patterns.js', 'src/systems/hazards/biomeHazards.js', 'src/systems/fliers/fliers.js', 'src/systems/bot/autopilot.js'];
check('the original flying simulation, its obstacles, hazards and bot know nothing of the runner (v1 is untouched by v2)', !/runner/i.test(strip(flightOnly.map(read).join('\n'))));
check('the game loop and the input code do not know the version either', !/versionId|versions\.js/.test(strip(read('src/systems/game/useGameLoop.js') + read('src/hooks/useGameInput.js') + read('src/components/game/GameScreen.jsx'))));

// ---- the visual layer
const playerBird = strip(read('src/components/scene/PlayerBird.jsx'));
check('PlayerBird draws the player through <PlayerAvatar> (the visual is decoupled from the placement)', /<PlayerAvatar/.test(playerBird) && !/<AvatarBird/.test(playerBird));
check('PlayerBird still places the player only from the simulation', /sim\.renderBirdY\(\)/.test(playerBird) && /sim\.bird\.pitch/.test(playerBird));
check('only an upright (running) version skips the flight pitch; the flying bird keeps it', /upright \? 0 : sim\.bird\.pitch \+ sim\.bird\.spin/.test(playerBird));
const avatarSrc = strip(read('src/components/scene/PlayerAvatar.jsx') + read('src/components/scene/RunnerAvatar.jsx'));
check('the avatar components never import the simulation', !/systems\/(game|physics|obstacles|scoring)/.test(avatarSrc));

console.log(failures ? `${failures} failed` : 'version tests passed');
process.exit(failures ? 1 : 0);
