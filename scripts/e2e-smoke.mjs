/**
 * Browser smoke test of the production build. Run with: npm run build && npm run test:e2e
 * Needs Playwright with a Chromium available (not a project dependency: it is only for this check).
 * Walks the main flows on desktop, phone portrait and phone landscape and fails on any page error.
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  console.log('Playwright is not installed here; skipping the browser smoke test.');
  process.exit(0);
}
const { chromium, devices } = playwright;
const PORT = 4179;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
};

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
// Desktop runs the red theme, the phones the blue one, so both themes get the full flow.
const CASES = [
  ['desktop 1534x630', { viewport: { width: 1534, height: 630 } }, 'red'],
  ['phone portrait', { ...devices['iPhone 13'] }, 'blue'],
  ['phone landscape', { ...devices['iPhone 13 landscape'] }, 'blue'],
];

for (const [name, opts, themeId] of CASES) {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`http://localhost:${PORT}`);
  await p.waitForSelector('.birdchip', { timeout: 20000 });
  // Switch with the theme switch and check the page restyles (and that its choice sticks).
  const other = themeId === 'red' ? 'blue' : 'red';
  await p.getByRole('radio', { name: new RegExp(`^${other} theme`, 'i') }).click();
  check(`${name}: theme switch restyles the page`, (await p.evaluate(() => document.documentElement.dataset.theme)) === other);
  await p.getByRole('radio', { name: new RegExp(`^${themeId} theme`, 'i') }).click();
  check(`${name}: switching back works`, (await p.evaluate(() => document.documentElement.dataset.theme)) === themeId);
  await p.getByRole('radio', { name: new RegExp(`^${other} theme`, 'i') }).click();
  await p.getByRole('radio', { name: new RegExp(`^${themeId} theme`, 'i') }).click();
  // The welcome page must never be wider than the screen (a wide child once stretched the grid and clipped it).
  const clipped = await p.evaluate(() => {
    const vw = innerWidth;
    return ['.home__topbar', '.home__topbar-actions', '.theme-switch', '.logo', '.play-btn', '.home__cards', '.home__links'].filter((q) => {
      const e = document.querySelector(q);
      return e && e.getBoundingClientRect().right > vw + 1;
    });
  });
  check(`${name}: welcome page fits the screen width`, clipped.length === 0, clipped.join());
  check(`${name}: six birds on the menu`, (await p.locator('.birdchip').count()) === 6);

  // pick a bird, open the picker and achievements
  await p.getByRole('radio', { name: /toco toucan/i }).click();
  await p.getByRole('button', { name: /skins/i }).click();
  await p.waitForSelector('.birds');
  check(`${name}: picker lists six birds`, (await p.locator('.birds__grid [role=radio]').count()) === 6);
  await p.keyboard.press('Escape');
  await p.getByRole('button', { name: /achievements/i }).click();
  await p.waitForSelector('.prog');
  await p.keyboard.press('Escape');

  // play: start, flap, crash into the lava, game over, retry
  await p.getByRole('button', { name: /^play/i }).first().click();
  await p.waitForSelector('.start-prompt', { timeout: 20000 });
  await p.waitForSelector('canvas', { timeout: 20000 }); // the 3D stage loads lazily; taps before it mounts are ignored
  await p.waitForTimeout(1500);
  const tap = () => (opts.hasTouch ? p.touchscreen.tap(200, 150) : p.mouse.click(400, 300));
  await tap();
  await p.waitForTimeout(300);
  await tap();
  await p.waitForSelector('.gameover', { timeout: 30000 });
  const over = await p.evaluate(() => {
    const f = document.querySelector('.gameover__footer').getBoundingClientRect();
    return { footerBottom: f.bottom, vh: innerHeight };
  });
  check(`${name}: Retry footer on screen`, over.footerBottom <= over.vh + 1, JSON.stringify(over));
  await p.waitForTimeout(700);
  await p.getByRole('button', { name: /retry/i }).click();
  await p.waitForSelector('.start-prompt');
  check(`${name}: retry returns to ready`, true);

  // back to menu, then auto play
  await p.getByRole('button', { name: /back|menu/i }).first().click().catch(() => {});
  if (!(await p.locator('.birdchip').count())) await p.reload();
  await p.waitForSelector('.birdchip');
  await p.getByRole('button', { name: /watch auto play/i }).click();
  await p.waitForSelector('.demo__badge', { timeout: 20000 });
  await p.waitForTimeout(3000);
  const runsBefore = await p.evaluate(() => localStorage.getItem('fireflipper:stats'));
  await p.waitForTimeout(1000);
  check(`${name}: auto play leaves saved stats unchanged`, runsBefore === (await p.evaluate(() => localStorage.getItem('fireflipper:stats'))));
  check(`${name}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// The biome hazards are on by default (every flow above runs with them); ?hazards=0 is the opt-out: it must also load and run on every screen.
for (const [name, opts] of CASES) {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.goto(`http://localhost:${PORT}/?hazards=0`);
  await p.waitForSelector('.birdchip', { timeout: 20000 });
  await p.getByRole('button', { name: /watch auto play/i }).click();
  await p.waitForSelector('.demo__badge', { timeout: 20000 });
  await p.waitForSelector('canvas', { timeout: 20000 });
  await p.waitForTimeout(8000);
  check(`${name} (hazards off, ?hazards=0): Auto play runs with no page or console error`, errors.length === 0, errors.join(' | '));
  const painted = (await p.screenshot()).length > 60_000;
  check(`${name} (hazards off, ?hazards=0): the scene is painted`, painted);
  await p.getByRole('button', { name: /back|exit|menu/i }).first().click().catch(() => {});
  if (!(await p.locator('.birdchip').count())) await p.goto(`http://localhost:${PORT}/?hazards=0`);
  await p.waitForSelector('.birdchip');
  await p.getByRole('button', { name: /^play/i }).first().click();
  await p.waitForSelector('.start-prompt', { timeout: 20000 });
  await p.waitForTimeout(1500);
  if (opts.hasTouch) await p.touchscreen.tap(200, 150); else await p.mouse.click(400, 300);
  await p.waitForTimeout(2500);
  check(`${name} (hazards off, ?hazards=0): a manual run starts with no page or console error`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// Game versions: ?version=v2 opens v2 directly, the menu switches between v1 and v2 without a reload, and both start, run, game-over and retry.
// (The v2 asset may not be in the repo yet; the v1 bird then stands in, which must never be a page error.)
for (const [name, opts] of CASES) {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  const radio = (re) => p.getByRole('radio', { name: re });
  await p.goto(`http://localhost:${PORT}/?version=v2`);
  await p.waitForSelector('.versioncard', { timeout: 20000 });
  check(`${name} (versions): ?version=v2 opens v2`, (await radio(/^v2/i).getAttribute('aria-checked')) === 'true' && (await radio(/^v1/i).getAttribute('aria-checked')) === 'false');
  check(`${name} (versions): the v1 bird strip is hidden in v2`, (await p.locator('.birdchip').count()) === 0);
  await p.evaluate(() => (window.__noReload = true));
  await radio(/^v1/i).click();
  check(`${name} (versions): switching to v1 does not reload the page`, await p.evaluate(() => window.__noReload === true));
  check(`${name} (versions): v1 brings the bird strip back`, (await p.locator('.birdchip').count()) === 6);
  check(`${name} (versions): the address bar follows the choice`, new URL(p.url()).searchParams.get('version') === 'v1', p.url());
  await radio(/^v2/i).click();
  check(`${name} (versions): the address bar says v2`, new URL(p.url()).searchParams.get('version') === 'v2', p.url());

  await p.getByRole('button', { name: /^play/i }).first().click();
  await p.waitForSelector('.start-prompt', { timeout: 20000 });
  await p.waitForSelector('canvas', { timeout: 20000 });
  await p.waitForTimeout(1500);
  const tapV = () => (opts.hasTouch ? p.touchscreen.tap(200, 150) : p.mouse.click(400, 300));
  await tapV();
  await p.waitForTimeout(300);
  await tapV();
  await p.waitForSelector('.gameover', { timeout: 30000 });
  await p.waitForTimeout(700);
  await p.getByRole('button', { name: /retry/i }).click();
  await p.waitForSelector('.start-prompt');
  check(`${name} (versions): v2 starts, ends and retries`, true);
  await p.getByRole('button', { name: /back|menu/i }).first().click().catch(() => {});
  await p.waitForSelector('.versioncard', { timeout: 20000 });
  check(`${name} (versions): back on the menu it is still v2`, (await radio(/^v2/i).getAttribute('aria-checked')) === 'true');
  await p.goto(`http://localhost:${PORT}/`);
  await p.waitForSelector('.versioncard', { timeout: 20000 });
  check(`${name} (versions): a plain reload remembers v2`, (await radio(/^v2/i).getAttribute('aria-checked')) === 'true');
  await p.getByRole('button', { name: /watch auto play/i }).click();
  await p.waitForSelector('.demo__badge', { timeout: 20000 });
  await p.waitForTimeout(2500);
  check(`${name} (versions): Auto play works in v2`, true);
  await p.getByRole('button', { name: /^exit/i }).click().catch(() => {});
  await p.waitForSelector('.versioncard', { timeout: 20000 });
  const v2Saved = () => p.evaluate(() => ['stats', 'bestScore', 'achievements', 'journey'].map((k) => localStorage.getItem(`fireflipper:v2:${k}`)).join('|'));
  const savedBefore = await v2Saved();
  await p.getByRole('button', { name: /journey preview/i }).click();
  await p.waitForSelector('.demo__badge', { timeout: 20000 });
  await p.waitForTimeout(2500);
  check(`${name} (versions): the Journey Preview runs in v2 (a bot runs) and saves nothing`, /runs all 10,000 m/i.test((await p.locator('.demo__badge').textContent()) ?? '') && (await v2Saved()) === savedBefore);
  check(`${name} (versions): no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// Journey Preview (Auto play through the whole journey, nothing saved): it must start from the home screen on every layout with no page error, leave existing data alone and exit cleanly.
for (const [name, opts] of CASES) {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.addInitScript(() => { if (!localStorage.getItem('fireflipper:bestScore')) localStorage.setItem('fireflipper:bestScore', '4321'); });
  await p.goto(`http://localhost:${PORT}/`);
  await p.waitForSelector('.birdchip', { timeout: 20000 });
  const keys = () => p.evaluate(() => JSON.stringify(Object.keys(localStorage).filter((k) => /journey|bestScore|stats|achievements|daily|flown/.test(k)).sort().map((k) => [k, localStorage.getItem(k)])));
  const before = await keys();
  await p.getByRole('button', { name: /journey preview/i }).click();
  await p.waitForSelector('.demo__badge', { timeout: 20000 });
  await p.waitForSelector('canvas', { timeout: 20000 });
  await p.waitForTimeout(6000);
  check(`${name} (preview): labelled as the Journey Preview, with no page or console error`, /journey preview/i.test(await p.locator('.demo__badge').innerText()) && errors.length === 0, errors.join(' | '));
  await p.getByRole('button', { name: /^exit$/i }).click();
  await p.waitForSelector('.birdchip', { timeout: 20000 });
  check(`${name} (preview): exiting returns to the menu and leaves the saved data untouched`, (await keys()) === before);
  await ctx.close();
}

// The Art Lab (a standalone 3D art playground, reached from the home screen): every piece must load and run without page errors or shader
// errors on every screen size, the panel must fit the screen, and leaving must return to a working menu and game.
for (const [name, opts] of CASES) {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 160));
  });
  await p.goto(`http://localhost:${PORT}`);
  await p.waitForSelector('.birdchip', { timeout: 20000 });
  await p.getByRole('button', { name: 'Art Lab' }).click();
  await p.waitForSelector('.art-hud', { timeout: 20000 });
  await p.waitForSelector('.art canvas', { timeout: 20000 });
  const pieces = await p.locator('.art-piece').count();
  check(`${name}: Art Lab lists its pieces`, pieces >= 3, `${pieces}`);
  for (let i = 0; i < pieces; i++) {
    await p.locator('.art-piece').nth(i).click();
    await p.waitForTimeout(1500);
  }
  const fit = await p.evaluate(() => {
    const r = document.querySelector('.art-hud').getBoundingClientRect();
    return { ok: r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1, r: [r.left, r.top, r.right, r.bottom].map(Math.round), vw: innerWidth, vh: innerHeight };
  });
  check(`${name}: Art Lab panel fits the screen`, fit.ok, JSON.stringify(fit));
  await p.getByRole('button', { name: 'Hide' }).click();
  check(`${name}: Art Lab panel can be hidden for a clean view`, (await p.locator('.art-hud').count()) === 0 && (await p.locator('.art-reveal').count()) === 1);
  await p.getByRole('button', { name: /show the controls/i }).click();
  await p.getByRole('button', { name: /back to fire flipper/i }).click();
  await p.waitForSelector('.birdchip', { timeout: 20000 });
  await p.getByRole('button', { name: /^play/i }).first().click();
  await p.waitForSelector('.start-prompt', { timeout: 20000 });
  check(`${name}: the game still starts after the Art Lab`, true);
  check(`${name}: Art Lab: no page or console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
server.kill();
console.log(failures ? `\n${failures} failed` : '\nbrowser smoke tests passed');
process.exit(failures ? 1 : 0);
