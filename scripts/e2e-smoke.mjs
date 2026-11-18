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
const CASES = [
  ['desktop 1534x630', { viewport: { width: 1534, height: 630 } }],
  ['phone portrait', { ...devices['iPhone 13'] }],
  ['phone landscape', { ...devices['iPhone 13 landscape'] }],
];

for (const [name, opts] of CASES) {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`http://localhost:${PORT}`);
  await p.waitForSelector('.birdchip', { timeout: 20000 });
  check(`${name}: seven birds on the menu`, (await p.locator('.birdchip').count()) === 7);

  // pick a bird, open the picker and achievements
  await p.getByRole('radio', { name: /scarlet macaw/i }).click();
  await p.getByRole('button', { name: /skins/i }).click();
  await p.waitForSelector('.birds');
  check(`${name}: picker lists seven birds`, (await p.locator('.birds__grid [role=radio]').count()) === 7);
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

await browser.close();
server.kill();
console.log(failures ? `\n${failures} failed` : '\nbrowser smoke tests passed');
process.exit(failures ? 1 : 0);
