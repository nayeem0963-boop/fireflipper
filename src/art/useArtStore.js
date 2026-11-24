import { create } from 'zustand';
import { loadValue, saveValue } from '../utils/storage.js';
import { PALETTES } from './palettes.js';
import { BLOOM_PARAMS } from './bloom.js';
import { clampParam, sanitizeSaved } from './params.js';
import { PIECES } from './pieces/index.js';

const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const FLAGS = ['wireframe', 'grid', 'axes', 'studio', 'bloom'];

/**
 * The Art Lab's own small store (separate from the game's). It remembers the piece, its parameters, the camera preset,
 * the palette, the speed and the helper toggles between visits. Paused and hidden are per visit and are not saved.
 */
export const useArtStore = create((set, get) => {
  const saved = sanitizeSaved(loadValue('art', null), PIECES, PALETTES, BLOOM_PARAMS);
  const save = () => {
    const s = get();
    saveValue('art', {
      pieceId: s.pieceId, preset: s.preset, palette: s.palette, speed: s.speed, wireframe: s.wireframe, grid: s.grid, axes: s.axes, studio: s.studio, bloom: s.bloom, bloomSettings: s.bloomSettings, hud: s.hud, params: s.params,
    });
  };
  const update = (patch) => {
    set(patch);
    save();
  };

  return {
    ...saved,
    /** Counts up to ask the camera to fly back to the current preset (also bumped when the preset changes). */
    viewNonce: 0,
    paused: prefersReducedMotion(),
    hidden: false,

    setPiece: (id) => {
      if (PIECES.some((p) => p.id === id)) update({ pieceId: id, viewNonce: get().viewNonce + 1 });
    },
    /** Step to the next (+1) or previous (-1) piece, wrapping round. */
    stepPiece: (delta) => {
      const i = PIECES.findIndex((p) => p.id === get().pieceId);
      get().setPiece(PIECES[(i + delta + PIECES.length) % PIECES.length].id);
    },
    setParam: (pieceId, key, value) => {
      const def = PIECES.find((p) => p.id === pieceId)?.params[key];
      if (!def) return;
      update({ params: { ...get().params, [pieceId]: { ...(get().params[pieceId] ?? {}), [key]: clampParam(def, value) } } });
    },
    resetParams: (pieceId) => {
      const { [pieceId]: _dropped, ...rest } = get().params;
      update({ params: rest });
    },
    /** One bloom setting (strength, threshold or radius), clamped to its range. */
    setBloom: (key, value) => {
      const def = BLOOM_PARAMS[key];
      if (def) update({ bloomSettings: { ...get().bloomSettings, [key]: clampParam(def, value) } });
    },
    resetBloom: () => update({ bloomSettings: Object.fromEntries(Object.entries(BLOOM_PARAMS).map(([k, d]) => [k, d.default])) }),
    setPreset: (id) => {
      if (['hero', 'close', 'overview'].includes(id)) update({ preset: id, viewNonce: get().viewNonce + 1 });
    },
    resetView: () => set({ viewNonce: get().viewNonce + 1 }),
    setPalette: (id) => PALETTES.some((p) => p.id === id) && update({ palette: id }),
    setSpeed: (v) => Number.isFinite(v) && update({ speed: Math.min(3, Math.max(0, v)) }),
    togglePaused: () => set({ paused: !get().paused }),
    toggle: (flag) => FLAGS.includes(flag) && update({ [flag]: !get()[flag] }),
    /** 'open' or 'collapsed' (kept between visits). */
    setHud: (mode) => ['open', 'collapsed'].includes(mode) && update({ hud: mode }),
    setHidden: (hidden) => set({ hidden: !!hidden }),
  };
});
