/**
 * The tanager, built in code (no model file, no third-party licence). Ported from the Bulbuli project's Amazon
 * rainforest bird (games/world-explorer/rendering/rainforestBird.js and AmazonBirdAvatar.jsx), with the colours
 * made a parameter so it can be a fire bird.
 *
 * Parts, so the avatar can move them: body, legs, head (turns on the neck), tail, and a two-segment wing (arm and
 * hand) drawn separately. Metres, feet on y = 0, facing +z, beak tip to tail tip about 0.44 m. Pure and deterministic.
 */
import { Color, Float32BufferAttribute, MathUtils, Shape, ShapeGeometry } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRng } from '../../utils/random.js';
import { blob, createBuilder, leaf, linear, tube, v } from './meshBuilder.js';

export const TANAGER = Object.freeze({
  length: 0.44,
  /** Top of the head above the feet. */
  height: 0.27,
  /** Where the head turns, and where the tail is hinged. */
  neck: [0, 0.2, 0.085],
  tailRoot: [0, 0.15, -0.095],
  /** Where each wing is hinged: x (per side), y, z. */
  shoulder: [0.062, 0.185, 0.01],
});

/** Welds shared corners so the mesh shades smoothly. */
function finish(builder) {
  const geometry = builder.build();
  geometry.deleteAttribute('normal');
  const welded = mergeVertices(geometry, 1e-4);
  welded.computeVertexNormals();
  welded.computeBoundingSphere();
  welded.computeBoundingBox();
  geometry.dispose();
  return welded;
}

/** Every colour the tanager uses, as hex strings. */
export function tanagerColors(c) {
  return {
    breast: linear(c.breast),
    breastLow: linear(c.breastLow),
    head: linear(c.head),
    headTop: linear(c.headTop),
    back: linear(c.back),
    backDark: linear(c.backDark),
    tail: linear(c.tail),
    tailTip: linear(c.tailTip),
    beak: linear(c.beak),
    beakTip: linear(c.beakTip),
    leg: linear(c.leg),
    eye: linear('#120e0c'),
    shine: linear('#ffffff'),
  };
}

export function createTanagerParts(palette, seed = 3) {
  const C = tanagerColors(palette);
  const random = createRng(seed);
  const fur = (b, center, radius, scale, light, dark, { detail = 2, lumpy = 0.02 } = {}) =>
    blob(b, center, radius, scale, { detail, random, light, dark, lumpy });

  // body: a bright breast under a darker back, a rounded rump, soft shoulders
  const body = createBuilder();
  fur(body, v(0, 0.135, -0.005), 0.1, [0.68, 0.74, 1.12], C.back, C.back.clone().lerp(C.breast, 0.7));
  fur(body, v(0, 0.112, 0.05), 0.066, [0.88, 0.8, 0.95], C.breast, C.breastLow, { detail: 1 });
  fur(body, v(0, 0.15, -0.07), 0.07, [0.85, 0.75, 1], C.back, C.backDark, { detail: 1 });
  const parts = { body: finish(body) };

  // legs: thin, three forward toes and a short back one; their own part so they can tuck up in flight
  const legs = createBuilder();
  for (const side of [-1, 1]) {
    const hip = v(side * 0.03, 0.072, 0.005);
    const foot = v(side * 0.032, 0.006, 0.014);
    tube(legs, [hip, v(side * 0.032, 0.038, 0.01), foot], [0.0085, 0.0065, 0.006], {
      segments: 5,
      base: C.leg,
      cap: false,
    });
    for (const [dx, dz] of [
      [0.012 * side, 0.034],
      [0, 0.04],
      [-0.012 * side, 0.032],
      [0, -0.016],
    ]) {
      tube(legs, [foot, v(foot.x + dx, 0.004, foot.z + dz)], [0.005, 0.0035], { segments: 4, base: C.leg });
    }
  }
  parts.legs = finish(legs);

  // head: round, a short thick beak (the eyes are drawn by AvatarEyes); built round the neck pivot so it can turn
  const [, ny, nz] = TANAGER.neck;
  const head = createBuilder();
  fur(head, v(0, 0.215 - ny, 0.112 - nz), 0.062, [0.9, 0.92, 1], C.headTop, C.head, { detail: 2 });
  fur(head, v(0, 0.195 - ny, 0.1 - nz), 0.05, [0.9, 0.8, 1], C.head, C.breast, { detail: 1 });
  tube(
    head,
    [v(0, 0.208 - ny, 0.158 - nz), v(0, 0.202 - ny, 0.19 - nz), v(0, 0.196 - ny, 0.218 - nz)],
    [0.026, 0.017, 0.004],
    {
      segments: 6,
      base: C.beak,
      tip: C.beakTip,
    },
  );
  tube(
    head,
    [v(0, 0.2 - ny, 0.156 - nz), v(0, 0.193 - ny, 0.186 - nz), v(0, 0.19 - ny, 0.208 - nz)],
    [0.018, 0.012, 0.004],
    {
      segments: 5,
      base: C.beak.clone().multiplyScalar(0.85),
      tip: C.beakTip,
    },
  );
  parts.head = finish(head);

  // tail: five long feathers fanned a little; its origin is the hinge (tailRoot)
  const tail = createBuilder();
  for (let k = -2; k <= 2; k += 1) {
    const length = 0.135 - Math.abs(k) * 0.012 + random() * 0.006;
    leaf(tail, v(k * 0.006, 0, 0), v(k * 0.1, -0.2, -1), length, 0.03, C.tail, C.tailTip, {
      droop: 0.04,
      fold: 0.15,
      curl: 0.12,
      roll: 0.1 * k,
    });
  }
  parts.tail = finish(tail);
  return parts;
}

/** One feathered wing segment in the XZ plane: span along +x, trailing edge towards -z, coloured root to tip. */
export function wingSegment(span, rootChord, tipChord, feathers, wingColors) {
  const shape = new Shape();
  shape.moveTo(0, 0.02);
  shape.bezierCurveTo(span * 0.35, 0.035, span * 0.75, 0.03, span, 0.005);
  // feathered trailing edge, from the tip back to the root
  for (let i = feathers; i >= 0; i -= 1) {
    const u = i / feathers;
    const chord = rootChord + (tipChord - rootChord) * u;
    shape.lineTo(span * u, -chord);
    if (i > 0) shape.lineTo(span * (u - 0.5 / feathers), -chord * 0.86);
  }
  shape.lineTo(0, 0.02);
  const geometry = new ShapeGeometry(shape, 6);
  geometry.rotateX(Math.PI / 2); // shape y -> world z (chord points forward/back)
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const root = new Color(wingColors.root);
  const tip = new Color(wingColors.tip);
  const edge = new Color(wingColors.edge);
  const c = new Color();
  for (let i = 0; i < pos.count; i += 1) {
    const u = MathUtils.clamp(pos.getX(i) / span, 0, 1);
    const back = MathUtils.clamp(-pos.getZ(i) / rootChord, 0, 1);
    c.copy(root)
      .lerp(tip, u * 0.85)
      .lerp(edge, back * back * 0.55);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
