/**
 * Deployment tests: cache headers and chunk layout, checked against a real production build. Run with: npm run test:deploy
 * Builds the site into a temporary folder (the project's dist is left alone), then checks public/_headers against the files that were actually produced and the chunk graph.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) { failures++; console.log(`  FAIL ${name} ${detail}`); } else console.log(`  ok   ${name}${detail ? ` (${detail})` : ''}`);
};
const out = mkdtempSync(join(tmpdir(), 'ff-deploy-'));
execSync(`npx vite build --outDir "${out}" --emptyOutDir`, { cwd: new URL('..', import.meta.url).pathname, stdio: 'pipe' });
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p); } })(out);
const rel = files.map((f) => '/' + relative(out, f).replace(/\\/g, '/'));
const size = (r) => statSync(join(out, r)).size;

console.log('\n1. Cache headers (public/_headers, copied to the site root by the build)');
{
  check('the build copies _headers to the site root (where Netlify and Cloudflare Pages read it)', existsSync(join(out, '_headers')));
  const text = readFileSync(join(out, '_headers'), 'utf8');
  const rules = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) rules.push({ path: line.trim(), headers: {} });
    else { const [k, ...v] = line.trim().split(':'); rules.at(-1).headers[k.trim().toLowerCase()] = v.join(':').trim(); }
  }
  const matches = (pattern, path) => (pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : pattern === '/' ? path === '/index.html' : path === pattern); // '/' is the page itself, served from index.html
  const cacheFor = (path) => rules.filter((r) => matches(r.path, path)).map((r) => r.headers['cache-control']);
  const site = rel.filter((r) => r !== '/_headers');
  const assets = site.filter((r) => r.startsWith('/assets/'));
  const hashed = (r) => /-[A-Za-z0-9_-]{6,}\.(js|css)$/.test(r);
  check('there are fingerprinted files under /assets (every one has a content hash in its name)', assets.length > 5 && assets.every(hashed), `${assets.length} files`);
  check('every /assets file gets exactly one rule: public, one year, immutable', assets.every((r) => cacheFor(r).length === 1 && cacheFor(r)[0] === 'public, max-age=31536000, immutable'));
  const others = site.filter((r) => !r.startsWith('/assets/'));
  check('nothing outside /assets is ever immutable or cached for more than zero seconds without revalidation (images and models keep fixed names)', others.every((r) => cacheFor(r).every((c) => c === undefined || (/max-age=0/.test(c) && /must-revalidate/.test(c)) && !/immutable/.test(c))));
  const real = (r) => /\.(jpg|webp|glb|svg)$/.test(r);
  check('every image and model gets the revalidate rule (a replaced file shows up at once; an unchanged one costs a 304)', site.filter(real).every((r) => cacheFor(r).length === 1 && /must-revalidate/.test(cacheFor(r)[0])), `${site.filter(real).length} files`);
  check('the page itself ("/" and /index.html) is revalidated, so a new deploy is seen at once', rules.some((r) => r.path === '/') && rules.some((r) => r.path === '/index.html') && cacheFor('/index.html').length === 2 && cacheFor('/index.html').every((c) => c === 'public, max-age=0, must-revalidate'));
  check('every rule in the file matches at least one real file (no stale pattern)', rules.every((r) => rel.some((p) => matches(r.path, p))), rules.filter((r) => !rel.some((p) => matches(r.path, p))).map((r) => r.path).join());
  check('no rule asks for anything but Cache-Control (no redirects, no functions, nothing metered)', rules.every((r) => Object.keys(r.headers).join() === 'cache-control'));
  check('no hosting config for a paid feature is present (no functions folder, no edge config)', !existsSync(new URL('../netlify', import.meta.url)) && !existsSync(new URL('../netlify.toml', import.meta.url)) && !rel.some((r) => /^\/(functions|edge)/.test(r)));
}

console.log('\n2. Chunk layout');
{
  const js = rel.filter((r) => r.startsWith('/assets/') && r.endsWith('.js'));
  const by = (n) => js.find((r) => r.startsWith(`/assets/${n}-`));
  const vendors = ['vendor-react', 'vendor-three', 'vendor-r3f'];
  check('the three vendor chunks exist', vendors.every((v) => by(v)), vendors.map((v) => `${v} ${by(v) ? Math.round(size(by(v)) / 1024) + ' KB' : 'missing'}`).join(', '));
  check('no chunk is larger than 900 KB (three.js alone is about 820 KB)', js.every((r) => size(r) < 900 * 1024), js.map((r) => `${r.slice(8, 22)} ${Math.round(size(r) / 1024)}`).join(' | '));
  check('the application code is no longer bundled with three.js (the entry chunk is under 150 KB)', size(by('index')) < 150 * 1024, `${Math.round(size(by('index')) / 1024)} KB`);
  // the static import graph between chunks must have no cycle
  const graph = new Map();
  for (const r of js) {
    const src = readFileSync(join(out, r), 'utf8');
    graph.set(r.slice(8), [...src.matchAll(/(?:^|[;}\n])\s*(?:import|export)\s*(?:[^'";]*?from\s*)?["']\.\/([^"']+\.js)["']/g)].map((m) => m[1]));
  }
  const state = new Map();
  let cycle = null;
  const visit = (n, path) => {
    if (state.get(n) === 1) { cycle ??= [...path, n].join(' > '); return; }
    if (state.get(n) === 2 || !graph.has(n)) return;
    state.set(n, 1);
    for (const m of graph.get(n)) visit(m, [...path, n]);
    state.set(n, 2);
  };
  for (const n of graph.keys()) visit(n, []);
  check('no circular import between chunks', cycle === null, cycle ?? `${graph.size} chunks, ${[...graph.values()].reduce((n, e) => n + e.length, 0)} static imports checked`);
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  check('the page loads its entry script and stylesheet from /assets (fingerprinted)', /src="\/assets\/index-[^"]+\.js"/.test(html) && /href="\/assets\/index-[^"]+\.css"/.test(html));
}

console.log(failures ? `\n${failures} failed` : '\ndeploy tests passed');
process.exit(failures ? 1 : 0);
