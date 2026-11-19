import { PHYSICS } from '../physics/constants.js';
import { KIT_STARTS, hash01 } from '../obstacles/rockShapes.js';
import { speedAt } from '../physics/speed.js';

/**
 * Biome hazards: pure functions of the RUN DISTANCE (metres), shared by the simulation, the Auto play bot, the renderer's telegraphs and the tests.
 *
 * Why distance and not time: the bird's x equals the distance and the speed depends only on the distance, so the two are interchangeable, and a distance
 * is frame-rate independent, frozen by pause, reset by a retry, and predictable by the bot's look-ahead. Nothing here reads a clock or draws a random number
 * (windows come from position hashes), so generated tracks are unchanged and there is no per-stage state to reset when the run changes stage.
 *
 * Two kinds of hazard:
 *  - BIRD modifiers (`hazardsAt`): updrafts, crosswind gusts (vertical: perpendicular to the flight direction), low-gravity pockets and the frosty slide. They
 *    change gravity, add a vertical acceleration, or change the flap carry and dive recovery that `flight.js` uses, and only act in the OPEN RUNWAY between
 *    obstacle sections, so the spawner's guaranteed corridors are untouched.
 *  - OBSTACLE states (`obstacleHazard`): brittle canyon caps, phase barriers, pistons and bobbing platforms. Every offset points AWAY from the obstacle's corridor,
 *    so the guaranteed gap never shrinks; a phase barrier is only ever the original obstacle or passable.
 *
 * Fair play: every hazard is telegraphed LEAD_S seconds before it acts (0.5 to 0.8 s), and fades in over ZONE_RAMP metres at the start of its zone and out over the last ZONE_RAMP metres.
 */

/** Master switch. On by default (every hazard is telegraphed); the `?hazards=0` flag turns it off for comparison or rollback. It is read once at load. */
export const HAZARDS = { enabled: true };

export const LEAD_S = 0.65;
export const ZONE_RAMP = 40;
/** No hazard acts on the opening runway. */
export const HAZARD_FREE_START = 40;
/** The open runway kept free before a section (m, on top of the telegraph lead): the bird settles into the corridor. */
const SETTLE = 2.5;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The hazard rules of each zone (ids as in rockShapes.KIT_STARTS: canyon, frosty, celestial, palace, sanctuary).
 * `every` / `len`: one window of `len` metres per slot of `every` metres, placed by a position hash.
 */
export const BIOME_HAZARDS = Object.freeze({
  canyon: { updraft: { every: 140, len: 14, accel: 20 }, brittle: { dropAhead: 6, capH: 0.7 } },
  frosty: { gust: { every: 120, len: 10, accel: 9 }, slide: { flapCarry: 0.45, diveRecovery: 18 } },
  celestial: { phase: { period: 36, solid: 0.55 } },
  palace: { piston: { period: 48, amp: 1.1 } },
  sanctuary: { lowG: { every: 160, len: 18, gravity: 0.55 }, bob: { amp: 0.12, period: 40 } },
});

/** The [id, start] of the zone a distance is in. */
export function zoneAt(d) {
  return KIT_STARTS[zoneIndex(d)];
}
function zoneIndex(d) {
  let z = 0;
  for (let i = 1; i < KIT_STARTS.length; i++) if (d >= KIT_STARTS[i][1]) z = i;
  return z;
}
const zoneEnd = (i) => (i + 1 < KIT_STARTS.length ? KIT_STARTS[i + 1][1] : Infinity);

/** The bird-modifier rule of a zone (updraft, gust or lowG), or null. */
const windowRule = (H) => H.updraft ?? H.gust ?? H.lowG ?? null;
export const windowKind = (H) => (H.updraft ? 'updraft' : H.gust ? 'gust' : H.lowG ? 'lowG' : '');

/**
 * Window `n` of a rule: telegraphed over [s - lead, s), acting over [s, s + len). The telegraph always lies inside its own slot, so slots never overlap.
 * `lead` is the telegraph's length in metres (LEAD_S seconds at the slot's speed).
 */
export function windowStart(rule, n) {
  const lead = speedAt(n * rule.every) * LEAD_S;
  return { s: n * rule.every + lead + (rule.every - rule.len - lead) * hash01(n * 13.7 + 5), lead };
}

/**
 * Calls `fn(kind, s, len, lead, dir)` for every window that touches [d0, d1] (for the renderer's telegraphs: it draws them from far ahead). A window belongs to the zone of its
 * slot, and only slots that lie entirely inside their zone have one, so a window never straddles a zone border: its telegraph, its force and its end are all in one zone.
 */
export function windowsIn(d0, d1, fn) {
  for (let zi = zoneIndex(Math.max(d0, 0)); zi < KIT_STARTS.length; zi++) {
    const [zone, start] = KIT_STARTS[zi];
    if (start > d1) break;
    const H = BIOME_HAZARDS[zone];
    const rule = H && windowRule(H);
    if (!rule) continue;
    const end = zoneEnd(zi);
    for (let n = Math.max(Math.ceil(start / rule.every), Math.floor(d0 / rule.every) - 1); n * rule.every <= d1 && (n + 1) * rule.every <= end; n++) {
      const { s, lead } = windowStart(rule, n);
      if (s + rule.len < d0 || s - lead > d1) continue;
      fn(windowKind(H), s, rule.len, lead, H.gust && hash01(n * 7.1 + 9) < 0.5 ? -1 : 1);
    }
  }
}

/**
 * The first track position at or after `x` where a section of up to `maxLen` metres can start without touching a hazard window's reserved band. A band is the window with its telegraph and the
 * settling room around it (the same margins `hazardsAt` keeps free), so with the spawner using this the windows act in open space. Pure and deterministic.
 */
export function runwayAfter(x, maxLen) {
  if (!HAZARDS.enabled) return x;
  let moved = true;
  while (moved) {
    moved = false;
    windowsIn(x - 80, x + maxLen + 80, (kind, s, len, lead) => {
      const from = s - lead - 1;
      const to = s + len + lead + SETTLE;
      if (x < to && x + maxLen > from) {
        x = to;
        moved = true;
      }
    });
  }
  return x;
}

/** The bird modifiers of a bird at distance `d`: gravity and flap strength scales, a vertical acceleration, the flap carry and the dive recovery. */
export function createHazardFx() {
  return { gravityScale: 1, flapScale: 1, accelY: 0, flapCarry: PHYSICS.flapCarry, diveRecovery: PHYSICS.diveRecovery, kind: '', tele: 0, active: false, dir: 0 };
}
function neutral(fx) {
  fx.gravityScale = 1;
  fx.flapScale = 1;
  fx.accelY = 0;
  fx.flapCarry = PHYSICS.flapCarry;
  fx.diveRecovery = PHYSICS.diveRecovery;
  fx.kind = '';
  fx.tele = 0;
  fx.active = false;
  fx.dir = 0;
  return fx;
}

/** Computes the bird modifiers at distance `d` into `fx` (reused, so nothing is allocated). `corridors` is the track's list of sections ({ x0, x1 }). */
export function hazardsAt(d, fx, corridors) {
  neutral(fx);
  if (!HAZARDS.enabled || d < HAZARD_FREE_START) return fx;
  const zi = zoneIndex(d);
  const [zone, start] = KIT_STARTS[zi];
  const end = zoneEnd(zi);
  const H = BIOME_HAZARDS[zone];
  if (!H) return fx;
  // a zone's hazards fade in over ZONE_RAMP metres and fade out over the last ZONE_RAMP metres: no force pops at a border
  const k = (start === 0 ? 1 : smooth(start, start + ZONE_RAMP, d)) * (end === Infinity ? 1 : 1 - smooth(end - ZONE_RAMP, end, d));
  if (H.slide) {
    fx.flapCarry += (H.slide.flapCarry - fx.flapCarry) * k;
    fx.diveRecovery += (H.slide.diveRecovery - fx.diveRecovery) * k;
  }
  const rule = windowRule(H);
  if (!rule) return fx;
  const n = Math.floor(d / rule.every);
  if (n * rule.every < start || (n + 1) * rule.every > end) return fx; // only slots entirely inside the zone have a window
  const { s, lead } = windowStart(rule, n);
  if (d < s - lead || d >= s + rule.len) return fx;
  // keep the open runway free: no window shows or acts near a section
  for (let i = 0; i < corridors.length; i++) {
    const c = corridors[i];
    if (d > c.x0 - lead - SETTLE && d < c.x1 + 1) return fx;
  }
  fx.kind = windowKind(H);
  fx.active = d >= s;
  fx.tele = fx.active ? 1 : (d - (s - lead)) / lead;
  fx.dir = H.gust && hash01(n * 7.1 + 9) < 0.5 ? -1 : 1;
  if (fx.active) {
    if (H.updraft) fx.accelY = H.updraft.accel * k;
    if (H.gust) fx.accelY = fx.dir * H.gust.accel * k;
    if (H.lowG) {
      fx.gravityScale = 1 + (H.lowG.gravity - 1) * k;
      fx.flapScale = 0.6 + 0.4 * fx.gravityScale; // a flap keeps its feel in low gravity
    }
  }
  return fx;
}

/** Moving and phasing obstacles forgive a little: they are tested with a bird radius 15% smaller (about 0.054), so their hitboxes act as 85% of what is drawn. Static shapes keep exact silhouettes. */
export const DYNAMIC_INSET = 0.15 * PHYSICS.birdRadius;

/** Scratch state for one obstacle: out-parameter of `obstacleHazard`. */
export const createObstacleFx = () => ({ solid: true, dy: 0, pulse: 0, rumble: 0, dyn: false });

/**
 * The dynamic state of obstacle `o` ({ x, kind, cap }) when the bird is at distance `d`: whether it is solid, how far it has moved (`dy`, always away from its corridor),
 * a warning `pulse` (0 to 1: a phase barrier about to turn solid, a piston about to return) and a `rumble` (0 to 1: a brittle cap about to drop). Pure and allocation-free.
 */
export function obstacleHazard(o, d, out) {
  out.solid = true;
  out.dy = 0;
  out.pulse = 0;
  out.rumble = 0;
  out.dyn = false;
  if (!HAZARDS.enabled) return out;
  const H = BIOME_HAZARDS[zoneAt(o.x)[0]];
  if (!H) return out;
  const lead = speedAt(d) * LEAD_S;
  const away = o.cap > 0 ? -1 : 1; // rising poles retract down, hanging ones up
  if (H.brittle && o.kind === 'column' && o.cap > 0 && hash01(o.x * 3.3) < 0.5) {
    out.dyn = true;
    const at = o.x - H.brittle.dropAhead; // the cap lets go when the bird is this far before the pole
    if (d >= at - lead && d < at) out.rumble = (d - (at - lead)) / lead;
    else if (d >= at) {
      const t = (d - at) / speedAt(d); // seconds since it let go
      out.dy = -Math.min(H.brittle.capH, 0.5 * 22 * t * t); // sinks away from the corridor
    }
  }
  if (H.phase && o.kind !== 'rock' && hash01(o.x * 5.5) < 0.4) {
    out.dyn = true;
    const ul = lead / H.phase.period;
    const u = (((d + o.x * 0.37) / H.phase.period) % 1 + 1) % 1;
    out.solid = u < H.phase.solid;
    out.pulse = u >= 1 - ul ? (u - (1 - ul)) / ul : 0; // warns before it turns solid again
  }
  if (H.piston && o.kind === 'column' && hash01(o.x * 2.2) < 0.5) {
    out.dyn = true;
    const ph = (d + o.x * 0.21) / H.piston.period;
    out.dy = away * H.piston.amp * 0.5 * (1 - Math.cos(2 * Math.PI * ph));
    const f = ((ph % 1) + 1) % 1;
    out.pulse = f >= 0.5 - lead / H.piston.period && f < 0.5 ? 1 : 0; // the rail glows before the piston comes back
  }
  if (H.bob && o.kind === 'block') out.dyn = true;
  if (H.bob && o.kind === 'block') out.dy = away * H.bob.amp * (0.5 + 0.5 * Math.sin((2 * Math.PI * d) / H.bob.period + o.x));
  return out;
}
