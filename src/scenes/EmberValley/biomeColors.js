import { Color } from 'three';

/**
 * Colour sets for the two biomes and a cached blend between them.
 * getBiome(k) returns a shared object that is only recomputed when the
 * blend factor changes, so several components can call it every frame.
 */
const SETS = {
  ember: {
    fog: '#120806',
    ambient: '#ffb27a',
    hemiSky: '#ff9a4a',
    hemiGround: '#0a0503',
    key: '#ffd8b0',
    peaks: ['#1d0c07', '#2a1009', '#3a160b'],
    peakEmissive: '#3a1206',
    groundGlow: '#ff6a1a',
  },
  obsidian: {
    fog: '#070a18',
    ambient: '#8aa0ff',
    hemiSky: '#5a7aff',
    hemiGround: '#03040a',
    key: '#c4d2ff',
    peaks: ['#0a1020', '#111a35', '#1a2750'],
    peakEmissive: '#0a1c4a',
    groundGlow: '#3a6cff',
  },
};

const toColors = (set) => ({
  fog: new Color(set.fog),
  ambient: new Color(set.ambient),
  hemiSky: new Color(set.hemiSky),
  hemiGround: new Color(set.hemiGround),
  key: new Color(set.key),
  peaks: set.peaks.map((c) => new Color(c)),
  peakEmissive: new Color(set.peakEmissive),
  groundGlow: new Color(set.groundGlow),
});

const A = toColors(SETS.ember);
const B = toColors(SETS.obsidian);
const out = toColors(SETS.ember);
let lastK = -1;

export function getBiome(k) {
  if (k === lastK) return out;
  lastK = k;
  for (const name of ['fog', 'ambient', 'hemiSky', 'hemiGround', 'key', 'peakEmissive', 'groundGlow']) {
    out[name].copy(A[name]).lerp(B[name], k);
  }
  out.peaks.forEach((c, i) => c.copy(A.peaks[i]).lerp(B.peaks[i], k));
  return out;
}

/** Sky gradient stops for each biome (top to horizon). */
export const SKY_STOPS = {
  ember: ['#0b0907', '#1c0b06', '#5a1a08', '#c2440f', '#ff8a2a'],
  obsidian: ['#05060f', '#0a0f26', '#14246b', '#2a52c8', '#6aa0ff'],
};
