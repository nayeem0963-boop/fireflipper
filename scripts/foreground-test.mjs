// Foreground layer safety: props must never reach the screen area of the gameplay plane, at any camera height, aspect or fov.
import { readFileSync } from 'node:fs';
import { PerspectiveCamera, Vector3 } from 'three';
import { WORLD } from '../src/systems/physics/constants.js';
import { cameraDistance } from '../src/scenes/EmberValley/cameraConfig.js';
import { FOREGROUND, foregroundBaseY, foregroundHeight, foregroundItems, foregroundX, foregroundZ, ndcToWorld } from '../src/systems/world/foreground.js';

let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error('FAIL', m); } else console.log('ok  ', m); };

// exact projection with a real camera, as the CameraRig sets it up (position, lookAt a little below the bird)
const project = (cam, x, y, z) => new Vector3(x, y, z).project(cam).y;
let worstGap = Infinity, worstCase = '';
let hidden = 0, shown = 0, cases = 0;
for (const aspect of [0.46, 0.56, 1, 1.78, 2.43, 3.2]) {
  for (const camY of [-0.4 + 0.55, 0, 0.55, 1.0, 1.6 + 0.55, 2.5]) {
    for (const fov of [50, 52, 53]) {
      const z = cameraDistance(aspect);
      const bx = 3;
      const cam = new PerspectiveCamera(fov, aspect, 0.1, 200);
      cam.position.set(bx, camY, z);
      cam.lookAt(bx, camY - 0.35, 0);
      cam.updateMatrixWorld(true);
      cam.updateProjectionMatrix();
      const fz = foregroundZ(z);
      for (const hNdc of FOREGROUND.height) {
        cases++;
        const h = foregroundHeight(hNdc, camY, z, fov);
        const topY = foregroundBaseY() + h;
        // lowest point of the gameplay band on screen: the ground at the front of the gameplay plane, across the screen width
        for (const dx of [-6, 0, 6]) {
          const propTop = project(cam, bx + dx, topY, fz);
          const ground = project(cam, bx + dx, WORLD.groundY, FOREGROUND.gameplayFrontZ);
          const gap = ground - propTop; // > 0: the prop's top is below the gameplay ground on screen
          if (gap < worstGap) { worstGap = gap; worstCase = `aspect ${aspect} camY ${camY} fov ${fov}`; }
        }
        if (h <= 0 || project(cam, bx, foregroundBaseY(), fz) < -1.0) hidden++; else shown++;
      }
    }
  }
}
ok(worstGap > 0.02, `props stay below the gameplay ground on screen in all ${cases} camera cases (tightest gap ${worstGap.toFixed(3)} NDC at ${worstCase})`);
console.log(`     ${hidden} of ${cases} cases draw nothing (camera high: the floor strip is off-screen), ${shown} show props`);
ok(shown > cases / 3, 'props are visible in a good share of camera positions, including portrait');

// prop height stays small
for (const aspect of [0.46, 1, 2.43]) {
  const z = cameraDistance(aspect);
  const hw = ndcToWorld(FOREGROUND.height[1], 50);
  ok(FOREGROUND.height[1] <= 0.12, `prop height is at most ${FOREGROUND.height[1]} NDC (${(FOREGROUND.height[1] * 50).toFixed(0)}% of screen height), ${hw.toFixed(2)} world units at aspect ${aspect}`);
}

// deterministic, frame-rate independent, seamless
const items = foregroundItems(101);
ok(JSON.stringify(items) === JSON.stringify(foregroundItems(101)), 'layout is deterministic');
ok(items.length === FOREGROUND.count && FOREGROUND.count <= 20, `prop count ${items.length} within budget`);
let worst = 0;
for (const it of items.slice(0, 4)) {
  for (let d = 0; d < 400; d += 0.25) {
    let step = Math.abs(foregroundX(it, d + 0.25) - foregroundX(it, d));
    step = Math.min(step, FOREGROUND.span - step); // seam
    worst = Math.max(worst, step);
  }
}
ok(Math.abs(worst - 0.25 * FOREGROUND.speed) < 1e-6, `props move at constant speed with no jump at the loop seam (${worst.toFixed(4)})`);
ok(foregroundX(items[3], 123.456) === foregroundX(items[3], 123.456), 'position depends only on distance (pause freezes it)');
// wrap seam is outside the view: props wrap at +-span/2 and the widest view at the foreground depth is smaller
{
  const aspect = 3.2, z = cameraDistance(aspect);
  const halfW = ndcToWorld(1, 53) * aspect;
  ok(halfW + 3 < FOREGROUND.span / 2, `wrap seam is outside the widest view (half width ${halfW.toFixed(1)} < ${FOREGROUND.span / 2})`);
}

// source checks: no clock, no collision, nothing in the sim imports it, draw-order unaffected (no depth tricks)
const src = readFileSync(new URL('../src/scenes/EmberValley/ForegroundLayer.jsx', import.meta.url), 'utf8');
ok(!/elapsedTime|Date\.now|performance\.now|Math\.random/.test(src), 'foreground layer uses no wall clock or randomness');
ok(!/sim\.(obstacles|bird|step|flap)/.test(src), 'foreground layer reads only renderDistance from the sim');
const phys = ['createGameSim.js'].map((f) => readFileSync(new URL(`../src/systems/game/${f}`, import.meta.url), 'utf8')).join('');
ok(!/foreground/i.test(phys), 'simulation does not know about the foreground layer');

if (failed) { console.error(`\n${failed} foreground test(s) failed`); process.exit(1); }
console.log('\nAll foreground tests passed');
