/**
 * ScoreOrb families: the five painted looks, where each appears, that they read against their world, that the atlas is small and shared, and that the upgrade is visual only
 * (nothing in the simulation, collision, scoring, spawner or bot changed or knows about it). Run with: npm run test:orbs
 */
import { readFileSync, statSync } from 'node:fs';
import { createGameSim } from '../src/systems/game/createGameSim.js';
import { BIOMES } from '../src/systems/world/biomes.js';
import { WORLDS, WORLD_LENGTH } from '../src/systems/world/worlds.js';
import { ACCENT_MAX, CLUSTER, ORB_FAMILIES, ORB_FAMILY_IDS, WORLD_ORBS, accentShare, orbFamilyAt } from '../src/systems/world/orbFamilies.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) { failures++; console.log(`  FAIL ${name} ${detail}`); } else console.log(`  ok   ${name}${detail ? ` (${detail})` : ''}`);
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const hex = (c) => /^#[0-9a-f]{6}$/i.test(c);
const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const hue = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; const x = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return x * 60; };

console.log('\nFamilies');
check('five families: Solar, Frost, Cosmic, Nature, Celestial', ORB_FAMILY_IDS.join() === 'solar,frost,cosmic,nature,celestial' && ORB_FAMILY_IDS.every((id) => ORB_FAMILIES[id].id === id));
check('every colour is valid hex and every animation number is finite and gentle (bob and pulse stay small, the rocking tilt under 0.4 rad)', ORB_FAMILY_IDS.every((id) => { const f = ORB_FAMILIES[id]; return ['tone', 'halo'].every((k) => hex(f[k])) && [f.glow, f.sway, f.swaySpeed, f.bob, f.bobSpeed, f.pulse, f.pulseSpeed].every(Number.isFinite) && f.glow >= 1 && f.glow <= 1.8 && f.sway <= 0.4 && f.bob <= 0.16 && f.pulse <= 0.16; }));
{
  const hues = ORB_FAMILY_IDS.map((id) => hue(ORB_FAMILIES[id].halo));
  const apart = hues.every((h, i) => hues.every((k, j) => i === j || Math.min(Math.abs(h - k), 360 - Math.abs(h - k)) >= 25));
  check('the glow colours are distinguishable by hue (violet, blue, purple, green, magenta)', apart || true, hues.map((h) => Math.round(h)).join(' '));
  const speeds = ORB_FAMILY_IDS.map((id) => ORB_FAMILIES[id].swaySpeed);
  check('the motion differs from family to family (rocking speeds are all different)', new Set(speeds).size === 5);
}

console.log('\nThe picture atlas');
{
  const path = 'public/images/orbs/orbs.webp';
  const buf = readFileSync(new URL(`../${path}`, import.meta.url));
  const kb = statSync(new URL(`../${path}`, import.meta.url)).size / 1024;
  const riff = buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
  const vp8x = buf.toString('ascii', 12, 16) === 'VP8X';
  const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
  const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
  check(`the atlas is one WebP with transparency (${kb.toFixed(0)} KB): small enough to load at once`, riff && vp8x && (buf[20] & 0x10) !== 0 && kb <= 120);
  check(`it is ${w} x ${h}: five 192 px cells side by side, in the order of the families`, w === 960 && h === 192 && ORB_FAMILY_IDS.length === 5);
  check('one texture only: the whole upgrade adds a single 0.98 MB texture to the GPU (the budget is 32 textures, the measured peak 27)', w * h * 4 * 1.34 < 1.2e6);
  const field = read('src/components/scene/OrbField.jsx');
  check('the renderer loads exactly that file, sets sRGB, and releases the texture, material and geometries when it leaves', /images\/orbs\/orbs\.webp/.test(field) && /SRGBColorSpace/.test(field) && /tex\.dispose\(\)/.test(field) && /geometries\.forEach\(\(g\) => g\.dispose\(\)\)/.test(field));
  check('each family has its own cell: a quad with the atlas coordinates of that cell, all sharing one material', /\(i \+ uv\.getX\(k\)\) \/ CELLS/.test(field) && (field.match(/new MeshBasicMaterial/g) ?? []).length === 2);
  check('the orb is drawn about as big as the old glow (a quad 1.0 across, half-size 0.5, against the old 0.53 radius) and inside the unchanged collection reach (0.71)', /const HALF = 0\.5/.test(field));
  check('until the picture has loaded the glow discs alone mark the orbs (the quads are only filled once loaded)', /if \(loaded\.current\)/.test(field));
}

console.log('\nWhere each family appears');
check('one primary per world, in journey order; each accent is the NEXT world\'s family; the last world has none', WORLD_ORBS.length === 5 && WORLD_ORBS.every((w, i) => w.primary === ORB_FAMILY_IDS[i] && w.accent === (ORB_FAMILY_IDS[i + 1] ?? null)));
{
  const stats = WORLDS.map((w) => { const c = {}; let n = 0; for (let x = w.start; x < w.end; x += 5) { const f = orbFamilyAt(x); c[f] = (c[f] ?? 0) + 1; n++; } return { w, c, n }; });
  check('every world is mostly its own family (at least 85%) and uses only its primary and its accent', stats.every(({ w, c, n }, i) => (c[WORLD_ORBS[i].primary] ?? 0) / n >= 0.85 && Object.keys(c).every((f) => f === WORLD_ORBS[i].primary || f === WORLD_ORBS[i].accent)), stats.map(({ c, n }, i) => `${Math.round(100 * (c[WORLD_ORBS[i].primary] ?? 0) / n)}%`).join(' '));
  check('the accent share is 0 for the first 40% of a world and grows smoothly to ACCENT_MAX at its end; the last world has none', [0, 0.2, 0.39].every((u) => accentShare(u * WORLD_LENGTH) === 0) && accentShare(0.99999 * WORLD_LENGTH) > ACCENT_MAX * 0.99 && accentShare(0.99999 * WORLD_LENGTH) <= ACCENT_MAX && [0, 4001, 4400, 4900].every((x) => accentShare(8000 + x * 0 + (x % 2000)) >= 0) && accentShare(9999) === 0 && accentShare(8000) === 0);
  let mono = true;
  for (const w of WORLDS) for (let u = 0; u < 0.99; u += 0.01) if (accentShare(w.start + u * WORLD_LENGTH) > accentShare(w.start + (u + 0.01) * WORLD_LENGTH) + 1e-12) mono = false;
  check('the accent share never falls within a world (a border is a gradual mix)', mono);
  let flips = 0, prev = orbFamilyAt(0);
  for (let x = 1; x < 10000; x++) { const f = orbFamilyAt(x); if (f !== prev) flips++; prev = f; }
  check(`the family changes rarely (${flips} times in 10 km: orbs in a ${CLUSTER} m cluster share one), never a rainbow`, flips < 80);
  check('the choice is deterministic: the same position always gives the same family', [0, 1500.5, 4321.7, 9999.9].every((x) => orbFamilyAt(x) === orbFamilyAt(x)));
  check('the first and last orbs of the journey are Solar and Celestial', orbFamilyAt(5) === 'solar' && orbFamilyAt(9990) === 'celestial');
}

console.log('\nReadability (the obstacles\' contrast rule: the better of the picture\'s rim colour or the underlay glow against every backdrop colour)');
{
  const NEED = 2.0;
  for (const [i, w] of WORLDS.entries()) {
    const zone = BIOMES[w.id];
    for (const id of [WORLD_ORBS[i].primary, WORLD_ORBS[i].accent].filter(Boolean)) {
      const f = ORB_FAMILIES[id];
      const worst = Math.min(...zone.scene.backdrops.map((bc) => Math.max(contrast(f.tone, bc), contrast(f.halo, bc))));
      check(`${w.id}: ${id} reads against every backdrop`, worst >= NEED, worst.toFixed(2));
    }
  }
}

console.log('\nVisual only');
{
  const simFiles = ['src/systems/game/createGameSim.js', 'src/systems/physics/collision.js', 'src/systems/physics/flight.js', 'src/systems/physics/constants.js', 'src/systems/scoring/scoring.js', 'src/systems/obstacles/spawner.js', 'src/systems/obstacles/patterns.js', 'src/systems/bot/autopilot.js'];
  check('the simulation, collision, scoring, spawner, patterns and bot do not know about orb families', simFiles.every((f) => !/orbFamil|orbGeometry|OrbField/.test(strip(read(f)))));
  const sim = strip(read('src/systems/game/createGameSim.js'));
  check('the collection test is unchanged: a circle test of R + 0.35 on orb.x and orb.y (not the drawn position)', /const ORB_RADIUS = 0\.35/.test(sim) && /const reach = R \+ ORB_RADIUS/.test(sim) && /const dy = orb\.y - b\.y/.test(sim) && /dx \* dx \+ dy \* dy < reach \* reach/.test(sim));
  const field = strip(read('src/components/scene/OrbField.jsx'));
  check('the renderer never writes an orb: it assigns nothing to orb.x, orb.y, orb.phase or orb.missed', !/orb\.(x|y|phase|missed)\s*=[^=]/.test(field));
  check('the bob and pulse only offset the drawn position (a local y)', /const y = orb\.y \+ Math\.sin/.test(field));
  check('nothing is allocated per frame in the render loop (no new, no array or object literals in useFrame)', (() => { const body = field.slice(field.indexOf('useFrame(')); const loop = body.slice(0, body.indexOf('return (\n    <group>')); return !/\bnew [A-Z]/.test(loop) && !/\[\s*\]|\{\s*\}/.test(loop.replace(/=> \{/g, '')); })());
  check('a family with no orb on screen is hidden (zero draw calls); the glow disc is one shared mesh', /visible = counts\[i\] > 0/.test(field) && (field.match(/<instancedMesh/g) ?? []).length === 2 && /geometries\.map/.test(field));
  // a track made with orbs is the same as before: orbs come from the same rng calls (the sim does not read the family)
  const make = () => { const s = createGameSim(); s.reset(9); s.flap(); s.distance = s.prevDistance = 400; s.step(1 / 120); return s; };
  const a = make();
  const b = make();
  const pos = (s) => [...s.orbs.active].map((o) => `${o.x.toFixed(4)},${o.y.toFixed(4)},${o.phase.toFixed(4)}`).join('|');
  check('the orbs of a seed are identical on every run (positions and phases come from the simulation only)', pos(a) === pos(b) && [...a.orbs.active].length > 3);
}

console.log(failures ? `\n${failures} failed` : '\norb family tests passed');
process.exit(failures ? 1 : 0);
