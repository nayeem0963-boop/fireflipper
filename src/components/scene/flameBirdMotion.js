/**
 * FlameBird's motion layer, kept free of three.js so it can be tested in Node (scripts/flamebird-motion-test.mjs).
 *
 * Why it exists: setting a clip's time directly makes the wings jump whenever a flap arrives mid-beat. Here every
 * change is eased instead:
 *  - the cruise beat (FB_Fly) never jumps: its speed glides toward the target (slower in a dive, still after a crash);
 *  - each flap plays FB_WingFlap's powered downstroke in one of two slots, A and B, cross-faded in over FADE_IN, so a
 *    rapid second tap starts a fresh stroke in the other slot while the first one fades out (no pop);
 *  - while a stroke is showing, the cruise clip is moved to the same phase, so fading back to it is seamless;
 *  - follow-through: damped springs for the head (it counters part of the body's pitch, so the face stays readable),
 *    the crest and the tail (they trail with speed, and each flap kicks them so they bounce and settle).
 *
 *  - face: blinks (with an occasional double blink; eyes half shut after a crash) and the beak (a spring: each flap
 *    pops it open, in menus the bird chirps now and then, and it hangs open after a crash), returned as 0..1 values
 *    that FlameBird.jsx feeds to its material (the lids and the jaw are drawn by the bird's own shader).
 *
 * Both clips are 0.8 s loops with the top of the upstroke at 0.2 s and the end of the downstroke at 0.6 s. Their wing
 * raise (Phase 4 of the rig) is FB_Fly 20 + 20 sin and FB_WingFlap 12.5 + 27.5 sin (degrees, sin of 2 pi t / 0.8); a new
 * stroke starts at the point of its upstroke whose raise matches the wing's current raise, so the cross-fade has
 * nothing to jump across, then rises quickly over the top and comes down in STROKE_TIME.
 */

export const STROKE_TIME = 0.26; // seconds for one powered wing stroke (the same as every other bird)
export const CLIP_LEN = 0.8;
export const TOP = 0.2;
export const BOTTOM = 0.6;
const LATEST_START = 0.16; // a stroke always rolls over the top, even when the wing is already up
const RISE_RATE = 2.2; // clip seconds per second while a stroke lifts the wing to the top
const DOWN_RATE = (BOTTOM - TOP) / STROKE_TIME; // clip seconds per second for the powered downstroke
const FLY_RAISE = (t) => 20 + 20 * Math.sin((2 * Math.PI * t) / CLIP_LEN);
const FLAP_RAISE = (t) => 12.5 + 27.5 * Math.sin((2 * Math.PI * t) / CLIP_LEN);
const wrap = (u) => ((u % CLIP_LEN) + CLIP_LEN) % CLIP_LEN;
const FADE_IN = 0.07;
const FADE_OUT = 0.22;
const SPEED_TAU = 0.18; // seconds for the cruise beat to reach a new speed
const CLIP_RATE = (2 * Math.PI) / CLIP_LEN; // radians of wing beat per second of clip

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const approach = (cur, target, dt, tau) => cur + (target - cur) * (1 - Math.exp(-dt / tau));

/** A damped spring (x follows `target`); `zeta` < 1 overshoots a little, which reads as follow-through. */
export function createSpring(omega, zeta) {
  return { x: 0, v: 0, omega, zeta };
}

export function stepSpring(s, target, dt) {
  // two sub-steps of semi-implicit Euler: stable for the clamped frame times used here
  const h = dt / 2;
  for (let i = 0; i < 2; i++) {
    const a = -s.omega * s.omega * (s.x - target) - 2 * s.zeta * s.omega * s.v;
    s.v += a * h;
    s.x += s.v * h;
  }
  return s.x;
}

const BLINK_TIME = 0.17;

export function createMotion(rng = Math.random) {
  return {
    rng,
    blinkNext: 1.2 + rng() * 2,
    blinkT: -1,
    closed: 0,
    chirpNext: 1.5 + rng() * 2.5,
    chirpT: -1,
    popT: -1,
    beak: createSpring(22, 0.55),
    flyTime: TOP,
    flySpeed: 1,
    slots: [
      { u: 0, weight: 0, active: false }, // u: stroke time, unwrapped (negative = still on the way up to the top)
      { u: 0, weight: 0, active: false },
    ],
    wing: FLY_RAISE(TOP), // the wing raise shown last frame (degrees)
    current: -1, // index of the slot playing the latest stroke
    lastSinceFlap: Infinity,
    head: createSpring(9, 0.85),
    crest: createSpring(11, 0.4),
    tail: createSpring(7, 0.5),
    fan: createSpring(6, 0.38),
  };
}

/**
 * Advance one frame. `flight` is the simulation's bird ({ vy, pitch, sinceFlap, dead }) or null in menus.
 * Returns the clip times and weights to apply, and the extra bone angles (radians, about the model's lateral axis
 * unless noted): head (pitch), crest (pitch), tail (pitch), fan (pitch) and fanSway (about the vertical axis).
 */
export function stepMotion(m, flight, dt, wingSpeed, t) {
  const dead = !!flight?.dead;
  const vy = flight?.vy ?? 0;

  // a new flap: sinceFlap went back to (near) zero
  const since = flight ? flight.sinceFlap : Infinity;
  const newFlap = !dead && since < STROKE_TIME && since < m.lastSinceFlap;
  m.lastSinceFlap = since;
  if (newFlap) {
    const prev = m.slots[m.current];
    // a tap during the first half of a stroke just continues it; later taps start a fresh stroke in the other slot
    const reuse = prev && prev.active && prev.u < (TOP + BOTTOM) / 2;
    if (!reuse) {
      m.current = m.current === 0 ? 1 : 0;
      const s = m.slots[m.current];
      // the point on the stroke's upstroke whose raise matches the wing's raise now
      const k = clamp((m.wing - 12.5) / 27.5, -1, 1);
      s.u = Math.min(LATEST_START, (Math.asin(k) * CLIP_LEN) / (2 * Math.PI));
      s.active = true;
    }
    m.crest.v += 2.6; // the crest flicks forward, then settles back
    m.tail.v -= 2.2; // the tail dips with the push
    m.fan.v += 2.4;
  }

  // strokes: advance, fade in while active, fade out once past the bottom
  for (let i = 0; i < 2; i++) {
    const s = m.slots[i];
    if (s.weight <= 0 && !s.active) continue;
    s.u = Math.min(s.u + dt * (s.u < TOP ? RISE_RATE : DOWN_RATE), CLIP_LEN - 1e-3);
    if (s.active && (s.u >= BOTTOM + 0.03 || dead || i !== m.current)) s.active = false;
    const target = s.active ? 1 : 0;
    s.weight = approach(s.weight, target, dt, s.active ? FADE_IN / 3 : FADE_OUT / 3);
    if (!s.active && s.weight < 1e-3) s.weight = 0;
  }

  // cruise beat: speed eases toward its target; while a stroke shows, follow its phase so the hand-back is seamless
  const tuck = flight && !dead ? clamp((-vy - 5) / 7, 0, 1) : 0; // diving: slower beats
  const baseRate = wingSpeed / CLIP_RATE;
  const targetSpeed = dead ? 0 : baseRate * (1 - tuck * 0.6);
  m.flySpeed = approach(m.flySpeed, targetSpeed, dt, SPEED_TAU);
  const lead = m.current >= 0 ? m.slots[m.current] : null;
  if (lead && lead.weight > 0.97) m.flyTime = wrap(lead.u); // only once the cruise wings are fully hidden
  else m.flyTime = (m.flyTime + dt * m.flySpeed) % CLIP_LEN;

  let flapW = m.slots[0].weight + m.slots[1].weight;
  const scale = flapW > 1 ? 1 / flapW : 1;
  flapW = Math.min(1, flapW);

  // follow-through springs
  const pitch = flight ? (flight.pitch ?? 0) : 0;
  const head = stepSpring(m.head, dead ? 0 : clamp(0.45 * pitch, -0.35, 0.35), dt); // counter part of the body's pitch so the face stays readable
  const crest = stepSpring(m.crest, -(0.05 + Math.min(0.12, 0.012 * Math.abs(vy))) + (dead ? 0.2 : 0), dt);
  const tail = stepSpring(m.tail, clamp(-0.022 * vy, -0.18, 0.24), dt);
  const fan = stepSpring(m.fan, clamp(-0.015 * vy, -0.12, 0.18), dt);

  const strokes = m.slots.map((s) => ({ time: wrap(s.u), weight: s.weight * scale }));
  m.wing = (1 - flapW) * FLY_RAISE(m.flyTime) + strokes.reduce((a, s) => a + s.weight * FLAP_RAISE(s.time), 0);

  // blinks: a quick close and open every few seconds (sometimes two in a row); half shut after a crash
  m.blinkNext -= dt;
  if (m.blinkT < 0 && m.blinkNext <= 0) m.blinkT = 0;
  let blink = 0;
  if (m.blinkT >= 0) {
    m.blinkT += dt / BLINK_TIME;
    if (m.blinkT >= 1) {
      m.blinkT = -1;
      m.blinkNext = m.rng() < 0.2 ? 0.12 : 2.2 + m.rng() * 3.3;
    } else blink = Math.sin(m.blinkT * Math.PI);
  }
  m.closed = approach(m.closed, dead ? 0.8 : 0, dt, 0.08);

  // beak: chirps in menus ("chirp-chirp": two quick openings), a pop on each flap, hanging open after a crash
  if (!flight) {
    m.chirpNext -= dt;
    if (m.chirpT < 0 && m.chirpNext <= 0) m.chirpT = 0;
  }
  let chirp = 0;
  if (m.chirpT >= 0) {
    m.chirpT += dt;
    const c = m.chirpT;
    if (c < 0.13) chirp = Math.sin((Math.PI * c) / 0.13);
    else if (c > 0.19 && c < 0.32) chirp = 0.8 * Math.sin((Math.PI * (c - 0.19)) / 0.13);
    else if (c >= 0.32) {
      m.chirpT = -1;
      m.chirpNext = 2.5 + m.rng() * 3;
    }
  }
  if (newFlap) m.popT = 0; // a small 'puff' on each flap
  let pop = 0;
  if (m.popT >= 0) {
    m.popT += dt;
    if (m.popT < 0.2) pop = 0.6 * Math.sin((Math.PI * m.popT) / 0.2);
    else m.popT = -1;
  }
  const beak = clamp(stepSpring(m.beak, dead ? 0.6 : Math.max(chirp, pop), dt), 0, 1);

  return {
    eyes: clamp(Math.max(blink, m.closed), 0, 1),
    beak,
    flyTime: m.flyTime,
    flyWeight: 1 - flapW,
    strokes,
    bones: {
      head: clamp(head, -0.45, 0.45),
      crest: clamp(crest, -0.5, 0.5),
      tail: clamp(tail, -0.35, 0.35),
      fan: clamp(fan, -0.35, 0.35),
      fanSway: 0.05 * Math.sin(t * 1.3) + 0.03 * Math.sin(t * 2.9 + 1),
    },
    beat: Math.sin(((m.flyTime - TOP) / CLIP_LEN) * 2 * Math.PI + Math.PI / 2),
  };
}
