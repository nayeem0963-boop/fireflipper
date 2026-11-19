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
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 4000));

const DISTANCES = [0, 450, 500, 950, 1000, 1450, 1500, 1665, 1830, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000];
const SCREENS = [
  ['desktop 1534x630', { viewport: { width: 1534, height: 630 } }],
  ['phone portrait', { ...devices['iPhone 13'] }],
  ['phone landscape', { ...devices['iPhone 13 landscape'] }],
];
const BUDGET = { drawCalls: 70, textures: 32 };
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

for (const [name, opt] of SCREENS) {
  const ctx = await browser.newContext(opt);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.goto(`http://localhost:${PORT}`);
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
{
  const ctx = await browser.newContext({ viewport: { width: 1534, height: 630 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`http://localhost:${PORT}`);
  await p.waitForTimeout(2000);
  for (const d of [700, 1900, 6500]) {
    await p.getByRole('button', { name: /play|start|fly/i }).first().click().catch(() => {});
    await p.keyboard.press('Space');
    await p.waitForTimeout(300);
    await jump(p, d);
    await p.waitForTimeout(1200);
    await p.getByRole('button', { name: /pause/i }).first().click().catch(() => {});
    await p.waitForTimeout(600);
    const a = await p.screenshot();
    await p.waitForTimeout(1200);
    const b = await p.screenshot();
    const frozen = a.equals(b);
    rows.push({ screen: 'pause', d, frozen });
    if (!frozen) fail(`pause @${d} m: the scenery moved while paused`);
    await p.getByRole('button', { name: /resume/i }).first().click().catch(() => {});
    await p.evaluate(() => window.__fireflipper.game.reset?.());
    await p.waitForTimeout(500);
  }
  if (errors.length) fail('pause: page errors', errors.join(' | '));
  await ctx.close();
}

// retry from far along: texture count must not grow, the start of the track must be painted again
{
  const ctx = await browser.newContext({ viewport: { width: 1534, height: 630 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`http://localhost:${PORT}`);
  await p.waitForTimeout(2000);
  await p.getByRole('button', { name: /play|start|fly/i }).first().click();
  await p.waitForTimeout(1500);
  await jump(p, 20);
  await p.waitForTimeout(1500);
  const base = (await stats(p)).textures;
  let worst = base;
  for (let lap = 0; lap < 3; lap++) {
    for (const d of [1700, 3500, 7100, 20]) {
      await jump(p, d);
      await p.waitForTimeout(1300);
      worst = Math.max(worst, (await stats(p)).textures);
    }
  }
  const end = await stats(p);
  const shot = await p.screenshot();
  rows.push({ screen: 'retry x3', baseTextures: base, worstTextures: worst, endTextures: end.textures });
  if (end.textures > base + 8) fail('retry: texture count did not settle', `${base} -> ${end.textures}`);
  if (shot.length < 60_000) fail('retry: the start of the track is not painted');
  if (errors.length) fail('retry: page errors', errors.join(' | '));
  await ctx.close();
}

// soak: sweep 0 -> 20000 m in steps and make sure the GPU texture count stays flat and bounded
{
  const ctx = await browser.newContext({ viewport: { width: 1534, height: 630 } });
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${PORT}`);
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
const maxCalls = Math.max(...rows.filter((r) => r.calls).map((r) => r.calls));
const maxTex = Math.max(...rows.filter((r) => r.textures).map((r) => r.textures));
console.log(JSON.stringify(rows));
console.log(`cases: ${rows.length}, max draw calls ${maxCalls}, max GPU textures ${maxTex}`);
console.log(failures ? `\n${failures} matrix check(s) failed` : '\nmatrix tests passed');
process.exit(failures ? 1 : 0);
