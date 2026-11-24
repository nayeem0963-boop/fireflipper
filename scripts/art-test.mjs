/**
 * Art Lab tests. Run with: npm run test:art
 * Everything here runs in plain Node (no browser): the piece registry and parameter schemas, the palettes and camera
 * presets, the ribbon geometry, the shader sources, the store, and the rules that keep the lab separate from the game.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PIECES, getPiece } from '../src/art/pieces/index.js';
import { clampParam, defaultsOf, resolveParams, sanitizeSaved, validateSchema } from '../src/art/params.js';
import { DEFAULT_PALETTE_ID, PALETTES, getPalette } from '../src/art/palettes.js';
import { CAMERA_PRESETS, presetFor } from '../src/art/cameraPresets.js';
import { RIBBON_ACROSS, ribbonKnotGeometry } from '../src/art/geometry/ribbonKnot.js';
import { iridescentFragment, iridescentUniforms, iridescentVertex } from '../src/art/shaders/iridescentBlob.js';
import { NOISE_GLSL } from '../src/art/shaders/noise.js';
import { useArtStore } from '../src/art/useArtStore.js';
import { SCREENS } from '../src/store/useGameStore.js';

let failures = 0;
let passes = 0;
function check(name, cond, detail = '') {
  if (cond) passes++;
  else {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
}
const section = (s) => console.log(`\n${s}`);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const hex = /^#[0-9a-f]{6}$/i;

section('Exhibition (piece registry)');
{
  check('there are at least three starter pieces', PIECES.length >= 3, `${PIECES.length}`);
  check('piece ids are unique', new Set(PIECES.map((p) => p.id)).size === PIECES.length);
  check('piece titles are unique', new Set(PIECES.map((p) => p.title)).size === PIECES.length);
  check('an unknown id gives the first piece', getPiece('nope') === PIECES[0]);
  for (const p of PIECES) {
    check(`${p.id}: has a title and a blurb`, p.title.length > 2 && p.blurb.length > 20);
    check(`${p.id}: id is a lowercase slug`, /^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id));
    check(`${p.id}: has a component (loaded on demand)`, p.Component != null);
    check(`${p.id}: its params schema is valid`, validateSchema(p.params).length === 0, validateSchema(p.params).join('; '));
    check(`${p.id}: has at least three adjustable parameters`, Object.keys(p.params).length >= 3);
    check(`${p.id}: lighting is studio or dark`, p.lighting === undefined || ['studio', 'dark'].includes(p.lighting));
    check(`${p.id}: floorY (if set) is below the origin`, p.floorY === undefined || p.floorY < 0);
    check(`${p.id}: camera overrides name real presets with 3 numbers`, Object.entries(p.camera ?? {}).every(([k, v]) => CAMERA_PRESETS.some((c) => c.id === k) && (!v.position || (v.position.length === 3 && v.position.every(Number.isFinite)))));
    // Every file the registry points at exists, and a component is a default-exported function.
    const comp = fs.readdirSync(path.join(root, 'src/art/pieces')).filter((f) => f.endsWith('.jsx'));
    check(`${p.id}: its component file exists in pieces/`, comp.some((f) => read(`src/art/pieces/${f}`).includes('export default function') && read('src/art/pieces/index.js').includes(`./${f}`)));
  }
  const reg = read('src/art/pieces/index.js');
  const files = fs.readdirSync(path.join(root, 'src/art/pieces')).filter((f) => f.endsWith('.jsx'));
  check('every component file in pieces/ is registered (nothing left out)', files.every((f) => reg.includes(`./${f}`)), files.join());
}

section('Parameters');
{
  const range = { type: 'range', label: 'R', min: 0, max: 1, step: 0.1, default: 0.5 };
  const select = { type: 'select', label: 'S', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], default: 'a' };
  const toggle = { type: 'toggle', label: 'T', default: false };
  const color = { type: 'color', label: 'C', default: '#ff0000' };
  check('range: clamps above and below', clampParam(range, 9) === 1 && clampParam(range, -9) === 0);
  check('range: snaps to the step', clampParam(range, 0.34) === 0.3 && clampParam(range, 0.36) === 0.4);
  check('range: no floating-point dust', clampParam(range, 0.30000000000000004) === 0.3);
  check('range: junk becomes the default', clampParam(range, 'x') === 0.5 && clampParam(range, NaN) === 0.5 && clampParam(range, Infinity) === 0.5);
  check('select: only known options', clampParam(select, 'b') === 'b' && clampParam(select, 'z') === 'a');
  check('toggle: only booleans', clampParam(toggle, true) === true && clampParam(toggle, 'yes') === false);
  check('color: only #rrggbb, lower-cased', clampParam(color, '#AABBCC') === '#aabbcc' && clampParam(color, 'red') === '#ff0000' && clampParam(color, '#abc') === '#ff0000');
  const schema = { r: range, s: select };
  check('defaultsOf gives every default', JSON.stringify(defaultsOf(schema)) === JSON.stringify({ r: 0.5, s: 'a' }));
  check('resolveParams fills gaps, drops unknown keys, repairs bad values', JSON.stringify(resolveParams(schema, { r: 7, zzz: 1 })) === JSON.stringify({ r: 1, s: 'a' }));
  check('resolveParams survives null', JSON.stringify(resolveParams(schema, null)) === JSON.stringify({ r: 0.5, s: 'a' }));
  check('validateSchema catches a bad range', validateSchema({ x: { type: 'range', label: 'x', min: 1, max: 0, step: 0.1, default: 0.5 } }).length > 0);
  check('validateSchema catches a default outside the range', validateSchema({ x: { ...range, default: 5 } }).length > 0);
  check('validateSchema catches an unknown type and a missing label', validateSchema({ x: { type: 'dial', label: 'x' } }).length > 0 && validateSchema({ x: { ...toggle, label: '' } }).length > 0);
  check('validateSchema catches a select whose default is not an option', validateSchema({ x: { ...select, default: 'q' } }).length > 0);
  check('every real piece resolves to its own defaults', PIECES.every((p) => JSON.stringify(resolveParams(p.params, {})) === JSON.stringify(defaultsOf(p.params))));
  const clean = sanitizeSaved({ pieceId: 'ghost', preset: 'sideways', palette: 'neon', speed: 'fast', wireframe: 'yes', params: { 'ghost': { a: 1 }, [PIECES[0].id]: { p: 99 } } }, PIECES, PALETTES);
  check('sanitizeSaved: drops what is no longer valid', clean.pieceId === PIECES[0].id && clean.preset === 'hero' && clean.palette === PALETTES[0].id && clean.speed === 1 && clean.wireframe === false && !('ghost' in clean.params));
  check('sanitizeSaved: repairs saved parameters', clean.params[PIECES[0].id].p === PIECES[0].params.p.max);
  check('sanitizeSaved: survives junk', sanitizeSaved('x', PIECES, PALETTES).pieceId === PIECES[0].id && sanitizeSaved(undefined, PIECES, PALETTES).studio === true);
}

section('Palettes and camera presets');
{
  check('there are at least three palettes with unique ids', PALETTES.length >= 3 && new Set(PALETTES.map((p) => p.id)).size === PALETTES.length);
  check('every palette has four colours, an accent, a light and a two-stop backdrop, all hex', PALETTES.every((p) => p.colors.length === 4 && [...p.colors, p.accent, p.light, ...p.bg].every((c) => hex.test(c)) && p.bg.length === 2));
  check('the default palette exists and an unknown id falls back to it', getPalette(DEFAULT_PALETTE_ID).id === DEFAULT_PALETTE_ID && getPalette('nope').id === DEFAULT_PALETTE_ID);
  check('presets are Hero, Close-up and Overview', CAMERA_PRESETS.map((c) => c.id).join() === 'hero,close,overview');
  check('every preset has a finite position, target and a sensible fov', CAMERA_PRESETS.every((c) => [...c.position, ...c.target].every(Number.isFinite) && c.position.length === 3 && c.fov > 10 && c.fov < 90));
  check('the overview looks down from above', CAMERA_PRESETS[2].position[1] > 5 && Math.abs(CAMERA_PRESETS[2].position[0]) < 0.5);
  check('presetFor applies a piece override and falls back to Hero', presetFor({ camera: { hero: { position: [1, 2, 3] } } }, 'hero').position.join() === '1,2,3' && presetFor(null, 'nope').id === 'hero');
  check('the Close-up is nearer than the Hero for every piece', PIECES.every((p) => { const d = (c) => Math.hypot(...c.position.map((v, i) => v - c.target[i])); return d(presetFor(p, 'close')) < d(presetFor(p, 'hero')); }));
  check('the stage lifts the camera by the same rule for narrow screens (portrait stands back)', /1 \+ \(1 - aspect\) \* 0\.9/.test(read('src/art/ArtStage.jsx')));
}

section('Ribbon geometry');
{
  const g = ribbonKnotGeometry({ segments: 120 });
  const count = g.attributes.position.count;
  check('vertex count is (segments + 1) x (across + 1)', count === 121 * (RIBBON_ACROSS + 1), `${count}`);
  check('two triangles per cell', g.index.count === 120 * RIBBON_ACROSS * 6);
  check('positions, normals and colours are finite', ['position', 'normal', 'color'].every((a) => g.attributes[a].array.every(Number.isFinite)));
  check('normals are unit length', (() => { const n = g.attributes.normal.array; for (let i = 0; i < n.length; i += 3) if (Math.abs(Math.hypot(n[i], n[i + 1], n[i + 2]) - 1) > 1e-3) return false; return true; })());
  g.computeBoundingBox();
  const size = g.boundingBox.getSize(g.boundingBox.max.clone());
  check('the ribbon is a sensible size (about 3 to 8 units across)', size.x > 3 && size.x < 8 && size.y > 0.5 && size.z > 3 && size.z < 8, JSON.stringify(size));
  const again = ribbonKnotGeometry({ segments: 120 });
  check('deterministic: the same options give the same positions', g.attributes.position.array.every((v, i) => v === again.attributes.position.array[i]));
  const other = (o) => ribbonKnotGeometry({ segments: 120, ...o });
  const differs = (a, b) => a.attributes.position.array.some((v, i) => Math.abs(v - b.attributes.position.array[i]) > 1e-6);
  check('p, q, twist, width and wobble each change the shape', differs(g, other({ p: 5 })) && differs(g, other({ q: 3 })) && differs(g, other({ twist: 6 })) && differs(g, other({ width: 0.5 })) && differs(g, other({ noise: 0.4 })));
  check('a different palette changes the colours, not the shape', !differs(g, other({ colors: ['#0000ff', '#00ffff', '#ffffff'] })) && g.attributes.color.array.some((v, i) => v !== other({ colors: ['#0000ff', '#00ffff', '#ffffff'] }).attributes.color.array[i]));
  check('a negative twist (the counter-ribbon) builds too', ribbonKnotGeometry({ segments: 60, twist: -3 }).attributes.position.array.every(Number.isFinite));
  check('extreme settings stay finite', [{ p: 7, q: 5, twist: 8, width: 0.6, noise: 0.5 }, { p: 2, q: 1, twist: 0, width: 0.05, noise: 0 }].every((o) => ribbonKnotGeometry({ segments: 80, ...o }).attributes.position.array.every(Number.isFinite)));
  check('the default piece settings build a valid ribbon', (() => { const d = defaultsOf(PIECES.find((p) => p.id === 'ribbon-knot').params); const r = ribbonKnotGeometry({ p: d.p, q: d.q, twist: d.twist, width: d.width, noise: d.wobble, segments: 100 }); return r.attributes.position.array.every(Number.isFinite); })());
}

section('Shaders');
{
  const u = iridescentUniforms();
  const src = iridescentVertex + iridescentFragment;
  check('every uniform the code sets is declared in the shader', Object.keys(u).every((k) => new RegExp(`uniform \\w+ ${k};`).test(src)), Object.keys(u).join());
  check('every declared uniform exists in the uniform set', [...src.matchAll(/uniform \w+ (u\w+);/g)].every((m) => m[1] in u));
  check('the fragment shader ends by writing the colour, with tone mapping and colour space', iridescentFragment.includes('gl_FragColor') && iridescentFragment.includes('<tonemapping_fragment>') && iridescentFragment.includes('<colorspace_fragment>'));
  check('every #include sits on its own line (GLSL needs that)', [...(iridescentVertex + iridescentFragment + read('src/art/ArtStage.jsx')).matchAll(/^(.*)#include/gm)].every((m) => /^\s*$/.test(m[1]) || /^\s*(\/\/|\*)/.test(m[1])));
  check('the noise snippet is included once and defines snoise', iridescentVertex.includes('float snoise(vec3 v)') && (iridescentVertex.match(/float snoise/g) ?? []).length === 1 && NOISE_GLSL.includes('snoise'));
  check('the shader has a fresnel rim and an iridescence term', /pow\(1\.0 - facing, uRim\)/.test(iridescentFragment) && iridescentFragment.includes('uIridescence'));
  check('braces and parentheses balance', [iridescentVertex, iridescentFragment].every((s) => (s.match(/\{/g) ?? []).length === (s.match(/\}/g) ?? []).length && (s.match(/\(/g) ?? []).length === (s.match(/\)/g) ?? []).length));
}

section('Art Lab store');
{
  const st = () => useArtStore.getState();
  check('starts on the first piece, Hero camera, studio on, helpers off', st().pieceId === PIECES[0].id && st().preset === 'hero' && st().studio === true && st().grid === false && st().wireframe === false);
  st().setPiece(PIECES[1].id);
  check('setPiece switches', st().pieceId === PIECES[1].id);
  st().setPiece('nope');
  check('an unknown piece is ignored', st().pieceId === PIECES[1].id);
  st().stepPiece(1);
  st().stepPiece(1);
  check('stepping wraps round the list', st().pieceId === PIECES[(1 + 2) % PIECES.length].id);
  st().stepPiece(-1);
  check('stepping back works', st().pieceId === PIECES[(1 + 1) % PIECES.length].id);
  const id = PIECES[0].id;
  const key = Object.keys(PIECES[0].params).find((k) => PIECES[0].params[k].type === 'range');
  st().setParam(id, key, 1e9);
  check('setParam clamps to the schema', st().params[id][key] === PIECES[0].params[key].max);
  st().setParam(id, 'nonexistent', 5);
  check('an unknown parameter is ignored', !('nonexistent' in (st().params[id] ?? {})));
  st().resetParams(id);
  check('resetParams clears the piece', !(id in st().params));
  const nonce = st().viewNonce;
  st().setPreset('close');
  check('setPreset changes the preset and asks the camera to move', st().preset === 'close' && st().viewNonce === nonce + 1);
  st().setPreset('sideways');
  check('an unknown preset is ignored', st().preset === 'close');
  st().resetView();
  check('resetView asks the camera to move', st().viewNonce === nonce + 2);
  st().setPalette('frost');
  st().setPalette('neon');
  check('setPalette ignores unknown palettes', st().palette === 'frost');
  st().setSpeed(99);
  check('speed is clamped to 0..3', st().speed === 3);
  st().setSpeed(NaN);
  check('a bad speed is ignored', st().speed === 3);
  st().toggle('grid');
  st().toggle('bogus');
  check('toggle flips known flags only', st().grid === true && !('bogus' in st()));
  const paused = st().paused;
  st().togglePaused();
  check('pause toggles', st().paused === !paused);
  st().setHud('collapsed');
  st().setHud('weird');
  check('hud mode: open or collapsed only', st().hud === 'collapsed');
  st().setHidden(true);
  check('hidden is separate from collapsed', st().hidden === true && st().hud === 'collapsed');
}

section('Wiring and separation from the game');
{
  check('there is an Art screen', SCREENS.ART === 'art');
  check('the start screen tolerates a stubbed window with no location (other tests stub one)', /window\.location\?\.search/.test(read('src/store/useGameStore.js')));
  const app = read('src/App.jsx');
  check('App shows the Art Lab on the Art screen, as a lazy chunk', /lazy\(\(\) => import\('\.\/art\/ArtLabScreen\.jsx'\)\)/.test(app) && app.includes('SCREENS.ART'));
  check('the home screen has an Art Lab button', /label="Art Lab"/.test(read('src/components/ui/HomeScreen.jsx')));
  check('the game store can open the lab and a direct ?art link starts there', /openArt:/.test(read('src/store/useGameStore.js')) && /has\('art'\)/.test(read('src/store/useGameStore.js')));
  // The lab must not depend on the runner: no simulation, physics, obstacles, bot, rewards or game store (the screen may use the
  // store only to go back to the menu).
  const dir = path.join(root, 'src/art');
  const files = [];
  (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) f.isDirectory() ? walk(path.join(d, f.name)) : /\.(js|jsx)$/.test(f.name) && files.push(path.join(d, f.name)); })(dir);
  const banned = /from '\.\.\/(\.\.\/)?systems\/(game|physics|obstacles|bot|hazards|rewards|progression|world|fliers|powerups|scoring)|from '\.\.\/(\.\.\/)?scenes\/EmberValley/;
  check('no file in src/art imports the simulation or the game scenes', files.every((f) => !banned.test(fs.readFileSync(f, 'utf8'))), files.filter((f) => banned.test(fs.readFileSync(f, 'utf8'))).join());
  const usesGameStore = files.filter((f) => /useGameStore\.js/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.basename(f));
  check('only the screen touches the game store (to go back to the menu)', usesGameStore.join() === 'ArtLabScreen.jsx', usesGameStore.join());
  check('the lab uses the shared canvas wrapper (DPR cap, error boundary)', read('src/art/ArtLabScreen.jsx').includes('SceneCanvas'));
  check('no new dependency was added for the lab', !/postprocessing|leva|lil-gui|tweakpane/.test(read('package.json')));
  check('the lab saves under its own storage key, not the game\'s', /loadValue\('art'/.test(read('src/art/useArtStore.js')));
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
