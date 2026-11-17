/**
 * Procedural background music (Web Audio): a slow, dark arpeggio over a
 * drifting pad, in A minor. No audio files needed; real tracks can replace
 * this behind the same setActive() API.
 *
 * A look-ahead scheduler queues notes slightly ahead of time, so the loop
 * stays in time even when the main thread hitches.
 */
import { getAudio } from './sfx.js';

const BPM = 84;
const STEP = 60 / BPM / 2; // eighth notes
const LOOKAHEAD = 0.35; // seconds scheduled ahead
const TICK_MS = 100;
const LEVEL = 0.5;
const FADE = 0.8;

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
// Am - F - C - G, as [bass, arpeggio notes...]
const CHORDS = [
  [45, 57, 60, 64, 67],
  [41, 53, 57, 60, 65],
  [48, 60, 64, 67, 72],
  [43, 55, 59, 62, 67],
];
const PATTERN = [1, 2, 3, 4, 3, 2, 3, 2]; // indices into the chord's arpeggio notes

let bus = null;
let timer = null;
let nextTime = 0;
let stepIndex = 0;
let active = false;

function ensureBus(a) {
  if (bus && bus.ctx === a.ctx) return bus;
  const out = a.ctx.createGain();
  out.gain.value = 0.0001;
  const lp = a.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  lp.connect(out).connect(a.master);
  bus = { ctx: a.ctx, out, lp };
  return bus;
}

function note(freq, t, dur, type, peak) {
  const { ctx, lp } = bus;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(lp);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function scheduleStep(index, t) {
  const bar = Math.floor(index / PATTERN.length) % CHORDS.length;
  const chord = CHORDS[bar];
  const pos = index % PATTERN.length;
  note(midi(chord[PATTERN[pos]] + 12), t, STEP * 1.8, 'triangle', 0.1);
  if (pos === 0) {
    note(midi(chord[0] - 12), t, STEP * PATTERN.length * 0.95, 'sine', 0.22);
    note(midi(chord[1]), t, STEP * PATTERN.length, 'sawtooth', 0.025);
  }
}

function tick() {
  if (!bus) return;
  const now = bus.ctx.currentTime;
  if (nextTime < now) nextTime = now + 0.05; // fell behind (tab was throttled): resync
  while (nextTime < now + LOOKAHEAD) {
    scheduleStep(stepIndex++, nextTime);
    nextTime += STEP;
  }
}

function fadeTo(level) {
  const { ctx, out } = bus;
  const t = ctx.currentTime;
  out.gain.cancelScheduledValues(t);
  out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), t);
  out.gain.exponentialRampToValueAtTime(Math.max(level, 0.0001), t + FADE);
}

/** Fades the music in or out. Safe to call repeatedly; no-op until audio is unlocked. */
export function setMusicActive(on) {
  const a = getAudio();
  if (!a) return;
  if (on === active) return;
  active = on;
  ensureBus(a);
  if (on) {
    if (!timer) {
      nextTime = a.ctx.currentTime + 0.1;
      stepIndex = 0;
      timer = setInterval(tick, TICK_MS);
      tick();
    }
    fadeTo(LEVEL);
  } else {
    fadeTo(0);
    const stopper = setTimeout(
      () => {
        if (!active && timer) {
          clearInterval(timer);
          timer = null;
        }
      },
      FADE * 1000 + 100,
    );
    stopper.unref?.();
  }
}
