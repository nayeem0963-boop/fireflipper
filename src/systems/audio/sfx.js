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
  orb(streak = 1) {
    if (!ready()) return;
    // Pitch climbs a semitone per orb in a streak (capped at an octave).
    const k = Math.pow(2, Math.min(Math.max(streak - 1, 0), 12) / 12);
    tone({ type: 'triangle', from: 880 * k, to: 1760 * k, duration: 0.16, peak: 0.16 });
    tone({ type: 'sine', from: 1320 * k, to: 2640 * k, duration: 0.2, peak: 0.08, delay: 0.05 });
  },
  near() {
    if (!ready()) return;
    noiseBurst({ duration: 0.14, filter: 'highpass', from: 2400, to: 5200, q: 0.8, peak: 0.12 });
  },
  /** Soft rising tick while the result score counts up. */
  tick(progress = 0) {
    if (!ready()) return;
    tone({ type: 'sine', from: 500 + progress * 700, to: 560 + progress * 800, duration: 0.04, peak: 0.05 });
  },
  /** Score finished counting. */
  result() {
    if (!ready()) return;
    tone({ type: 'triangle', from: 392, to: 392, duration: 0.18, peak: 0.12 });
    tone({ type: 'triangle', from: 587, to: 587, duration: 0.3, peak: 0.12, delay: 0.1 });
  },
  /** Personal-best fanfare: a rising arpeggio with a sparkle on top. */
  record() {
    if (!ready()) return;
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', from: f, to: f, duration: 0.28, peak: 0.16, delay: i * 0.09 }));
    tone({ type: 'sine', from: 2093, to: 3136, duration: 0.6, peak: 0.07, delay: 0.36 });
  },
  /** A world completed: a short, soft rising chime (two notes and a sparkle), kept quiet so it never competes with flying. */
  milestone() {
    if (!ready()) return;
    [659, 988].forEach((f, i) => tone({ type: 'sine', from: f, to: f, duration: 0.34, peak: 0.1, delay: i * 0.11 }));
    tone({ type: 'sine', from: 1976, to: 2637, duration: 0.5, peak: 0.04, delay: 0.2 });
  },
  /** The finish line: a warm rising arpeggio that opens into a held chord and a long sparkle. */
  journey() {
    if (!ready()) return;
    [392, 523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', from: f, to: f, duration: 0.5, peak: 0.13, delay: i * 0.16 }));
    [523, 659, 784, 1047].forEach((f) => tone({ type: 'sine', from: f, to: f, duration: 1.8, peak: 0.07, delay: 0.9 }));
    tone({ type: 'sine', from: 2093, to: 3136, duration: 1.2, peak: 0.05, delay: 1.0 });
  },
  /** A power-up picked up: the magnet a rising hum with a snap, the shield a bright two-note chime. */
  powerup(kind) {
    if (!ready()) return;
    if (kind === 'magnet') {
      tone({ type: 'sawtooth', from: 220, to: 660, duration: 0.28, peak: 0.07 });
      tone({ type: 'triangle', from: 880, to: 1320, duration: 0.22, peak: 0.12, delay: 0.16 });
    } else {
      [784, 1175].forEach((f, i) => tone({ type: 'triangle', from: f, to: f, duration: 0.3, peak: 0.13, delay: i * 0.1 }));
      tone({ type: 'sine', from: 2349, to: 3136, duration: 0.5, peak: 0.05, delay: 0.18 });
    }
  },
  /** The shield took a crash: a glassy crack and a falling tone. */
  shieldBreak() {
    if (!ready()) return;
    noiseBurst({ duration: 0.3, filter: 'highpass', from: 3000, to: 900, q: 0.9, peak: 0.25 });
    tone({ type: 'triangle', from: 880, to: 220, duration: 0.4, peak: 0.14 });
  },
  crash() {
    if (!ready()) return;
    noiseBurst({ duration: 0.55, filter: 'lowpass', from: 1800, to: 120, q: 0.7, peak: 0.55 });
    tone({ from: 140, to: 38, duration: 0.45, peak: 0.45 });
  },
};
