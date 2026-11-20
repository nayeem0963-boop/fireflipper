/**
 * SEO tests, against a real production build. Run with: npm run test:seo
 * Builds the site twice into temporary folders (as Netlify production, and as a Netlify deploy preview) and checks the page head, the crawlable content, the structured data, robots.txt,
 * the sitemap, the manifest, the icons, the social image and the 404 page. Nothing here touches the game.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) { failures++; console.log(`  FAIL ${name} ${detail}`); } else console.log(`  ok   ${name}${detail ? ` (${detail})` : ''}`);
};
const ROOT = new URL('..', import.meta.url).pathname;
const SITE = 'https://fireflipper.com';
function build(context) {
  const out = mkdtempSync(join(tmpdir(), 'ff-seo-'));
  const env = { ...process.env };
  delete env.CONTEXT;
  if (context) env.CONTEXT = context;
  execSync(`npx vite build --outDir "${out}" --emptyOutDir`, { cwd: ROOT, stdio: 'pipe', env });
  return out;
}
const prod = build(null);
const preview = build('deploy-preview');
const read = (dir, f) => readFileSync(join(dir, f), 'utf8');
const html = read(prod, 'index.html');
const metaOf = (src, attr, key) => [...src.matchAll(new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`, 'g'))].map((m) => m[1]);
const one = (attr, key) => { const v = metaOf(html, attr, key); return v.length === 1 ? v[0] : undefined; };
const jpegSize = (file) => { const b = readFileSync(file); let i = 2; while (i < b.length) { if (b[i] !== 0xff) { i++; continue; } const m = b[i + 1]; if (m >= 0xc0 && m <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + b.readUInt16BE(i + 2); } return null; };
const pngSize = (file) => { const b = readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

console.log('\n1. Page head');
{
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
  const desc = one('name', 'description') ?? '';
  check('exactly one <title>, 30 to 60 characters, naming the game', (html.match(/<title>/g) ?? []).length === 1 && title.length >= 30 && title.length <= 60 && /Fire Flipper/.test(title), `"${title}" ${title.length}`);
  check('exactly one meta description, 70 to 160 characters', desc.length >= 70 && desc.length <= 160, `${desc.length}`);
  check('html has lang="en", a viewport and a theme colour', /<html lang="en">/.test(html) && !!one('name', 'viewport') && /^#[0-9a-f]{6}$/i.test(one('name', 'theme-color') ?? ''));
  const canon = [...html.matchAll(/<link rel="canonical" href="([^"]*)"/g)].map((m) => m[1]);
  check('exactly one canonical URL: the production domain, absolute, with a trailing slash', canon.length === 1 && canon[0] === `${SITE}/`);
  check('robots directive: index, follow and large image previews (production)', /^index, follow/.test(one('name', 'robots') ?? '') && /max-image-preview:large/.test(one('name', 'robots')));
  const og = Object.fromEntries(['type', 'site_name', 'locale', 'url', 'title', 'description', 'image', 'image:width', 'image:height', 'image:alt', 'image:type'].map((k) => [k, one('property', `og:${k}`)]));
  check('Open Graph: type, site name, locale, url, title, description and a sized image with alt text, each exactly once', Object.values(og).every(Boolean) && og.type === 'website' && og.site_name === 'Fire Flipper' && og.url === `${SITE}/`, Object.entries(og).filter(([, v]) => !v).map(([k]) => k).join());
  const tw = Object.fromEntries(['card', 'title', 'description', 'image', 'image:alt'].map((k) => [k, one('name', `twitter:${k}`)]));
  check('X / Twitter card: summary_large_image with title, description, image and alt text', Object.values(tw).every(Boolean) && tw.card === 'summary_large_image');
  check('every social URL is absolute on the production domain', [og.url, og.image, tw.image].every((u) => u?.startsWith(`${SITE}/`)));
  check('the social titles and descriptions are within the common limits (title <= 70, description <= 200)', og.title.length <= 70 && tw.title.length <= 70 && og.description.length <= 200 && tw.description.length <= 200);
  const img = og.image.replace(SITE, '');
  check('the social image exists, is a 1200x630 JPEG and is under 200 KB', existsSync(join(prod, img)) && JSON.stringify(jpegSize(join(prod, img))) === '[1200,630]' && statSync(join(prod, img)).size < 200 * 1024, `${Math.round(statSync(join(prod, img)).size / 1024)} KB`);
  const icons = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  check('every icon and the manifest linked from the head exists in the build', icons.length >= 5 && icons.every((h) => existsSync(join(prod, h))), icons.join(' '));
  check('there are no duplicate canonical, description or robots tags', metaOf(html, 'name', 'description').length === 1 && metaOf(html, 'name', 'robots').length === 1);
}

console.log('\n2. Crawlable content (shown before the game loads, replaced by it; present for crawlers without JavaScript)');
{
  const root = /<div id="root">([\s\S]*?<\/main>)\s*<\/div>/.exec(html)?.[1] ?? '';
  const h1 = [...root.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)];
  check('exactly one <h1>, "Fire Flipper"', h1.length === 1 && /^Fire Flipper$/.test(h1[0][1].trim()));
  check('the heading order is h1 then h2 (no skipped levels, no h3 without an h2)', !/<h[3-6]/.test(root) && (root.match(/<h2/g) ?? []).length >= 3 && root.indexOf('<h1') < root.indexOf('<h2'));
  const words = root.replace(/<style[\s\S]*?<\/style>|<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  check('there is real text for a crawler (at least 120 words): what the game is, the five worlds, how to play, features', words >= 120 && ['Red Rock Canyon', 'Frosty Polar', 'Celestial Realm', 'Rose Sky Palace', 'Cloud Sanctuary', 'How to play', 'Features'].every((t) => root.includes(t)), `${words} words`);
  check('it is a <main> landmark with a no-JavaScript message in <noscript>', /<main class="ff-seo">/.test(root) && /<noscript>[\s\S]*JavaScript[\s\S]*<\/noscript>/.test(root));
  check('the page has no <img> (the game draws on a canvas), so there is no image without alt text', !/<img\b/.test(html));
  const app = readFileSync(join(ROOT, 'src/components/ui/HomeScreen.jsx'), 'utf8');
  check('the game\'s own home screen also has exactly one h1, "Fire Flipper", so the heading is the same before and after loading', (app.match(/<h1\b/g) ?? []).length === 1 && />Fire<\/span>/.test(app) && />Flipper<\/span>/.test(app));
  check('the content makes only true claims: no rating, review, price other than free, or download link', !/aggregateRating|reviewCount|ratingValue/.test(html) && !/app store|google play/i.test(root));
}

console.log('\n3. Structured data');
{
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  let data = null;
  try { data = JSON.parse(blocks[0]); } catch { /* reported below */ }
  check('one JSON-LD block that parses', blocks.length === 1 && !!data);
  const g = data?.['@graph'] ?? [];
  const site = g.find((n) => n['@type'] === 'WebSite');
  const game = g.find((n) => n['@type'] === 'VideoGame');
  check('a WebSite node with the production url and name', site?.url === `${SITE}/` && site?.name === 'Fire Flipper' && data['@context'] === 'https://schema.org');
  check('a VideoGame node: name, url, description, image, genre, platform, play mode, free to play', !!game && game.url === `${SITE}/` && game.name.includes('Fire Flipper') && game.description.length > 60 && game.image.startsWith(SITE) && game.gamePlatform === 'Web browser' && game.playMode === 'SinglePlayer' && game.isAccessibleForFree === true && game.offers?.price === '0');
  check('it invents nothing: no author, publisher, rating or review', !!game && !('author' in game) && !('publisher' in game) && !('aggregateRating' in game) && !('review' in game));
  check('its @id values are unique and the game belongs to the website', new Set(g.map((n) => n['@id'])).size === g.length && game?.isPartOf?.['@id'] === site?.['@id']);
}

console.log('\n4. robots.txt, sitemap, manifest, 404');
{
  const robots = read(prod, 'robots.txt');
  check('robots.txt (production) allows everything and names the sitemap', /User-agent: \*/.test(robots) && /^Allow: \/$/m.test(robots) && !/^Disallow: \/\s*$/m.test(robots) && robots.includes(`Sitemap: ${SITE}/sitemap.xml`));
  const sm = read(prod, 'sitemap.xml');
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  check('sitemap.xml is a valid urlset with the canonical URL once, absolute, with a lastmod date', /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/.test(sm) && locs.length === 1 && locs[0] === `${SITE}/` && /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(sm));
  const man = JSON.parse(read(prod, 'site.webmanifest'));
  check('the web manifest has a name, short name, start url, display, colours and 192 and 512 icons that exist at those sizes', !!man.name && !!man.short_name && man.start_url === '/' && !!man.display && /^#/.test(man.theme_color) && man.icons.every((i) => existsSync(join(prod, i.src)) && pngSize(join(prod, i.src)).join('x') === i.sizes) && man.icons.some((i) => i.sizes === '512x512') && man.icons.some((i) => i.sizes === '192x192'));
  check('apple-touch-icon is 180x180 and favicon.ico exists', pngSize(join(prod, 'apple-touch-icon.png')).join('x') === '180x180' && existsSync(join(prod, 'favicon.ico')));
  const nf = read(prod, '404.html');
  check('a custom 404.html (Netlify serves it for unknown URLs): noindex, a heading, a link home, and it shares the favicon', /<meta name="robots" content="noindex/.test(nf) && /<h1>/.test(nf) && /<a href="\/">/.test(nf) && /favicon\.svg/.test(nf));
  check('the site is a single page: the sitemap lists the one real URL and there are no redirects that could create soft-404s', !existsSync(join(prod, '_redirects')) && !existsSync(join(ROOT, 'netlify.toml')));
}

console.log('\n5. Deploy previews and branch deploys stay out of search results');
{
  const ph = read(preview, 'index.html');
  check('a non-production build says noindex, nofollow (and only that) in its robots meta', metaOf(ph, 'name', 'robots').length === 1 && metaOf(ph, 'name', 'robots')[0] === 'noindex, nofollow');
  check('and ships a robots.txt that disallows everything, with no sitemap', /^Disallow: \/\s*$/m.test(read(preview, 'robots.txt')) && !/Sitemap/.test(read(preview, 'robots.txt')));
  check('its canonical still points at the production domain (duplicates fold into the real site)', /<link rel="canonical" href="https:\/\/fireflipper\.com\/"/.test(ph));
  check('the production build is the unchanged default (no CONTEXT, or CONTEXT=production, is indexable)', !/noindex/.test(html));
  const prodCtx = (() => { const d = build('production'); const r = read(d, 'robots.txt'); return /Allow: \//.test(r) && !/noindex/.test(read(d, 'index.html')); })();
  check('an explicit Netlify CONTEXT=production build is indexable too', prodCtx);
}

console.log('\n6. The cache rules cover the new files');
{
  const headers = read(prod, '_headers');
  for (const f of ['/robots.txt', '/sitemap.xml', '/site.webmanifest', '/404.html', '/favicon.ico', '/apple-touch-icon.png', '/icon-*']) check(`${f} is revalidated (fixed name, so never stale)`, new RegExp(`^${f.replace(/[.*]/g, '\\$&')}\\n\\s+Cache-Control: public, max-age=0, must-revalidate`, 'm').test(headers));
}

console.log(failures ? `\n${failures} failed` : '\nseo tests passed');
process.exit(failures ? 1 : 0);
