/**
 * Avatar catalogue tests. Run with: npm run test:avatars
 * Checks the bird list, the model files and the credits (CC BY 4.0 needs author, licence link and changes shown).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AVATARS,
  DEFAULT_AVATAR_ID,
  MODEL_BIRDS,
  getAvatar,
  isAvatarUnlocked,
  modelUrl,
  resolveAvatar,
} from '../src/systems/avatars/avatars.js';
import { CREDITS, FIRE_FLIPPER_CHANGES, LICENCE, getCredit } from '../src/systems/avatars/credits.js';
import { SKINS } from '../src/systems/skins/skins.js';

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
const hex = /^#[0-9a-f]{6}$/i;

section('Avatar list');
{
  const ids = AVATARS.map((a) => a.id);
  check('ids are unique', new Set(ids).size === ids.length);
  check(
    'every avatar has a name',
    AVATARS.every((a) => typeof a.name === 'string' && a.name.length > 1),
  );
  check(
    'kinds are known',
    AVATARS.every((a) => a.kind === 'firebird' || a.kind === 'model'),
  );
  check(
    'the default is the original bird, always unlocked',
    getAvatar(DEFAULT_AVATAR_ID).kind === 'firebird' && isAvatarUnlocked(getAvatar(DEFAULT_AVATAR_ID), 0),
  );
  check(
    'the original bird colour schemes are all still there',
    SKINS.every((s) => ids.includes(s.id)),
  );
  check('there are model birds to choose from', MODEL_BIRDS.length >= 6, `${MODEL_BIRDS.length}`);
  check(
    'model birds are free to choose',
    MODEL_BIRDS.every((m) => isAvatarUnlocked({ ...m, kind: 'model' }, 0)),
  );
  check(
    'colour schemes still unlock by score',
    !isAvatarUnlocked(getAvatar(SKINS[1].id), SKINS[1].unlockScore - 1) &&
      isAvatarUnlocked(getAvatar(SKINS[1].id), SKINS[1].unlockScore),
  );
  check('an unknown id falls back to the default', getAvatar('nope').id === DEFAULT_AVATAR_ID);
  check('a locked choice resolves to the default', resolveAvatar(SKINS[2].id, 0).id === DEFAULT_AVATAR_ID);
  check(
    'a model bird resolves to itself at any score',
    resolveAvatar(MODEL_BIRDS[0].id, 0).id === MODEL_BIRDS[0].id,
  );
  check(
    'model URLs are under /models/birds',
    MODEL_BIRDS.every((m) => modelUrl(m).endsWith(`/models/birds/${m.file}`)),
  );
}

section('Model birds');
{
  for (const m of MODEL_BIRDS) {
    const p = m.palette;
    check(
      `${m.id}: fields are sane`,
      m.file.endsWith('.glb') &&
        Number.isFinite(m.facing) &&
        Number.isFinite(m.pitch) &&
        m.length > 0 &&
        Number.isFinite(m.lift),
    );
    check(
      `${m.id}: palette colours are hex`,
      [p.low, p.mid, p.high, p.glow].every((c) => hex.test(c)),
    );
    check(
      `${m.id}: palette numbers are in range`,
      p.mix >= 0 && p.mix <= 1 && p.glowStrength > 0 && p.lumFloor >= 0 && p.lumFloor <= 1,
    );
    check(`${m.id}: has a tagline`, typeof m.tagline === 'string' && m.tagline.length > 5);

    const file = path.join(root, 'public/models/birds', m.file);
    const exists = fs.existsSync(file);
    check(`${m.id}: the model file exists`, exists);
    if (!exists) continue;
    const buf = fs.readFileSync(file);
    check(
      `${m.id}: is a glTF 2.0 binary`,
      buf.toString('ascii', 0, 4) === 'glTF' && buf.readUInt32LE(4) === 2,
    );
    check(`${m.id}: is under 1 MB`, buf.length < 1_000_000, `${buf.length} bytes`);
    const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString());
    check(
      `${m.id}: has a mesh with positions`,
      json.meshes?.length >= 1 &&
        json.meshes.every((mesh) => mesh.primitives.every((pr) => pr.attributes.POSITION !== undefined)),
    );
    check(`${m.id}: has a texture to build on`, (json.images ?? []).length >= 1);
    check(`${m.id}: is static (no skeleton or animation)`, !json.skins?.length && !json.animations?.length);
  }
  const total = MODEL_BIRDS.reduce(
    (s, m) => s + fs.statSync(path.join(root, 'public/models/birds', m.file)).size,
    0,
  );
  check('all model files together are under 4 MB', total < 4_000_000, `${total} bytes`);
}

section('Credits (CC BY 4.0)');
{
  check(
    'the licence is CC BY 4.0 with a link',
    LICENCE.name === 'CC BY 4.0' && LICENCE.url.startsWith('https://creativecommons.org/licenses/by/4.0'),
  );
  check(
    'every model bird has a credit',
    MODEL_BIRDS.every((m) => getCredit(m.id)),
  );
  check(
    'every credit belongs to a model bird',
    CREDITS.every((c) => MODEL_BIRDS.some((m) => m.id === c.id)),
  );
  check('credit ids are unique', new Set(CREDITS.map((c) => c.id)).size === CREDITS.length);
  for (const c of CREDITS) {
    check(`${c.id}: names the author and the work`, c.author.length > 1 && c.title.length > 1);
    check(
      `${c.id}: links the author and the source`,
      c.authorUrl.startsWith('https://sketchfab.com/') &&
        c.sourceUrl.startsWith('https://sketchfab.com/3d-models/'),
    );
    check(`${c.id}: states what was changed`, c.changes.length >= 1 && c.changes.every((t) => t.length > 10));
  }
  check('the changes made by Fire Flipper are stated', FIRE_FLIPPER_CHANGES.length >= 1);

  const doc = fs.readFileSync(path.join(root, 'CREDITS.md'), 'utf8');
  for (const c of CREDITS) {
    check(
      `CREDITS.md lists ${c.id}`,
      doc.includes(c.author) && doc.includes(c.sourceUrl) && doc.includes(c.authorUrl),
    );
  }
  check('CREDITS.md links the licence', doc.includes(LICENCE.url));
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
