/**
 * Parameter schemas for art pieces. A piece declares `params` as { key: definition }; the HUD builds its controls from
 * that and the stage passes the resolved values to the piece. Four kinds:
 *   range  { type: 'range', label, min, max, step, default }
 *   select { type: 'select', label, options: [{ value, label }], default }
 *   toggle { type: 'toggle', label, default }
 *   color  { type: 'color', label, default: '#rrggbb' }
 * Everything here is pure, so it is covered by `npm run test:art` without a browser.
 */
const HEX = /^#[0-9a-f]{6}$/i;

/** The default value of every parameter in a schema. */
export function defaultsOf(schema = {}) {
  return Object.fromEntries(Object.entries(schema).map(([key, def]) => [key, def.default]));
}

/** A value made valid for one definition: clamped and snapped (range), known (select), boolean, or a hex colour. Anything unusable becomes the default. */
export function clampParam(def, value) {
  switch (def.type) {
    case 'range': {
      const n = Number(value);
      if (!Number.isFinite(n)) return def.default;
      const clamped = Math.min(def.max, Math.max(def.min, n));
      const snapped = def.min + Math.round((clamped - def.min) / def.step) * def.step;
      // Round away floating-point dust (0.30000000000000004) and keep the result inside the range.
      return Math.min(def.max, Math.max(def.min, Number(snapped.toFixed(6))));
    }
    case 'select':
      return def.options.some((o) => o.value === value) ? value : def.default;
    case 'toggle':
      return typeof value === 'boolean' ? value : def.default;
    case 'color':
      return typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : def.default;
    default:
      return def.default;
  }
}

/** The values to use: every parameter in the schema, taken from `saved` where valid and from the default otherwise. Unknown keys are dropped. */
export function resolveParams(schema = {}, saved = {}) {
  return Object.fromEntries(
    Object.entries(schema).map(([key, def]) => [key, key in (saved ?? {}) ? clampParam(def, saved[key]) : def.default]),
  );
}

/** Problems with a schema (empty when it is fine). Used by the tests and a dev-time guard when a piece is added. */
export function validateSchema(schema = {}) {
  const problems = [];
  for (const [key, def] of Object.entries(schema)) {
    const at = `param "${key}"`;
    if (!def || typeof def.label !== 'string' || !def.label) problems.push(`${at}: needs a label`);
    if (def?.type === 'range') {
      if (![def.min, def.max, def.step, def.default].every(Number.isFinite)) problems.push(`${at}: range needs numeric min, max, step and default`);
      else {
        if (!(def.min < def.max)) problems.push(`${at}: min must be below max`);
        if (!(def.step > 0)) problems.push(`${at}: step must be positive`);
        if (def.default < def.min || def.default > def.max) problems.push(`${at}: default outside the range`);
      }
    } else if (def?.type === 'select') {
      if (!Array.isArray(def.options) || def.options.length < 2) problems.push(`${at}: select needs two or more options`);
      else if (!def.options.some((o) => o.value === def.default)) problems.push(`${at}: default is not one of the options`);
    } else if (def?.type === 'toggle') {
      if (typeof def.default !== 'boolean') problems.push(`${at}: toggle default must be true or false`);
    } else if (def?.type === 'color') {
      if (!HEX.test(def.default ?? '')) problems.push(`${at}: colour default must be #rrggbb`);
    } else problems.push(`${at}: unknown type "${def?.type}"`);
  }
  return problems;
}

/** What to keep from a saved Art Lab state: only well-formed values, only for pieces that still exist. */
export function sanitizeSaved(saved, pieces, palettes, bloomSchema = {}) {
  const out = { pieceId: pieces[0].id, preset: 'hero', palette: palettes[0].id, speed: 1, wireframe: false, grid: false, axes: false, studio: true, bloom: true, bloomSettings: defaultsOf(bloomSchema), hud: 'open', params: {} };
  if (!saved || typeof saved !== 'object') return out;
  if (pieces.some((p) => p.id === saved.pieceId)) out.pieceId = saved.pieceId;
  if (['hero', 'close', 'overview'].includes(saved.preset)) out.preset = saved.preset;
  if (palettes.some((p) => p.id === saved.palette)) out.palette = saved.palette;
  if (Number.isFinite(saved.speed)) out.speed = Math.min(3, Math.max(0, saved.speed));
  if (saved.bloomSettings && typeof saved.bloomSettings === 'object') out.bloomSettings = resolveParams(bloomSchema, saved.bloomSettings);
  for (const flag of ['wireframe', 'grid', 'axes', 'studio', 'bloom']) if (typeof saved[flag] === 'boolean') out[flag] = saved[flag];
  if (saved.hud === 'collapsed') out.hud = 'collapsed';
  if (saved.params && typeof saved.params === 'object') {
    for (const piece of pieces) if (saved.params[piece.id] && typeof saved.params[piece.id] === 'object') out.params[piece.id] = resolveParams(piece.params, saved.params[piece.id]);
  }
  return out;
}
