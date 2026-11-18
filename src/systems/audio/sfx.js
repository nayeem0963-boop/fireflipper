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
  /** Rare gem: a quick rising sparkle. */
  gem() {
    if (!ready()) return;
    tone({ type: 'sine', from: 1320, to: 1980, duration: 0.14, peak: 0.13 });
    tone({ type: 'sine', from: 1760, to: 2640, duration: 0.16, peak: 0.11, delay: 0.07 });
    tone({ type: 'triangle', from: 2640, to: 3520, duration: 0.22, peak: 0.08, delay: 0.14 });
  },
  /** Through a fire ring: warm whoosh and a bright chime. */
  ring() {
    if (!ready()) return;
    noiseBurst({ duration: 0.3, filter: 'bandpass', from: 700, to: 2200, q: 1.1, peak: 0.16 });
    tone({ type: 'triangle', from: 660, to: 990, duration: 0.22, peak: 0.14, delay: 0.04 });
    tone({ type: 'sine', from: 990, to: 1480, duration: 0.28, peak: 0.1, delay: 0.1 });
  },
  /** A boulder hitting the lava. */
  landing() {
    if (!ready()) return;
    noiseBurst({ duration: 0.35, filter: 'lowpass', from: 900, to: 90, q: 0.8, peak: 0.28 });
    tone({ from: 90, to: 40, duration: 0.3, peak: 0.25 });
  },
  /** Air rushing past a rock. `tight` is 0..1: the closer the shave, the brighter and louder. */
  nearMiss(tight = 0.5) {
    if (!ready()) return;
    noiseBurst({ duration: 0.26, filter: 'bandpass', from: 2600 + tight * 1800, to: 900, q: 1.4, peak: 0.1 + tight * 0.1 });
    tone({ type: 'sine', from: 1900 + tight * 500, to: 1100, duration: 0.14, peak: 0.035 + tight * 0.03 });
  },
  /** Rock impact: a sharp crack over a low thump. Lava: a long sizzling hiss and a dull plunge. */
  crash(cause = 'obstacle') {
    if (!ready()) return;
    if (cause === 'lava') {
      noiseBurst({ duration: 0.9, filter: 'highpass', from: 2400, to: 5200, q: 0.6, peak: 0.28 });
      noiseBurst({ duration: 0.5, filter: 'lowpass', from: 900, to: 90, q: 0.7, peak: 0.45 });
      tone({ from: 110, to: 34, duration: 0.5, peak: 0.4 });
      return;
    }
    noiseBurst({ duration: 0.07, filter: 'highpass', from: 2200, to: 1500, q: 0.8, peak: 0.4 });
    noiseBurst({ duration: 0.55, filter: 'lowpass', from: 1800, to: 120, q: 0.7, peak: 0.55 });
    tone({ from: 140, to: 38, duration: 0.45, peak: 0.45 });
  },
};
