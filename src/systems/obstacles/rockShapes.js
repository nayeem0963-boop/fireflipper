import { WORLD } from '../physics/constants.js';

/**
 * Zone obstacle shapes (pure data and maths, no rendering): for each scenery zone a "kit" of outlines (poles that rise from the ground or hang from above, a passage's arch span and
 * ledge, boulders) and the convex polygons the simulation collides with. The renderer's geometry (components/scene/rockSets.js) is built from the very same outlines, so what the
 * player sees is what the bird hits. The canyon's hoodoos, fins and arch lintels were the first kit; the others follow the same rules.
 *
 * Fairness rules, all checked by scripts/rock-colliders-test.mjs for every kit:
 *  - a shape never reaches into its corridor: the gap end of a pole (its tip, cap or underside) stays at or beyond the gap edge, so the guaranteed clearance of every section is exactly
 *    what the patterns promise; arches and ledges only ADD room (their gap face rises or drops away from the corridor, and meets the original gap height at the section's ends);
 *  - nothing here draws a random number: which shape an obstacle gets comes from a hash of its position, so every generated track is identical to before.
 *
 * Outlines are measured in widths `w` of the pole, as distance `d` from the gap end along the pole. A control point is [d, left, right]: the pole spans from x - left to x + right there.
 * A pole look is 'capped' (a head, then a stem that repeats: hoodoos, lintels, spires, columns) or 'blade' (tip to foot in one outline: fins, icicles, obelisks). Capped looks go one way
 * (rising or hanging); blades may be used both ways.
 */
const PERIODIC = (start, period, offsets) => ({ start, period, offsets });
const capped = (head, tail) => ({ type: 'capped', head, tail });
/** A blade is [d, half width, lean] rows (the lean shifts the centre towards +x), tip first; its last row is where the straight foot begins. */
const blade = (rows) => ({ type: 'blade', blade: rows });

export const KITS = Object.freeze({
  /** Red Rock Canyon: sandstone hoodoos, leaning fins, stepped arch lintels. */
  canyon: {
    poles: {
      hoodoo: capped([[0, 0.52, 0.52], [0.06, 0.6, 0.6], [0.32, 0.6, 0.6], [0.42, 0.48, 0.48], [0.58, 0.3, 0.3]], PERIODIC(0.58, 1.8, [[0, 0.3], [0.45, 0.27], [0.9, 0.34], [1.35, 0.31], [1.8, 0.3]])),
      lintel: capped([[0, 0.5, 0.5], [0.12, 0.58, 0.58], [0.52, 0.58, 0.58], [0.64, 0.46, 0.46]], PERIODIC(0.64, 1.4, [[0, 0.46], [0.58, 0.46], [0.7, 0.54], [1.28, 0.54], [1.4, 0.46]])),
      fin: blade([[0, 0.05, 0.28], [0.9, 0.2, 0.2], [1.8, 0.36, 0.12], [2.8, 0.48, 0.04], [3.6, 0.5, 0]]),
    },
    rising: ['hoodoo', 'fin'],
    hanging: ['fin', 'lintel'],
    passage: { rise: 0.5, drop: 0.6, bevel: 0.1, power: 0.7 },
  },
  /** Frosty Polar: banded ice spires with a pointed crown, ice blades, hanging icicles and blunt ice keystones. */
  frosty: {
    poles: {
      spire: capped([[0, 0.07, 0.07], [0.35, 0.26, 0.26], [0.8, 0.36, 0.36], [1.1, 0.34, 0.34]], PERIODIC(1.1, 1.6, [[0, 0.34], [0.4, 0.42], [0.8, 0.36], [1.2, 0.43], [1.6, 0.34]])),
      iceBlade: blade([[0, 0.04, 0.1], [1.2, 0.18, 0.08], [2.4, 0.34, 0.04], [3.4, 0.46, 0], [4.0, 0.5, 0]]),
      icicle: blade([[0, 0.03, 0], [1.4, 0.14, 0], [2.8, 0.28, 0], [4.0, 0.42, 0], [4.8, 0.5, 0]]),
      keystone: capped([[0, 0.46, 0.46], [0.1, 0.54, 0.54], [0.45, 0.54, 0.54], [0.6, 0.4, 0.4]], PERIODIC(0.6, 1.6, [[0, 0.4], [0.5, 0.46], [0.9, 0.4], [1.3, 0.47], [1.6, 0.4]])),
    },
    rising: ['spire', 'iceBlade'],
    hanging: ['icicle', 'keystone'],
    passage: { rise: 0.55, drop: 0.6, bevel: 0.1, power: 0.7 },
  },
  /** Celestial City: crystal gems on beaded stems, monoliths, hanging shards and crystal clusters, a star-gate arch over a cloud ledge. */
  celestial: {
    poles: {
      gem: capped([[0, 0.12, 0.12], [0.3, 0.36, 0.36], [0.55, 0.46, 0.46], [0.85, 0.34, 0.34], [1.0, 0.3, 0.3]], PERIODIC(1.0, 1.5, [[0, 0.3], [0.5, 0.36], [0.75, 0.3], [1.0, 0.4], [1.5, 0.3]])),
      monolith: blade([[0, 0.04, 0.08], [1.0, 0.18, 0.06], [2.2, 0.34, 0.03], [3.2, 0.46, 0], [4.0, 0.5, 0]]),
      shard: blade([[0, 0.03, 0], [0.9, 0.2, 0], [2.0, 0.36, 0], [3.0, 0.5, 0]]),
      cluster: capped([[0, 0.08, 0.08], [0.3, 0.3, 0.3], [0.7, 0.48, 0.48], [1.0, 0.36, 0.36]], PERIODIC(1.0, 1.6, [[0, 0.36], [0.5, 0.44], [1.0, 0.36], [1.3, 0.42], [1.6, 0.36]])),
    },
    rising: ['gem', 'monolith'],
    hanging: ['shard', 'cluster'],
    passage: { rise: 0.6, drop: 0.55, bevel: 0.1, power: 0.7 },
  },
  /** Rose Sky Palace: fluted marble columns with capitals, obelisks, hanging finials and corbels, a grand arch over a terrace. */
  palace: {
    poles: {
      column: capped([[0, 0.5, 0.5], [0.07, 0.58, 0.58], [0.28, 0.58, 0.58], [0.38, 0.42, 0.42], [0.5, 0.36, 0.36]], PERIODIC(0.5, 1.6, [[0, 0.36], [0.4, 0.4], [0.8, 0.38], [1.2, 0.4], [1.6, 0.36]])),
      obelisk: blade([[0, 0.05, 0.06], [1.0, 0.2, 0.05], [2.2, 0.36, 0.02], [3.2, 0.46, 0], [4.0, 0.5, 0]]),
      finial: blade([[0, 0.04, 0], [1.1, 0.16, 0], [2.2, 0.3, 0], [3.4, 0.44, 0], [4.2, 0.5, 0]]),
      corbel: capped([[0, 0.44, 0.44], [0.1, 0.52, 0.52], [0.35, 0.52, 0.52], [0.5, 0.36, 0.36]], PERIODIC(0.5, 1.5, [[0, 0.36], [0.5, 0.42], [0.75, 0.42], [1.0, 0.36], [1.5, 0.36]])),
    },
    rising: ['column', 'obelisk'],
    hanging: ['finial', 'corbel'],
    passage: { rise: 0.7, drop: 0.6, bevel: 0.1, power: 0.7 },
  },
  /** Cloud Sanctuary (5000 m on, without end): bulging cloud pillars, golden spires, hanging pendants and gilded keystones, a cloud arch over a ledge. */
  sanctuary: {
    poles: {
      pillar: capped([[0, 0.42, 0.42], [0.12, 0.54, 0.54], [0.4, 0.54, 0.54], [0.55, 0.42, 0.42]], PERIODIC(0.55, 1.6, [[0, 0.42], [0.4, 0.5], [0.8, 0.42], [1.2, 0.5], [1.6, 0.42]])),
      goldspire: blade([[0, 0.03, 0], [1.4, 0.16, 0.04], [2.8, 0.32, 0.02], [4.0, 0.46, 0], [4.6, 0.5, 0]]),
      pendant: blade([[0, 0.04, 0], [1.0, 0.18, 0], [2.0, 0.34, 0], [3.0, 0.46, 0], [3.6, 0.5, 0]]),
      keystone: capped([[0, 0.46, 0.46], [0.1, 0.56, 0.56], [0.4, 0.56, 0.56], [0.55, 0.4, 0.4]], PERIODIC(0.55, 1.4, [[0, 0.4], [0.5, 0.48], [0.7, 0.48], [1.0, 0.4], [1.4, 0.4]])),
    },
    rising: ['pillar', 'goldspire'],
    hanging: ['pendant', 'keystone'],
    passage: { rise: 0.65, drop: 0.6, bevel: 0.1, power: 0.7 },
  },
});

/**
 * Master switches. `enabled` turns every kit off at once; `kits` turns one off. One switch drives both what is drawn and what is collided with (a visual that differs from its
 * collider would be unfair), so a kit set to false brings back the zone's original obstacles with their original colliders, in one line. The tests turn everything on.
 */
export const ROCK_SHAPES = { enabled: true, kits: { canyon: true, frosty: true, celestial: true, palace: true, sanctuary: true } };

/** Where each kit's zone begins along the track (a test checks these equal the scenery zones' starts: the simulation cannot read the zones itself). */
export const KIT_STARTS = Object.freeze([['canyon', 0], ['frosty', 1500], ['celestial', 2000], ['palace', 3000], ['sanctuary', 5000]]);

/** The kit of the zone a track position is in, or null where the original obstacles stand (a zone whose kit is not built yet, or switched off). */
export function rockKit(x) {
  if (!ROCK_SHAPES.enabled) return null;
  let id = null;
  for (const [k, s] of KIT_STARTS) if (x >= s) id = k;
  return id && ROCK_SHAPES.kits[id] ? id : null;
}

/** Deterministic 0..1 from a track position (no random numbers are drawn, so tracks are unchanged). */
export const hash01 = (x) => {
  const v = Math.sin(x * 12.9898 + 4.1414) * 43758.5453;
  return v - Math.floor(v);
};

/** The look of an obstacle in a kit: a pole is picked from the kit's rising or hanging list by position (`cap` > 0 rises from the ground, < 0 hangs). */
export function pickLook(kit, kind, cap, x) {
  if (kind === 'rock') return 'boulder';
  if (kind === 'block') return cap > 0 ? 'ledge' : 'arch';
  const list = cap > 0 ? KITS[kit].rising : KITS[kit].hanging;
  return list[Math.min(list.length - 1, Math.floor(hash01(x) * list.length))];
}

export const poleDef = (kit, look) => KITS[kit].poles[look];
/** Blades lean forward (towards +x). One direction keeps the renderer's mesh count down. */
const LEAN = 1;

/** Control points [d, left, right] of a pole look, from the gap end (d = 0) to `dMax` widths, the last one cut exactly at dMax. */
export function controlPoints(kit, look, dMax) {
  const def = poleDef(kit, look);
  let pts;
  if (def.type === 'blade') {
    const rows = def.blade;
    pts = rows.map(([d, hw, c]) => [d, hw - c * LEAN, hw + c * LEAN]);
    const last = rows[rows.length - 1];
    pts.push([Math.max(dMax, last[0]) + 1, last[1], last[1]]);
  } else {
    pts = def.head.map((p) => p.slice());
    const { start, period, offsets } = def.tail;
    for (let k = 0; start + k * period <= dMax + period; k++) {
      for (let i = 1; i < offsets.length; i++) {
        const [o, hw] = offsets[i];
        pts.push([start + k * period + o, hw, hw]);
      }
    }
  }
  // cut at dMax
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    if (pts[i][0] >= dMax) {
      if (i === 0) out.push([0, pts[0][1], pts[0][2]]);
      else {
        const [d0, l0, r0] = pts[i - 1];
        const [d1, l1, r1] = pts[i];
        const t = d1 === d0 ? 0 : (dMax - d0) / (d1 - d0);
        out.push([dMax, l0 + (l1 - l0) * t, r0 + (r1 - r0) * t]);
      }
      return out;
    }
    out.push(pts[i]);
  }
  return out;
}

/** Orders a quad counter-clockwise (the collision tests need it). */
function ccw(p) {
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    a += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1];
  }
  if (a >= 0) return p;
  return [p[6], p[7], p[4], p[5], p[2], p[3], p[0], p[1]];
}

/** How deep (in widths from the gap end) a pole's collider is shaped: only the part a bird can reach (see columnPolys). */
export function poleReach(cap, gapEndY, w, yBottom, yTop) {
  const farY = cap > 0 ? yBottom : yTop;
  const total = Math.abs(gapEndY - farY) / w;
  const reachY = cap > 0 ? WORLD.groundY - 0.5 : WORLD.ceilingY + 1.0;
  return { total, reach: Math.max(0.05, Math.min(total, Math.abs(gapEndY - reachY) / w)) };
}

/**
 * The convex polygons of a pole (a rising or hanging column): one quad per stretch between control points, as flat [x0, y0, ... x3, y3] arrays in track coordinates, and a last quad
 * carrying the final width on to the far end. Only the part a bird can reach (down to just under the ground, up to just over the ceiling) is shaped; the rest is one plain quad.
 */
export function columnPolys(kit, look, cx, gapEndY, cap, w, yBottom, yTop) {
  const dir = cap > 0 ? 1 : -1;
  const farY = cap > 0 ? yBottom : yTop;
  const { total, reach: dReach } = poleReach(cap, gapEndY, w, yBottom, yTop);
  const pts = controlPoints(kit, look, dReach);
  const polys = [];
  const yAt = (d) => gapEndY - dir * d * w;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [d0, l0, r0] = pts[i];
    const [d1, l1, r1] = pts[i + 1];
    if (d1 - d0 < 1e-6) continue; // a stretch of no length (the reach landed on a control point): nothing to collide with
    polys.push(ccw([cx - l0 * w, yAt(d0), cx - l1 * w, yAt(d1), cx + r1 * w, yAt(d1), cx + r0 * w, yAt(d0)]));
  }
  if (total > dReach + 1e-9) {
    const [d, l, r] = pts[pts.length - 1];
    polys.push(ccw([cx - l * w, yAt(d), cx - l * w, farY, cx + r * w, farY, cx + r * w, yAt(d)]));
  }
  return polys;
}

/** Fractions along a passage slab where its outline is sampled: ten equal strips (the geometry stretches to the slab's length, so it uses the same ones). */
export const SLAB_STRIPS = 10;
export const slabSamples = () => Array.from({ length: SLAB_STRIPS + 1 }, (_, i) => i / SLAB_STRIPS);

/** Underside rise of a kit's arch span at fraction u along it (0 at both springers). */
export const archRise = (kit, u) => KITS[kit].passage.rise * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u))), KITS[kit].passage.power);
/** How far a kit's ledge top drops below the gap height at fraction u along it (0 in the middle, `drop` at each end). */
export const ledgeDrop = (kit, u) => KITS[kit].passage.drop * Math.max(0, 1 - Math.min(u, 1 - u) / KITS[kit].passage.bevel);

/** Arch span (the upper slab of a passage): the underside rises from the gap height at both ends; strips from there up to the slab's top. */
export function archPolys(kit, x0, x1, yBottom, yTop) {
  const L = x1 - x0;
  const us = slabSamples();
  const polys = [];
  for (let i = 0; i + 1 < us.length; i++) {
    const xa = x0 + us[i] * L;
    const xb = x0 + us[i + 1] * L;
    polys.push([xa, yBottom + archRise(kit, us[i]), xb, yBottom + archRise(kit, us[i + 1]), xb, yTop, xa, yTop]);
  }
  return polys;
}

/** Ledge (the lower slab of a passage): the top drops away at both ends; strips from the slab's foot up to there. */
export function ledgePolys(kit, x0, x1, yBottom, yTop) {
  const L = x1 - x0;
  const us = slabSamples();
  const polys = [];
  for (let i = 0; i + 1 < us.length; i++) {
    const xa = x0 + us[i] * L;
    const xb = x0 + us[i + 1] * L;
    polys.push([xa, yBottom, xb, yBottom, xb, yTop - ledgeDrop(kit, us[i + 1]), xa, yTop - ledgeDrop(kit, us[i])]);
  }
  return polys;
}

/** Furthest a set of polygons reaches sideways from `cx` (the broad-phase half length). */
export function polysExtent(polys, cx) {
  let m = 0;
  for (const p of polys) for (let i = 0; i < 8; i += 2) m = Math.max(m, Math.abs(p[i] - cx));
  return m;
}

/** A blade's outline rows as control points [d, left, right] (the same conversion controlPoints uses), without the extra far point. */
export const bladePoints = (def) => def.blade.map(([d, hw, c]) => [d, hw - c * LEAN, hw + c * LEAN]);
/** Where a blade's straight foot begins, in widths from the gap end. */
export const bladeFoot = (def) => def.blade[def.blade.length - 1][0];

/**
 * The pieces a pole is drawn from, for a pole shaped down to `dDraw` widths from its gap end: a head (cap, tip or underside), whole repeating segments of the stem (capped looks) or one
 * stretched straight foot (blades), each given by its part name and where it starts (`d0`, in widths). The renderer places instances from this list and the tests assemble the same
 * list, so what is tested is what is drawn. Segments end at or beyond `dDraw`: the excess lies underground or above the ceiling, out of reach of the bird.
 */
export function polePlacements(kit, look, dDraw) {
  const def = poleDef(kit, look);
  const out = [{ part: 'head', d0: 0 }];
  if (def.type === 'blade') {
    const foot = bladeFoot(def);
    if (dDraw > foot) out.push({ part: 'body', d0: foot, d1: dDraw });
    return out;
  }
  const { start, period } = def.tail;
  for (let d = start; d < dDraw - 1e-9; d += period) out.push({ part: 'segment', d0: d });
  return out;
}

/**
 * The name of a geometry piece: a capped look has `<look>Head` and `<look>Segment`; a blade `<look>HeadUp` / `<look>HeadDown` (by which way it points); every blade of a kit shares one
 * straight foot, `bladeBody` (a prism of constant width), which saves a draw call per extra blade.
 */
export const pieceKey = (kit, look, part, dir) => {
  const def = poleDef(kit, look);
  if (def.type === 'blade') return part === 'head' ? `${look}Head${dir > 0 ? 'Up' : 'Down'}` : 'bladeBody';
  return part === 'head' ? `${look}Head` : `${look}Segment`;
};

/**
 * The instances that draw one pole: for a pole of the given look at `gapEndY` with width w, shaped down to `dDraw` widths from its gap end, a list of
 * { key: '<kit>.<piece>', piece: the geometry's name in that kit's set, y: where its origin goes, sy: vertical scale, s: scale across (w) }. Built once when the pole spawns
 * (the renderer allocates nothing per frame) from the same placement list the tests assemble.
 */
export function poleInstances(kit, look, cap, gapEndY, w, dDraw) {
  const dir = cap > 0 ? 1 : -1;
  const yAt = (d) => gapEndY - dir * d * w;
  const def = poleDef(kit, look);
  return polePlacements(kit, look, dDraw).map(({ part, d0, d1 }) => {
    const piece = pieceKey(kit, look, part, dir);
    const key = `${kit}.${piece}`;
    if (def.type === 'blade' && part === 'body') return { key, piece, y: yAt((d0 + d1) / 2), sy: (d1 - d0) * w, s: w };
    return { key, piece, y: yAt(part === 'head' ? 0 : d0), sy: w, s: w };
  });
}

/** Every geometry piece a kit needs: its poles' pieces (only the directions the kit uses a look in), the passage's arch band, ledge band and slab block, and the boulder. */
export function kitPieces(kit) {
  const K = KITS[kit];
  const out = [];
  for (const [look, def] of Object.entries(K.poles)) {
    const dirs = [];
    if (K.rising.includes(look)) dirs.push(1);
    if (K.hanging.includes(look)) dirs.push(-1);
    if (def.type === 'capped') out.push({ key: `${look}Head`, look, part: 'head', dir: dirs[0] }, { key: `${look}Segment`, look, part: 'segment', dir: dirs[0] });
    else {
      for (const dir of dirs) out.push({ key: `${look}Head${dir > 0 ? 'Up' : 'Down'}`, look, part: 'head', dir });
      if (!out.some((o) => o.key === 'bladeBody')) out.push({ key: 'bladeBody', look, part: 'body', dir: 1 });
    }
  }
  out.push({ key: 'archBand' }, { key: 'ledgeBand' }, { key: 'slabBlock' }, { key: 'boulder' });
  return out;
}
