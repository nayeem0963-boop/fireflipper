/**
 * Tiny synthesized sound effects (Web Audio). No audio files are needed,
 * and real recorded sounds can replace these later behind the same API.
 *
 * Browsers only allow audio after a user gesture, so call unlockAudio()
 * from an input handler (Play button, first flap).
 */
let ctx = null;
let master = null;
let noiseBuffer = null;

function context() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.45;
  master.connect(ctx.destination);
  const len = Math.floor(ctx.sampleRate * 0.6);
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

export function unlockAudio() {
  const c = context();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

function envelope(gainNode, t, peak, attack, release) {
  gainNode.gain.setValueAtTime(0.0001, t);
  gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
}

function noiseBurst({ duration, filter, from, to, q = 1, peak }) {
  const c = ctx;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const f = c.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + duration);
  const g = c.createGain();
  envelope(g, t, peak, 0.01, duration);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + duration + 0.05);
}

function tone({ type = 'sine', from, to, duration, peak, delay = 0 }) {
  const c = ctx;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + duration);
  const g = c.createGain();
  envelope(g, t, peak, 0.008, duration);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

/** Shared audio graph for other audio modules (music). Null until the first user gesture. */
export function getAudio() {
  return ctx && master ? { ctx, master } : null;
}

const ready = () => ctx && ctx.state === 'running';

export const sfx = {
  flap() {
    if (!ready()) return;
    noiseBurst({ duration: 0.12, filter: 'bandpass', from: 1300, to: 450, q: 0.9, peak: 0.22 });
  },
  orb() {
    if (!ready()) return;
    tone({ type: 'triangle', from: 880, to: 1760, duration: 0.16, peak: 0.16 });
    tone({ type: 'sine', from: 1320, to: 2640, duration: 0.2, peak: 0.08, delay: 0.05 });
  },
  nearMiss(streak = 1) {
    if (!ready()) return;
    // A rising whoosh plus a bright ping that climbs with the streak.
    noiseBurst({ duration: 0.22, filter: 'bandpass', from: 600, to: 2600, q: 1.4, peak: 0.2 });
    const base = 660 * Math.pow(1.122, Math.min(streak, 6) - 1);
    tone({ type: 'sine', from: base, to: base * 1.5, duration: 0.22, peak: 0.14, delay: 0.04 });
  },
  powerup() {
    if (!ready()) return;
    tone({ type: 'triangle', from: 520, to: 1040, duration: 0.18, peak: 0.16 });
    tone({ type: 'triangle', from: 780, to: 1560, duration: 0.22, peak: 0.12, delay: 0.09 });
  },
  shieldBreak() {
    if (!ready()) return;
    noiseBurst({ duration: 0.3, filter: 'highpass', from: 1500, to: 5000, q: 0.8, peak: 0.3 });
    tone({ type: 'sine', from: 900, to: 220, duration: 0.3, peak: 0.2 });
  },
  start() {
    if (!ready()) return;
    tone({ type: 'triangle', from: 330, to: 660, duration: 0.3, peak: 0.12 });
  },
  crash() {
    if (!ready()) return;
    noiseBurst({ duration: 0.55, filter: 'lowpass', from: 1800, to: 120, q: 0.7, peak: 0.55 });
    tone({ from: 140, to: 38, duration: 0.45, peak: 0.45 });
  },
};
