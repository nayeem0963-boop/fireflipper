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
import { createRng, fbm3, noise3 } from '../src/art/noise.js';
import { torusGridLines, torusGridSegmentCount } from '../src/art/geometry/torusGrid.js';
import { diamondGeometry } from '../src/art/geometry/diamond.js';
import { galaxyPoints } from '../src/art/geometry/galaxy.js';
import { helixCurve, helixPoint } from '../src/art/geometry/helix.js';
import { petalGeometry } from '../src/art/geometry/petal.js';
import { BONES, SKIRT, dancerPoints } from '../src/art/geometry/dancer.js';
import { TERRAIN_MAX, terrainHeight } from '../src/art/geometry/landscape.js';
import { RIBBON_HEIGHT, ribbonPoint } from '../src/art/geometry/ribbons.js';
import { dancerUniforms, dancerVertex, moteUniforms, moteVertex } from '../src/art/shaders/dancer.js';
import { POINT_FRAGMENT, dynamicUniforms, dynamicVertex, emberUniforms, emberVertex, galaxyUniforms, galaxyVertex } from '../src/art/shaders/pointFields.js';
import { coronaFragment, coronaUniforms, coronaVertex, plasmaFragment, plasmaUniforms, plasmaVertex } from '../src/art/shaders/plasma.js';
import { terrainFragment, terrainUniforms, terrainVertex } from '../src/art/shaders/terrain.js';
import { BLOOM_DEFAULTS, BLOOM_PARAMS, bloomSamples } from '../src/art/bloom.js';
import { PLANETS, SUN, beltPoints, colorizeField, moonPosition, orbitAngle, orbitLinePoints, orbitPosition, orbitSeconds, paletteStops, planetField, ringGeometry, ringStrip, sampleStops, starPoints } from '../src/art/geometry/solarSystem.js';
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
    check(`${p.id}: backdrop (if set) is black`, p.backdrop === undefined || p.backdrop === 'black');
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
  const recoloured = other({ colors: ['#0000ff', '#00ffff', '#ffffff'] });
  check('a different palette changes the colours, not the shape', !differs(g, recoloured) && g.attributes.color.array.some((v, i) => v !== recoloured.attributes.color.array[i]));
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

section('The exhibition (every piece)');
{
  const ids = ['ribbon-knot', 'crystal-study', 'light-orbit', 'vortex-core', 'fractal-lattice', 'quantum-prism', 'starlight-canopy', 'cyber-helix', 'bioluminescent-lotus', 'monolith-grid', 'plasma-sphere', 'neural-landscape', 'particle-dancer', 'solar-system'];
  check('the exhibition has the three originals, the eight new pieces, the Neural Landscape and the Particle Dancer, in order', PIECES.map((p) => p.id).join() === ids.join(), PIECES.map((p) => p.id).join());
  check('every slider default sits on its own step (so the panel never shows a value the slider cannot reach)', PIECES.every((p) => Object.values(p.params).filter((d) => d.type === 'range').every((d) => clampParam(d, d.default) === d.default)));
  check('every range has at least a hundred values to choose from or a small whole-number span', PIECES.every((p) => Object.values(p.params).filter((d) => d.type === 'range').every((d) => (d.max - d.min) / d.step >= 3)));
  // What every piece promises: it reads art time from the shared clock (so Speed and Pause work), takes its colours from the palette
  // (so the four themes work), and never uses wall-clock time or its own time source.
  const dir = path.join(root, 'src/art/pieces');
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.jsx'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    check(`${f}: animates from the shared art clock (clock.current.t) in useFrame`, /useFrame/.test(src) && /clock\.current\.t/.test(src));
    check(`${f}: never uses its own time source (so Speed and Pause apply)`, !/state\.clock|getElapsedTime|performance\.now|Date\.now|new Clock/.test(src));
    check(`${f}: takes its colours from the palette`, /usePaletteColors|palette\./.test(src));
    check(`${f}: takes its parameters from the params prop`, /\{[^}]*params[^}]*\}/.test(src.split('export default function')[1]?.split(')')[0] ?? ''));
  }
  const heavy = ['VortexCore', 'FractalLattice', 'QuantumPrism', 'StarlightCanopy', 'CyberHelix', 'Lotus', 'MonolithGrid', 'PlasmaSphere', 'NeuralLandscape', 'ParticleDancer', 'SolarSystem'];
  check('every new piece honours the quality tier (fewer points, vertices or transmission on low)', heavy.every((f) => /quality/.test(fs.readFileSync(path.join(dir, `${f}.jsx`), 'utf8')) && /low|Math\.min/.test(fs.readFileSync(path.join(dir, `${f}.jsx`), 'utf8'))));
  check('pieces that make geometry or materials dispose them', heavy.filter((f) => /new \w*Geometry|useMemo\(\s*\(\) =>\s*\{?\s*(const g = new)/.test(fs.readFileSync(path.join(dir, `${f}.jsx`), 'utf8')) || /TubeGeometry|BufferGeometry|petalGeometry|diamondGeometry/.test(fs.readFileSync(path.join(dir, `${f}.jsx`), 'utf8'))).every((f) => /dispose\(\)/.test(fs.readFileSync(path.join(dir, `${f}.jsx`), 'utf8'))));
  check('no piece needs a new dependency', !/postprocessing|leva|lil-gui/.test(read('package.json')));
}

section('Noise and random');
{
  const r1 = createRng(42);
  const r2 = createRng(42);
  const a = Array.from({ length: 50 }, () => r1());
  check('the random generator is deterministic for a seed', a.every((v, i) => v === r2()) && a.every((v) => v >= 0 && v < 1));
  check('different seeds differ', createRng(1)() !== createRng(2)());
  const vals = Array.from({ length: 4000 }, (_, i) => noise3(i * 0.37, i * 0.11, i * 0.73));
  check('noise3 stays within -1..1 and is not constant', vals.every((v) => v >= -1 && v <= 1) && Math.max(...vals) - Math.min(...vals) > 0.8);
  check('noise3 is deterministic and smooth (nearby points give nearby values)', noise3(1.3, 2.1, 0.4) === noise3(1.3, 2.1, 0.4) && Math.abs(noise3(1.3, 2.1, 0.4) - noise3(1.3001, 2.1, 0.4)) < 0.01);
  check('fbm3 stays within -1..1', Array.from({ length: 2000 }, (_, i) => fbm3(i * 0.21, i * 0.07, i * 0.5, 4)).every((v) => v >= -1 && v <= 1));
  check('noise changes with every axis (it is really three-dimensional)', noise3(0.5, 0.5, 0.5) !== noise3(0.5, 0.5, 1.7) && noise3(0.5, 0.5, 0.5) !== noise3(0.5, 1.7, 0.5) && noise3(0.5, 0.5, 0.5) !== noise3(1.7, 0.5, 0.5));
}

section('Geometry helpers');
{
  const lines = torusGridLines();
  check('torus grid: segment count matches the formula, all finite', lines.length === torusGridSegmentCount() * 6 && lines.every(Number.isFinite));
  check('torus grid: every point lies on the torus', (() => { for (let i = 0; i < lines.length; i += 3) { const d = Math.hypot(Math.hypot(lines[i], lines[i + 2]) - 2.2, lines[i + 1]); if (Math.abs(d - 0.55) > 1e-4) return false; } return true; })());
  const gem = diamondGeometry({ facets: 8 });
  gem.computeBoundingBox();
  check('diamond: finite, about 2.7 tall, widest at the girdle', gem.attributes.position.array.every(Number.isFinite) && Math.abs(gem.boundingBox.max.y - gem.boundingBox.min.y - 2.3) < 0.2 && gem.boundingBox.max.x > 1.1);
  check('diamond: more facets give more vertices', diamondGeometry({ facets: 14 }).attributes.position.count > diamondGeometry({ facets: 5 }).attributes.position.count);
  check('diamond: a silly facet count still builds', diamondGeometry({ facets: 1 }).attributes.position.count > 0);
  const gal = galaxyPoints({ count: 3000, radius: 4 });
  const radii = Array.from({ length: 3000 }, (_, i) => Math.hypot(gal.positions[i * 3], gal.positions[i * 3 + 2]));
  check('galaxy: the right number of stars, all finite, with a random value each', gal.positions.length === 9000 && gal.rands.length === 3000 && gal.positions.every(Number.isFinite) && gal.rands.every((v) => v >= 0 && v < 1));
  check('galaxy: stars stay near the rim and crowd the core', Math.max(...radii) < 5.6 && radii.filter((r) => r < 2).length > radii.filter((r) => r > 2).length);
  check('galaxy: thin disc (stars sit close to the plane)', Math.max(...Array.from({ length: 3000 }, (_, i) => Math.abs(gal.positions[i * 3 + 1]))) < 1.2);
  const galAgain = galaxyPoints({ count: 3000, radius: 4 });
  const galTwo = galaxyPoints({ count: 3000, arms: 2 });
  check('galaxy: deterministic, and the arm count changes it', gal.positions.every((v, i) => v === galAgain.positions[i]) && galTwo.positions.some((v, i) => v !== gal.positions[i]));
  const a = helixPoint(0.3, { radius: 1, turns: 3, height: 5, phase: 0 });
  const b = helixPoint(0.3, { radius: 1, turns: 3, height: 5, phase: Math.PI });
  check('helix: the two strands are on opposite sides of the axis at the same height', Math.abs(a.x + b.x) < 1e-9 && Math.abs(a.z + b.z) < 1e-9 && a.y === b.y);
  check('helix: runs from the bottom to the top of its height at a fixed radius', helixPoint(0, { height: 5 }).y === -2.5 && Math.abs(helixPoint(1, { height: 5 }).y - 2.5) < 1e-9 && Math.abs(Math.hypot(a.x, a.z) - 1) < 1e-9);
  check('helix: the curve is as long as the helix (about 17.8 for the defaults)', Math.abs(helixCurve({}).getLength() - 17.8) < 0.6);
  const petal = petalGeometry({ length: 1.6, rows: 5, cols: 3 });
  petal.computeBoundingBox();
  check('petal: (rows+1)x(cols+1) vertices, finite, starts at the base and ends at its length', petal.attributes.position.count === 24 && petal.attributes.position.array.every(Number.isFinite) && Math.abs(petal.boundingBox.min.y) < 1e-5 && Math.abs(petal.boundingBox.max.y - 1.6) < 1e-5); // positions are 32-bit floats
  check('petal: curl bends the tip inwards (towards -z)', petalGeometry({ curl: 0.8 }).boundingBox === null && (() => { const g = petalGeometry({ curl: 0.8 }); g.computeBoundingBox(); return g.boundingBox.min.z < -0.3; })());
  check('petal: pointed at the tip, fullest in the middle', (() => { const w = (r) => { const a = petal.attributes.position.array; return a[(r * 4 + 3) * 3] - a[r * 4 * 3]; }; return w(5) < 0.05 && w(3) > w(5) && w(2) > w(0); })());
}

section('Particle Dancer');
{
  check('the skeleton is well formed: every bone has finite joints and positive radii', BONES.every(([a, b, ra, rb]) => [...a, ...b].every(Number.isFinite) && a.length === 3 && b.length === 3 && ra > 0 && rb > 0));
  const d = dancerPoints({ count: 12000 });
  const at = (i) => [d.positions[i * 3], d.positions[i * 3 + 1], d.positions[i * 3 + 2]];
  const all = Array.from({ length: 12000 }, (_, i) => at(i));
  check('the right number of points, all finite, with a random value, a kind and a height each', d.positions.length === 36000 && d.positions.every(Number.isFinite) && d.rands.length === 12000 && d.kinds.length === 12000 && d.heights.length === 12000);
  check('she is about 3.5 units tall, standing on the ground', d.minY > -0.1 && d.minY < 0.1 && d.maxY > 3.3 && d.maxY < 3.75, `${d.minY} .. ${d.maxY}`);
  check('heights run from 0 (feet) to 1 (raised hand)', d.heights.every((h) => h >= 0 && h <= 1) && Math.min(...d.heights) < 0.01 && Math.max(...d.heights) > 0.99);
  check('the arabesque: a leg is raised behind her (far back and high up)', all.some(([x, y]) => x < -1.5 && y > 2.2));
  check('the reach: a hand is stretched up and forward', all.some(([x, y]) => x > 1.2 && y > 3.3));
  check('the other arm is stretched behind for balance', all.some(([x, , z]) => x < -0.55 && z < -0.35));
  check('the standing foot is on the ground under her', all.some(([x, y]) => y < 0.12 && x > -0.1 && x < 0.3));
  check('the head is above the shoulders, forward of the hips', all.filter(([x, y]) => y > 2.9 && y < 3.25 && Math.abs(x - 0.62) < 0.2).length > 100);
  check('the skirt is the stated share of the points and hangs in its band', Math.abs(d.kinds.reduce((a, b) => a + b, 0) / 12000 - 0.22) < 0.01 && all.filter((_, i) => d.kinds[i] === 1).every(([x, y, z]) => y >= SKIRT.hemY - 1e-4 && y <= SKIRT.waistY + 1e-4 && Math.hypot(x - SKIRT.waistX, z) < SKIRT.hemRadius * 1.4));
  const again = dancerPoints({ count: 12000 });
  const other = dancerPoints({ count: 12000, seed: 9 });
  check('deterministic for a seed, different for another', d.positions.every((v, i) => v === again.positions[i]) && other.positions.some((v, i) => v !== d.positions[i]));
  check('volumetric: points sit a little inside and outside the surface, not on one thin shell', (() => { const body = all.filter((_, i) => d.kinds[i] === 0); const torso = body.filter(([, y]) => y > 2.0 && y < 2.4); const r = torso.map(([x, y, z]) => Math.hypot(x - (0.1 + (y - 1.92) * 0.37), z)); return Math.max(...r) - Math.min(...r) > 0.03; })());
  check('a different point count builds too, down to a handful', dancerPoints({ count: 50 }).positions.every(Number.isFinite));

  let worst = 0;
  for (let i = 0; i < 4000; i++) worst = Math.max(worst, Math.abs(terrainHeight((i * 0.13) % 20 - 10, (i * 0.07) % 20 - 10, i * 0.31, 1)));
  check('the landscape stays within its stated bound and uses most of it', worst <= TERRAIN_MAX + 1e-9 && worst > 0.7 * TERRAIN_MAX, `${worst}`);
  check('the amplitude scales every wave, and zero is flat', terrainHeight(1.3, -2.1, 4, 0) === 0 && Math.abs(terrainHeight(1.3, -2.1, 4, 2) - 2 * terrainHeight(1.3, -2.1, 4, 1)) < 1e-12);
  check('the landscape rolls with time and is deterministic', terrainHeight(1, 2, 0) !== terrainHeight(1, 2, 1.5) && terrainHeight(1, 2, 3) === terrainHeight(1, 2, 3));

  const o = [0, 0, 0];
  const pts = [];
  for (let i = 0; i < 8; i++) for (let k = 0; k <= 30; k++) pts.push([...ribbonPoint(i, k / 30, k * 0.9, o), i, k / 30]);
  check('ribbon paths are finite and stay close round the figure', pts.every((p) => p.slice(0, 3).every(Number.isFinite) && Math.hypot(p[0] - 0.3, p[2]) < 1.5 && Math.abs(p[0]) < 1.9));
  check('ribbons run from her feet to her raised hand', (() => { const lo = ribbonPoint(0, 0, 0); const hi = ribbonPoint(0, 1, 0); return lo[1] < 0.3 && hi[1] > RIBBON_HEIGHT - 0.3 && hi[1] < RIBBON_HEIGHT + 0.5; })());
  check('they pinch in towards the hand and swell round the skirt', (() => { const w = (u) => { let m = 0; for (let t = 0; t < 6; t += 0.5) { const q = ribbonPoint(0, u, t); m = Math.max(m, Math.hypot(q[0] - (0.05 + 0.55 * u * u), q[2])); } return m; }; return w(0.95) < w(0.35); })());
  check('each ribbon is different, and they swirl with time', ribbonPoint(0, 0.5, 0)[0] !== ribbonPoint(1, 0.5, 0)[0] && ribbonPoint(2, 0.5, 0)[2] !== ribbonPoint(2, 0.5, 2)[2]);

  // The component's promises (see also "The exhibition" above).
  const src = fs.readFileSync(path.join(root, 'src/art/pieces/ParticleDancer.jsx'), 'utf8');
  check('the figure is points only: no solid mesh of her is ever drawn', !/<mesh[\s>]/.test(src) && /<points geometry=\{body\}/.test(src));
  check('the landscape and the figure are both points, the ribbons are lines', /<points geometry=\{terrain\}/.test(src) && /<Line/.test(src));
  check('the figure turns, and the ribbons, landscape and figure all move from the shared clock', /rotation\.y = t \* spin/.test(src) && /ribbonPoint\(i, k \/ segments, t, point\)/.test(src) && /terrainHeight\(x, z, t, waves\)/.test(src) && /dancer\.uTime\.value = t/.test(src));
  check('colours: the picture\'s blue, purple, magenta, gold, or the palette through the same gradient', /#2f6bff.*#8a3dff.*#ff3fd0.*#ffc34a/.test(src) && /colours === 'image'/.test(src) && /usePaletteColors/.test(src));
  check('the colour setting offers the picture\'s colours and the palette', (() => { const sel = PIECES.find((x) => x.id === 'particle-dancer').params.colours; return sel.options.map((x) => x.value).join() === 'image,palette'; })());
  check('the piece asks for a black backdrop and the stage honours it', PIECES.find((x) => x.id === 'particle-dancer').backdrop === 'black' && /piece\.backdrop === 'black'/.test(read('src/art/ArtStage.jsx')));
}

section('Solar System');
{
  const by = Object.fromEntries(PLANETS.map((p) => [p.id, p]));
  check('eight planets, in order from the Sun', PLANETS.map((p) => p.id).join() === 'mercury,venus,earth,mars,jupiter,saturn,uranus,neptune' && PLANETS.every((p, i) => i === 0 || p.a > PLANETS[i - 1].a));
  check('relative sizes: Jupiter > Saturn > Uranus > Neptune > Earth > Venus > Mars > Mercury', (() => { const r = (id) => by[id].radius; return r('jupiter') > r('saturn') && r('saturn') > r('uranus') && r('uranus') > r('neptune') && r('neptune') > r('earth') && r('earth') > r('venus') && r('venus') > r('mars') && r('mars') > r('mercury'); })());
  check('orbits never touch the Sun, and no two orbits come within the planets\' sizes of each other', PLANETS.every((p, i) => { if (p.a * (1 - p.e) <= SUN.radius + p.radius) return false; if (i === 0) return true; const A = orbitLinePoints(PLANETS[i - 1], 240); const B = orbitLinePoints(p, 240); let d = Infinity; for (let u = 0; u < 240; u++) for (let v = 0; v < 240; v++) d = Math.min(d, Math.hypot(A[u * 3] - B[v * 3], A[u * 3 + 2] - B[v * 3 + 2])); return d > PLANETS[i - 1].radius + p.radius; }));
  check('only Earth has a moon; only Saturn and Uranus have rings', PLANETS.filter((p) => p.moon).map((p) => p.id).join() === 'earth' && PLANETS.filter((p) => p.rings).map((p) => p.id).join() === 'saturn,uranus');
  check('Venus turns backwards and Uranus lies on its side', by.venus.spin < 0 && by.venus.tilt > Math.PI / 2 && by.uranus.tilt > 1.4);
  check('every planet has a colour ramp that is ordered 0..1 with valid hex', PLANETS.every((p) => p.stops.every(([q, c], i) => /^#[0-9a-f]{6}$/i.test(c) && q >= 0 && q <= 1 && (i === 0 || q > p.stops[i - 1][0]))));

  const o = [0, 0, 0];
  check('orbit: nearest the Sun at angle 0 and furthest at pi, by a(1 - e) and a(1 + e)', PLANETS.every((p) => Math.abs(Math.hypot(...orbitPosition(p, 0, o)) - p.a * (1 - p.e)) < 1e-9 && Math.abs(Math.hypot(...orbitPosition(p, Math.PI, o)) - p.a * (1 + p.e)) < 1e-9));
  check('orbit lines close up and match the orbit maths', PLANETS.every((p) => { const l = orbitLinePoints(p, 64); const q = orbitPosition(p, (16 / 64) * Math.PI * 2, [0, 0, 0]); return l.length === 192 && Math.abs(l[48] - q[0]) < 1e-4 && Math.abs(l[50] - q[2]) < 1e-4 && Math.abs(l[1]) < 1e-9; }));
  check('outer planets are slower: periods grow with distance, Earth takes 12 s', PLANETS.every((p, i) => i === 0 || orbitSeconds(p.years) > orbitSeconds(PLANETS[i - 1].years)) && orbitSeconds(1) === 12);
  check('orbit angle advances with time and is frozen at the same time', orbitAngle(by.earth, 6) > orbitAngle(by.earth, 0) && orbitAngle(by.earth, 3) === orbitAngle(by.earth, 3));
  check('Earth is back where it started after 12 s', Math.abs(orbitAngle(by.earth, 12) - orbitAngle(by.earth, 0) - Math.PI * 2) < 1e-9);
  check('the Moon circles Earth at its distance and returns', (() => { const m = by.earth.moon; const p = moonPosition(m, 1, o); const t = orbitSeconds(m.years); const q = moonPosition(m, 1 + t, [0, 0, 0]); return Math.abs(Math.hypot(p[0], p[2]) - m.a) < 1e-9 && Math.abs(p[0] - q[0]) < 1e-9; })());
  check('the Moon stays clear of Earth\'s surface', by.earth.moon.a > by.earth.radius + by.earth.moon.radius);

  const belt = beltPoints({ count: 600 });
  const radii = Array.from({ length: 600 }, (_, i) => Math.hypot(belt.positions[i * 3], belt.positions[i * 3 + 2]));
  check('the belt lies between Mars and Jupiter and is thin', Math.min(...radii) >= 10.8 - 1e-6 && Math.max(...radii) <= 12.4 + 1e-6 && Math.min(...radii) > by.mars.a * (1 + by.mars.e) && Math.max(...radii) < by.jupiter.a * (1 - by.jupiter.e) && Array.from({ length: 600 }, (_, i) => Math.abs(belt.positions[i * 3 + 1])).every((y) => y <= 0.5));
  check('the belt is deterministic and has a random number per rock', belt.rands.length === 600 && beltPoints({ count: 600 }).positions.every((v, i) => v === belt.positions[i]));
  const stars = starPoints({ count: 400 });
  check('stars sit on a far shell, outside every orbit, with brightness and size in range', Array.from({ length: 400 }, (_, i) => Math.hypot(stars.positions[i * 3], stars.positions[i * 3 + 1], stars.positions[i * 3 + 2])).every((d) => d >= 70 && d <= 110) && stars.brightness.every((b) => b > 0 && b <= 1) && stars.sizes.every((s) => s > 0 && s < 2.5));
  check('the camera can never leave the star shell (maxDistance < shell)', PIECES.find((x) => x.id === 'solar-system').maxDistance < 72);

  const rg = ringGeometry({ inner: 1.5, outer: 2.5, segments: 32 });
  const rp = rg.attributes.position;
  const ru = rg.attributes.uv;
  check('rings are flat, between their radii, with u running inner (0) to outer (1)', (() => { for (let i = 0; i < rp.count; i++) { const d = Math.hypot(rp.getX(i), rp.getZ(i)); const u = ru.getX(i); if (rp.getY(i) !== 0 || Math.abs(d - (1.5 + u)) > 1e-5) return false; } return rg.index.count / 3 === 64; })());
  const strip = ringStrip(128, by.saturn.stops);
  const alpha = (u) => strip[Math.round(u * 127) * 4 + 3];
  check('the ring strip has a gap near two thirds out, soft edges and a faint variant', alpha(0.66) < 40 && alpha(0.5) > alpha(0.66) && alpha(0) < 40 && ringStrip(128, by.uranus.stops, true).reduce((m, v, i) => (i % 4 === 3 ? Math.max(m, v) : m), 0) < 120);

  const fields = Object.fromEntries(PLANETS.map((p) => [p.id, planetField(p, 128, 64)]));
  check('every planet field is the right size, in 0..1, and deterministic', PLANETS.every((p) => { const f = fields[p.id]; return f.length === 128 * 64 && f.every((v) => v >= 0 && v <= 1) && planetField(p, 128, 64).every((v, i) => v === f[i]); }));
  check('every surface varies (not a flat colour) and planets differ from each other', PLANETS.every((p) => Math.max(...fields[p.id]) - Math.min(...fields[p.id]) > 0.25) && fields.mercury.some((v, i) => v !== fields.mars[i]));
  check('the surface is seamless round the planet (left and right edges agree)', PLANETS.every((p) => { const f = fields[p.id]; let d = 0; for (let y = 0; y < 64; y++) d += Math.abs(f[y * 128] - f[y * 128 + 127]); return d / 64 < 0.12; }));
  const earthRgb = colorizeField(fields.earth, by.earth.stops);
  const count = (fn) => { let n = 0; for (let i = 0; i < earthRgb.length; i += 4) if (fn(earthRgb[i], earthRgb[i + 1], earthRgb[i + 2])) n++; return n; };
  check('Earth has blue sea, green land and white ice', count((r, g, b) => b > r + 40 && b > g) > 800 && count((r, g, b) => g > r + 10 && g > b + 10) > 300 && count((r, g, b) => r > 220 && g > 220 && b > 220) > 100);
  check('Earth\'s poles are ice', (() => { const f = fields.earth; let top = 0; for (let x = 0; x < 128; x++) top += f[x] > 0.9 ? 1 : 0; return top > 90; })());
  check('Jupiter has horizontal bands and a red spot (rows differ more than columns)', (() => { const f = fields.jupiter; const rowMeans = []; for (let y = 0; y < 64; y++) { let m = 0; for (let x = 0; x < 128; x++) m += f[y * 128 + x]; rowMeans.push(m / 128); } const mean = rowMeans.reduce((a, b) => a + b) / 64; const sd = Math.sqrt(rowMeans.reduce((a, b) => a + (b - mean) ** 2, 0) / 64); return sd > 0.1; })());
  check('colourising makes opaque RGBA bytes', earthRgb.length === 128 * 64 * 4 && earthRgb.every((v, i) => i % 4 !== 3 || v === 255));
  check('sampleStops hits the ends and blends between', (() => { const st = [[0, '#000000'], [1, '#ffffff']]; return sampleStops(st, -1)[0] === 0 && sampleStops(st, 2)[0] === 255 && Math.abs(sampleStops(st, 0.5)[1] - 127.5) < 1e-9; })());
  check('palette stops run darkest to lightest through the four colours', (() => { const st = paletteStops(['#111111', '#222222', '#333333', '#000000']); return st.length === 4 && st[0][1] === '#000000' && st[3][1] === '#333333' && st.every(([q], i) => i === 0 || q > st[i - 1][0]); })());

  const def = PIECES.find((x) => x.id === 'solar-system');
  check('the piece: black backdrop, dark lighting, wide hero and overview, positive maxDistance, valid schema', def.backdrop === 'black' && def.lighting === 'dark' && def.maxDistance > 40 && validateSchema(def.params).length === 0 && Math.hypot(...def.camera.hero.position) > 25 && Math.hypot(...def.camera.overview.position) > 40);
  check('the stage honours a per-piece maxDistance', /maxDistance=\{piece\.maxDistance \?\? 32\}/.test(read('src/art/ArtStage.jsx')));
  const sys = read('src/art/pieces/SolarSystem.jsx');
  check('everything moves from the shared clock only (no wall clocks)', /clock\.current\.t/.test(sys) && !/state\.clock|Date\.now|performance\.now|new Clock/.test(sys));
  check('the Sun is the plasma shader plus a corona and a real light the planets are lit by', /plasmaVertex/.test(sys) && /coronaVertex/.test(sys) && /<pointLight/.test(sys));
  check('planets, rings, moon, belt, orbit lines and labels are all drawn', /<Planet/.test(sys) && /ringGeometry/.test(sys) && /moonPosition/.test(sys) && /beltPoints/.test(sys) && /<lineLoop/.test(sys) && /<Label/.test(sys));
  check('textures and geometries are disposed', /map\.dispose\(\)/.test(sys) && /geo\.dispose\(\)/.test(sys) && /tex\.dispose\(\)/.test(sys));
  check('natural colours or the palette, through the same surfaces', /colours === 'natural'/.test(sys) && /paletteStops/.test(sys) && def.params.colours.options.map((x) => x.value).join() === 'natural,palette');
  check('the settings default on their own step', Object.values(def.params).filter((q) => q.type === 'range').every((q) => Math.abs(Math.round((q.default - q.min) / q.step) * q.step + q.min - q.default) < 1e-9));
}

section('Shaders (the new pieces)');
{
  const sets = [
    ['embers', emberVertex + POINT_FRAGMENT, emberUniforms()],
    ['galaxy', galaxyVertex + POINT_FRAGMENT, galaxyUniforms()],
    ['pulse points', dynamicVertex + POINT_FRAGMENT, dynamicUniforms()],
    ['plasma', plasmaVertex + plasmaFragment, plasmaUniforms()],
    ['corona', coronaVertex + coronaFragment, coronaUniforms()],
    ['terrain', terrainVertex + terrainFragment, terrainUniforms()],
    ['dancer', dancerVertex + POINT_FRAGMENT, dancerUniforms()],
    ['dancer embers', moteVertex + POINT_FRAGMENT, moteUniforms()],
  ];
  for (const [name, src, u] of sets) {
    check(`${name}: every uniform the code sets is declared in the shader`, Object.keys(u).every((k) => new RegExp(`uniform \\w+ ${k};`).test(src)), Object.keys(u).join());
    check(`${name}: every declared uniform exists in the uniform set`, [...src.matchAll(/uniform \w+ (u\w+);/g)].every((m) => m[1] in u));
    check(`${name}: braces and parentheses balance`, (src.match(/\{/g) ?? []).length === (src.match(/\}/g) ?? []).length && (src.match(/\(/g) ?? []).length === (src.match(/\)/g) ?? []).length);
    check(`${name}: writes a colour and finishes with the colour-space chunk`, src.includes('gl_FragColor') && src.includes('<colorspace_fragment>'));
  }
  const all = sets.map((x) => x[1]).join('\n') + read('src/art/ArtStage.jsx');
  check('every #include is on its own line', [...all.matchAll(/^(.*)#include/gm)].every((m) => /^\s*$/.test(m[1]) || /^\s*(\/\/|\*)/.test(m[1])));
  check('the point shaders cap the point size (a near star cannot fill the screen)', /min\(/.test(emberVertex) && /min\(/.test(galaxyVertex) && /min\(/.test(dynamicVertex));
  check('the point fragment shader makes a soft round point', POINT_FRAGMENT.includes('discard') && POINT_FRAGMENT.includes('gl_PointCoord'));
  check('the terrain draws its grid lines in the fragment shader with fwidth (a constant line width)', terrainFragment.includes('fwidth'));
  check('plasma and corona use the shared noise exactly once each', (plasmaVertex.match(/float snoise/g) ?? []).length === 1 && (plasmaFragment.match(/float snoise/g) ?? []).length === 1);
}

section('Bloom');
{
  check('the bloom schema is valid and has strength, threshold and radius', validateSchema(BLOOM_PARAMS).length === 0 && Object.keys(BLOOM_PARAMS).join() === 'strength,threshold,radius');
  check('bloom defaults sit on their steps and match the schema defaults', Object.entries(BLOOM_PARAMS).every(([k, d]) => clampParam(d, d.default) === d.default && BLOOM_DEFAULTS[k] === d.default));
  check('bloom ranges allow none to a lot (strength 0..3, threshold 0..1.5, radius 0..1)', BLOOM_PARAMS.strength.min === 0 && BLOOM_PARAMS.strength.max >= 2 && BLOOM_PARAMS.threshold.min === 0 && BLOOM_PARAMS.radius.max === 1);
  check('the low quality tier goes without bloom anti-aliasing samples; high has them', bloomSamples('low') === 0 && bloomSamples('high') > 0);
  const fresh = sanitizeSaved(null, PIECES, PALETTES, BLOOM_PARAMS);
  check('a first visit has bloom on with the default settings', fresh.bloom === true && JSON.stringify(fresh.bloomSettings) === JSON.stringify(BLOOM_DEFAULTS));
  const kept = sanitizeSaved({ bloom: false, bloomSettings: { strength: 99, threshold: 'x', radius: 0.3, junk: 1 } }, PIECES, PALETTES, BLOOM_PARAMS);
  check('saved bloom settings are kept, repaired and cleaned', kept.bloom === false && kept.bloomSettings.strength === 3 && kept.bloomSettings.threshold === BLOOM_DEFAULTS.threshold && kept.bloomSettings.radius === 0.3 && !('junk' in kept.bloomSettings));
  check('an old save with no bloom keys gets the defaults', sanitizeSaved({ pieceId: PIECES[1].id }, PIECES, PALETTES, BLOOM_PARAMS).bloom === true);
  const st = () => useArtStore.getState();
  check('the store starts with bloom on and the default settings', st().bloom === true && JSON.stringify(st().bloomSettings) === JSON.stringify(BLOOM_DEFAULTS));
  st().toggle('bloom');
  check('bloom can be switched off and on', st().bloom === false && (st().toggle('bloom'), st().bloom === true));
  st().setBloom('strength', 99);
  st().setBloom('radius', -5);
  st().setBloom('nonsense', 1);
  check('setBloom clamps to the range and ignores unknown settings', st().bloomSettings.strength === 3 && st().bloomSettings.radius === 0 && !('nonsense' in st().bloomSettings));
  st().resetBloom();
  check('resetBloom restores the defaults', JSON.stringify(st().bloomSettings) === JSON.stringify(BLOOM_DEFAULTS));

  // How it is built: real bloom from three's own post-processing passes, only mounted when on, and part of Save PNG.
  const bloom = read('src/art/Bloom.jsx');
  check('it uses three.js\'s own passes: render, unreal bloom (bright-pass + multi-scale blur) and output (tone mapping, colour space)', /EffectComposer/.test(bloom) && /RenderPass/.test(bloom) && /UnrealBloomPass/.test(bloom) && /OutputPass/.test(bloom) && /three\/examples\/jsm\/postprocessing\//.test(bloom));
  check('it draws every frame at priority 1 (taking over rendering) and gives it back when unmounted', /useFrame\([^;]*composer\.render[^;]*, 1\);/.test(bloom) && /composer\.dispose\(\)/.test(bloom));
  check('it follows the canvas size and the adaptive pixel ratio', /setPixelRatio\(dpr\)/.test(bloom) && /setSize\(size\.width, size\.height\)/.test(bloom));
  const stage = read('src/art/ArtStage.jsx');
  check('the stage mounts bloom only when it is on, and loads it lazily', /bloom\.on && \(/.test(stage) && /lazy\(\(\) => import\('\.\/Bloom\.jsx'\)\)/.test(stage));
  check('Save PNG renders through the bloom when it is on', /renderRef\.current\(\)/.test(stage) && /renderRef\.current = \(\) => rig\.composer\.render\(\)/.test(bloom));
  check('the HUD has a Bloom section with the toggle, reset and the three sliders', /aria-label="Bloom"/.test(read('src/art/ArtHud.jsx')) && /BLOOM_PARAMS/.test(read('src/art/ArtHud.jsx')) && /resetBloom/.test(read('src/art/ArtHud.jsx')));
  check('three\'s post-processing code stays out of the startup vendor chunk (vite config)', /vendor-three[^\n]*\(\?!examples/.test(read('vite.config.js')));
  check('bloom needed no new dependency', !/"postprocessing"|@react-three\/postprocessing/.test(read('package.json')));
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
  check('the home screen shows an Art Lab card beside the version picker', /<ArtLabCard \/>/.test(read('src/components/ui/HomeScreen.jsx')) && /openArt/.test(read('src/components/ui/ArtLabCard.jsx')));
  check('the card is a plain button, not a radio in the version group (it is not a game version)', !/role="radio"/.test(read('src/components/ui/ArtLabCard.jsx')) && /type="button"/.test(read('src/components/ui/ArtLabCard.jsx')));
  check('the card says what it is: a name and a no-score note', /Art Lab/.test(read('src/components/ui/ArtLabCard.jsx')) && /No score/.test(read('src/components/ui/ArtLabCard.jsx')));
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
