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
import { AVATAR_GROUPS } from '../src/systems/avatars/avatars.js';
import { createFireMaterial, createFireUniforms } from '../src/components/scene/fireMaterial.js';
import { splitWing } from '../src/systems/avatars/splitWing.js';
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { TANAGER, createTanagerParts, wingSegment } from '../src/systems/avatars/tanager.js';
import {
  STROKE_TIME,
  flapStroke,
  secondaryMotion,
  wingLiftTarget,
} from '../src/components/scene/birdMotion.js';

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
    AVATARS.every((a) => ['firebird', 'bird', 'model'].includes(a.kind)),
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

section('Code-built birds');
{
  const built = AVATARS.filter((a) => a.kind === 'bird');
  check('there are code-built birds', built.length >= 6, `${built.length}`);
  check(
    'they are all free',
    built.every((a) => isAvatarUnlocked(a, 0)),
  );
  check(
    'every avatar sits in a known group',
    AVATARS.every((a) => AVATAR_GROUPS.includes(a.group)),
  );
  check(
    'every group has birds',
    AVATAR_GROUPS.every((g) => AVATARS.some((a) => a.group === g)),
  );
  const flame = ['glow', 'low', 'mid', 'high'];
  for (const a of built) {
    check(`${a.id}: form is known`, a.form === 'bulbuli' || a.form === 'tanager');
    check(`${a.id}: has a tagline and a size`, a.tagline.length > 5 && a.length > 0);
    check(
      `${a.id}: flame colours are hex`,
      flame.every((k) => hex.test(a.palette[k])),
    );
    if (a.form === 'bulbuli') {
      const keys = ['body', 'wing', 'belly', 'crest', 'cheek', 'accent', 'beak', 'eye'];
      check(
        `${a.id}: bulbuli colours are hex`,
        keys.every((k) => hex.test(a.palette[k])),
      );
    } else {
      check(
        `${a.id}: tanager colours are hex`,
        Object.values(a.palette.colors).every((c) => hex.test(c)) &&
          Object.keys(a.palette.colors).length === 11,
      );
      check(
        `${a.id}: wing colours are hex`,
        ['root', 'tip', 'edge'].every((k) => hex.test(a.palette.wing[k])),
      );
    }
  }
  check(
    'both bulbuli and tanager forms are present',
    built.some((a) => a.form === 'bulbuli') && built.some((a) => a.form === 'tanager'),
  );

  // The tanager is generated geometry: it must build, be deterministic, and be the size it claims.
  const tanagers = built.filter((a) => a.form === 'tanager');
  const a1 = createTanagerParts(tanagers[0].palette.colors);
  const a2 = createTanagerParts(tanagers[0].palette.colors);
  const b1 = createTanagerParts(tanagers[1].palette.colors);
  check(
    'the tanager builds all its parts',
    ['body', 'legs', 'head', 'tail'].every((k) => a1[k].attributes.position.count > 10),
  );
  const same = (g, h, attr) => g.attributes[attr].array.every((x, i) => x === h.attributes[attr].array[i]);
  check(
    'the tanager is deterministic',
    same(a1.body, a2.body, 'position') && same(a1.tail, a2.tail, 'color'),
  );
  check(
    'a different colour scheme changes the colours, not the shape',
    same(a1.body, b1.body, 'position') && !same(a1.body, b1.body, 'color'),
  );
  a1.body.computeBoundingBox();
  const size = a1.body.boundingBox.getSize(new Vector3());
  check(
    'the tanager body is about the size it claims',
    size.z > 0.1 && size.z < TANAGER.length && size.y < TANAGER.height * 1.2,
    JSON.stringify(size),
  );
  const wing = wingSegment(0.14, 0.13, 0.12, 3, tanagers[0].palette.wing);
  check(
    'a wing segment has positions and colours',
    wing.attributes.position.count > 6 && wing.attributes.color.count === wing.attributes.position.count,
  );

  // Wing motion shared by the code-built birds.
  check('a flap snaps the wings up', flapStroke(0.1) > 0.8);
  check('then the powered downstroke takes them below level', flapStroke(0.45) < 0);
  check(
    'right after a flap the wings are high',
    wingLiftTarget({ sinceFlap: 0.03, vy: 7, dead: false }, 0) > 0.6,
  );
  check(
    'between flaps they beat gently',
    Math.abs(wingLiftTarget({ sinceFlap: STROKE_TIME + 1, vy: 0, dead: false }, 1) - 0.75) < 1e-9,
  );
  check(
    'in a dive they tuck',
    wingLiftTarget({ sinceFlap: 5, vy: -14, dead: false }, 0) <
      wingLiftTarget({ sinceFlap: 5, vy: 0, dead: false }, 0),
  );
  check('after a crash they hang limp', wingLiftTarget({ sinceFlap: 0.1, vy: 0, dead: true }, 0) < 0);
  check(
    'in the menu preview (no flight) they beat',
    wingLiftTarget(undefined, 1) > wingLiftTarget(undefined, -1),
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

section('Wing beats on every bird');
{
  // Every model bird must really flap: either a butterfly (split wings) or a bird with wing-bend settings.
  for (const m of MODEL_BIRDS) {
    if (m.form === 'butterfly') continue;
    check(`${m.id}: has wing-bend settings`, Boolean(m.flap));
    const f = m.flap ?? {};
    check(
      `${m.id}: the settings are sane`,
      f.start > 0 &&
        f.full > f.start &&
        f.full <= 1 &&
        f.hingeFrac > 0 &&
        f.hingeFrac < 1 &&
        f.strength > 0 &&
        f.strength <= 1.5,
      JSON.stringify(f),
    );
  }
  check(
    'no model bird is left without wing beats',
    MODEL_BIRDS.every((m) => m.form === 'butterfly' || m.flap),
  );
  check(
    'birds whose wings are folded (a perched eagle) are not in the list',
    !MODEL_BIRDS.some((m) => m.id === 'harpy-eagle'),
  );

  // The shader patch: with settings it bends wings, without them it changes nothing.
  const flapped = createFireUniforms(MODEL_BIRDS[0].palette, 0, 1, {
    start: 0.2,
    full: 0.5,
    hinge: [0, 0.4, 0],
    axis: [0, 0, 2],
  });
  check(
    'wing settings reach the uniforms',
    flapped.uWing.value.x === 0.2 && flapped.uWing.value.y === 0.5 && flapped.uHinge.value.y === 0.4,
  );
  check('the axis is normalised', Math.abs(flapped.uAxis.value.length() - 1) < 1e-9);
  const still = createFireUniforms(MODEL_BIRDS[0].palette, 0, 1);
  check('without settings nothing can bend', still.uWing.value.x > 1e8 && still.uFlap.value === 0);

  const material = createFireMaterial({ map: null, side: 0 }, flapped, 'test');
  const shader = {
    uniforms: {},
    vertexShader: '#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>',
    fragmentShader: '#include <common>\n#include <map_fragment>\n#include <emissivemap_fragment>',
  };
  material.onBeforeCompile(shader);
  check(
    'the vertex shader rotates positions and normals',
    shader.vertexShader.includes('flapRotate(transformed - uHinge') &&
      shader.vertexShader.includes('objectNormal = flapRotate'),
  );
  check(
    'the flap uniforms are shared with the bird',
    shader.uniforms.uFlap === flapped.uFlap && shader.uniforms.uWing === flapped.uWing,
  );
  check('the fire colour is still applied', shader.fragmentShader.includes('fireGradient'));
}

section('Body moves with the wings');
{
  const rest = secondaryMotion(0.25, 0.25);
  check(
    'at rest between strokes there is no pitch',
    (rest.bodyPitch === 0 && rest.headPitch === 0 && rest.tailPitch === 0) ||
      Math.abs(rest.bodyPitch) < 1e-12,
  );
  const down = secondaryMotion(0.0, 0.6); // wings coming down: the slow follower is still higher
  const up = secondaryMotion(0.6, 0.0);
  check('on the downstroke the nose lifts', down.bodyPitch > 0);
  check('on the upstroke the nose drops', up.bodyPitch < 0);
  check('the head turns against the body pitch', down.headPitch < 0 && up.headPitch > 0);
  check('the tail flexes against the body pitch', down.tailPitch < 0 && up.tailPitch > 0);
  check(
    'the body rises as the wings go down',
    secondaryMotion(-0.8, -0.8).heave > secondaryMotion(1.0, 1.0).heave,
  );
  const extremes = [-0.8, 0.25, 1.05].flatMap((a) => [-0.8, 0.25, 1.05].map((b) => secondaryMotion(a, b)));
  check(
    'the motion is small enough to stay on the body',
    extremes.every(
      (m) =>
        Math.abs(m.bodyPitch) < 0.35 &&
        Math.abs(m.headPitch) < 0.3 &&
        Math.abs(m.tailPitch) < 0.6 &&
        Math.abs(m.heave) < 0.15,
    ),
  );
  const dead = secondaryMotion(-0.35, -0.35, true);
  check('after a crash the head droops and the tail hangs', dead.headPitch < 0 && dead.tailPitch > 0);

  // The shader side: head and tail pitch uniforms, and which end is the head.
  const bent = createFireUniforms(MODEL_BIRDS[0].palette, 0, 1, null, {
    start: 0.1,
    full: 0.4,
    headSign: -1,
    hinge: [0, 0.2, 0.3],
  });
  check(
    'bend settings reach the uniforms',
    bent.uBend.value.x === 0.1 &&
      bent.uBend.value.y === 0.4 &&
      bent.uHeadSign.value === -1 &&
      bent.uHinge.value.z === 0.3,
  );
  check('head and tail pitches start at zero', bent.uHeadPitch.value === 0 && bent.uTailPitch.value === 0);
  const flat = createFireUniforms(MODEL_BIRDS[0].palette, 0, 1);
  check('without bend settings nothing can bend', flat.uBend.value.x > 1e8);
  const shader = {
    uniforms: {},
    vertexShader: '#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>',
    fragmentShader: '#include <common>\n#include <map_fragment>\n#include <emissivemap_fragment>',
  };
  createFireMaterial({ map: null, side: 0 }, bent, 'bend-test').onBeforeCompile(shader);
  check(
    'the shader pitches the head and tail ends',
    shader.vertexShader.includes('bendRotate') &&
      shader.vertexShader.includes('uHeadPitch') &&
      shader.vertexShader.includes('uTailPitch'),
  );
  check(
    'the wings are left out of the bend',
    shader.vertexShader.includes('1.0 - smoothstep(uWing.x, uWing.y'),
  );
}

section('Butterfly');
{
  const fly = MODEL_BIRDS.find((m) => m.form === 'butterfly');
  check('there is a butterfly', Boolean(fly));
  check('it is free and a model', isAvatarUnlocked({ ...fly, kind: 'model' }, 0));
  check(
    'its hinge numbers are sane',
    fly.hingePoint.length === 3 &&
      fly.hingePoint.every(Number.isFinite) &&
      Number.isFinite(fly.hingeTilt) &&
      Number.isFinite(fly.roll) &&
      fly.beat > 0,
  );

  // A tiny two-wing geometry: one triangle on each side of the body, one straddling it on the left.
  const g = new BufferGeometry();
  g.setAttribute(
    'position',
    new Float32BufferAttribute(
      [-2, 0, 0, -1, 0, 0, -1.5, 1, 0, 2, 0, 0, 1, 0, 0, 1.5, 1, 0, -0.2, 0, 0, 0.1, 0, 0, -0.3, 1, 0],
      3,
    ),
  );
  g.setIndex([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const { left, right } = splitWing(g);
  check('the left half has the triangles left of the body', left.index.count === 6);
  check('the right half has the triangles right of the body', right.index.count === 3);
  check('every triangle goes to exactly one side', left.index.count + right.index.count === 9);
  check(
    'the halves share the source vertex data',
    left.getAttribute('position') === g.getAttribute('position') &&
      right.getAttribute('position') === g.getAttribute('position'),
  );
}

section('Eyes');
{
  // Every bird gets big, glowing eyes from the shared AvatarEyes component.
  for (const m of MODEL_BIRDS) {
    const e = m.eye;
    check(`${m.id}: has eye settings`, Boolean(e) && Array.isArray(e.at) && e.at.length === 3);
    if (!e) continue;
    check(
      `${m.id}: eye is big enough to see, small enough for a head`,
      e.size >= 0.01 && e.size <= 0.1,
      `${e.size}`,
    );
    check(`${m.id}: eye sits at the head end`, Math.sign(e.at[2]) === Math.sign(m.facing), `${e.at[2]}`);
    check(`${m.id}: eye is on the side of the head (x > 0)`, e.at[0] > 0 && e.at[0] < 0.2, `${e.at[0]}`);
  }
  const scene = (f) => fs.readFileSync(path.join(root, 'src/components/scene', f), 'utf8');
  for (const f of ['Firebird', 'BulbuliBird', 'TanagerBird', 'ModelBird', 'ButterflyBird']) {
    const src = scene(`${f}.jsx`);
    check(`${f} draws AvatarEyes`, src.includes('<AvatarEyes') && src.includes("from './AvatarEyes.jsx'"));
    check(`${f} passes the live flight state to the eyes`, /<AvatarEyes[\s\S]*?flight=\{flight\}/.test(src));
  }
  const eyes = scene('AvatarEyes.jsx');
  check('eyes blink', eyes.includes('BLINK_TIME') && eyes.includes('scale.y'));
  check('eyes close on a crash', /dead/.test(eyes) && /closed/.test(eyes));
  check('eyes follow the climb and fall', /flight\?\.vy/.test(eyes));
  check('eyes use unlit materials so they stay bright', eyes.includes('MeshBasicMaterial'));
  check(
    'the tanager builder no longer draws its own tiny eyes',
    !/C\.eye/.test(
      fs
        .readFileSync(path.join(root, 'src/systems/avatars/tanager.js'), 'utf8')
        .split('parts.head')[0]
        .split('// head:')[1] ?? '',
    ),
  );
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
