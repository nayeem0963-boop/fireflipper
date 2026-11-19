/**
 * Environment test matrix (browser): every test distance on desktop, phone portrait and phone landscape, plus pause, retry and a soak sweep.
 * Run with: npm run test:matrix  (needs Playwright with Chromium; starts the Vite dev server, because it uses the dev hook window.__fireflipper to jump along the track).
 * Checks per case: no page errors or console errors, the scene is painted (not blank), the HUD is on screen, the renderer's draw calls and GPU texture count stay inside budget.
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  console.log('Playwright is not installed here; skipping the matrix test.');
  process.exit(0);
}
const { chromium, devices } = playwright;
const PORT = 4188;
// The biome hazards are on by default; MATRIX_HAZARDS=0 runs the whole matrix with them switched off (?hazards=0)
const QUERY = process.env.MATRIX_HAZARDS === '0' ? '/?hazards=0' : '';
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 4000));

const DISTANCES = [0, 450, 500, 950, 1000, 1450, 1500, 1665, 1830, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000];
const SCREENS = [
  ['desktop 1534x630', { viewport: { width: 1534, height: 630 } }],
  ['phone portrait', { ...devices['iPhone 13'] }],
  ['phone landscape', { ...devices['iPhone 13 landscape'] }],
];
// MATRIX_ONLY=pause,retry (any of: screens, pause, retry, soak) runs just those parts
const ONLY = process.env.MATRIX_ONLY?.split(',');
const want = (part) => !ONLY || ONLY.includes(part);
// Draw calls per frame. At a zone border two zones' scenery cross-fade and two obstacle kits are on screen; the player bird alone is about 33 of them (measured), the scenery about 24, obstacles up to about 20.
const BUDGET = { drawCalls: 80, textures: 32 };
let failures = 0;
const rows = [];
const fail = (name, detail = '') => {
  failures++;
  console.log(`  FAIL ${name} ${detail}`);
};

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const jump = (p, d) =>
  p.evaluate((d) => {
    const g = window.__fireflipper.game;
    g.distance = g.prevDistance = d;
    g.bird.y = -0.5;
    g.bird.vy = 0;
  }, d);
const stats = (p) => p.evaluate(() => ({ calls: window.__fireflipper.gl.info.render.calls, textures: window.__fireflipper.gl.info.memory.textures, tris: window.__fireflipper.gl.info.render.triangles }));

for (const [name, opt] of want('screens') ? SCREENS : []) {
  const ctx = await browser.newContext(opt);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.goto(`http://localhost:${PORT}${QUERY}`);
  await p.waitForTimeout(2000);
  await p.getByRole('button', { name: /play|start|fly/i }).first().click();
  await p.waitForTimeout(1500);
  for (const d of DISTANCES) {
    await jump(p, d);
    await p.waitForTimeout(1600); // lets a lazily loaded painting arrive
    const shot = await p.screenshot();
    const s = await stats(p);
    const hud = await p.locator('.hud, [class*="hud"]').first().isVisible().catch(() => false);
    const painted = shot.length > 60_000;
    rows.push({ screen: name, d, kb: Math.round(shot.length / 1024), calls: s.calls, textures: s.textures, tris: s.tris });
    if (!painted) fail(`${name} @${d} m: scene looks blank`, `${shot.length} bytes`);
    if (!hud) fail(`${name} @${d} m: HUD not visible`);
    if (s.calls > BUDGET.drawCalls) fail(`${name} @${d} m: draw calls ${s.calls} > ${BUDGET.drawCalls}`);
    if (s.textures > BUDGET.textures) fail(`${name} @${d} m: textures ${s.textures} > ${BUDGET.textures}`);
  }
  if (errors.length) fail(`${name}: page/console errors`, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// pause: with the run paused the scenery must not move at all (two screenshots a second apart are identical), at a canyon, a frosty and a sanctuary distance
if (want('pause')) {
  const ctx = await browser.newContext({ viewport: { width: 1534, height: 630 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`http://localhost:${PORT}${QUERY}`);
  await p.waitForTimeout(2000);
  for (const d of [700, 1900, 6500]) {
    await p.getByRole('button', { name: /play|start|fly/i }).first().click({ timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(1500);
    await p.keyboard.press('Space');
    await p.waitForTimeout(300);
    // jump and press Pause in the same instant (the bird would crash on the teleported track within a second, which disables Pause)
    const paused = await p.evaluate((d) => {
      const g = window.__fireflipper.game;
      g.distance = g.prevDistance = d;
      g.bird.y = -0.5;
      g.bird.vy = 0;
      const btn = [...document.querySelectorAll('button')].find((b) => /pause/i.test(b.getAttribute('aria-label') || b.textContent || '') && !b.disabled);
      btn?.click();
      return !!btn;
    }, d);
    if (!paused) fail(`pause @${d} m: could not press Pause (the run was not running)`);
    await p.waitForTimeout(1500); // the paused scene is drawn once more, then rendering stops
    const a = await p.screenshot();
    await p.waitForTimeout(1200);
    const b = await p.screenshot();
    const frozen = a.equals(b);
    rows.push({ screen: 'pause', d, frozen });
    if (!frozen) fail(`pause @${d} m: the scenery moved while paused`);
    await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => /resume/i.test(b.getAttribute('aria-label') || b.textContent || ''))?.click());
    await p.evaluate(() => window.__fireflipper.game.reset?.());
    await p.waitForTimeout(500);
  }
  if (errors.length) fail('pause: page errors', errors.join(' | '));
  await ctx.close();
}

// retry from far along: texture count must not grow, the start of the track must be painted again
if (want('retry')) {
  const ctx = await browser.newContext({ viewport: { width: 1534, height: 630 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`http://localhost:${PORT}${QUERY}`);
  await p.waitForTimeout(2000);
  await p.getByRole('button', { name: /play|start|fly/i }).first().click();
  await p.waitForTimeout(1500);
  await jump(p, 20);
  await p.waitForTimeout(1500);
  const base = (await stats(p)).textures;
  let worst = base;
  const lapEnd = [];
  for (let lap = 0; lap < 3; lap++) {
    for (const d of [1700, 3500, 7100, 20]) {
      await jump(p, d);
      await p.waitForTimeout(1300);
      worst = Math.max(worst, (await stats(p)).textures);
    }
    lapEnd.push((await stats(p)).textures);
  }
  const end = await stats(p);
  const shot = await p.screenshot();
  rows.push({ screen: 'retry x3', baseTextures: base, worstTextures: worst, lapEnd });
  // the zones' small canvas textures (sky, floor, masks) stay once uploaded; what must not happen is growth from lap to lap
  if (lapEnd[2] > lapEnd[0]) fail('retry: GPU textures grow from lap to lap', lapEnd.join(' -> '));
  if (end.textures > BUDGET.textures) fail('retry: GPU texture budget exceeded', String(end.textures));
  if (shot.length < 60_000) fail('retry: the start of the track is not painted');
  if (errors.length) fail('retry: page errors', errors.join(' | '));
  await ctx.close();
}

// soak: sweep 0 -> 20000 m in steps and make sure the GPU texture count stays flat and bounded
if (want('soak')) {
  const ctx = await browser.newContext({ viewport: { width: 1534, height: 630 } });
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${PORT}${QUERY}`);
  await p.waitForTimeout(2000);
  await p.getByRole('button', { name: /play|start|fly/i }).first().click();
  await p.waitForTimeout(1500);
  let peak = 0;
  for (let d = 0; d <= 20000; d += 250) {
    await jump(p, d);
    await p.waitForTimeout(250);
    peak = Math.max(peak, (await stats(p)).textures);
  }
  rows.push({ screen: 'soak 0-20000 m', peakTextures: peak });
  if (peak > BUDGET.textures) fail('soak: texture count exceeded the budget', String(peak));
  await ctx.close();
}

await browser.close();
server.kill();
const withCalls = rows.filter((r) => r.calls);
console.log(JSON.stringify(rows));
if (withCalls.length) console.log(`cases: ${rows.length}, max draw calls ${Math.max(...withCalls.map((r) => r.calls))}, max GPU textures ${Math.max(...withCalls.map((r) => r.textures))}`);
console.log(failures ? `\n${failures} matrix check(s) failed` : '\nmatrix tests passed');
process.exit(failures ? 1 : 0);
