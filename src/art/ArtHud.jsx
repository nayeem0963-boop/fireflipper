import { CAMERA_PRESETS } from './cameraPresets.js';
import { PALETTES } from './palettes.js';
import { PIECES } from './pieces/index.js';
import { useArtStore } from './useArtStore.js';
import ParamControls from './ParamControls.jsx';

const HELPERS = [
  ['studio', 'Studio'],
  ['grid', 'Grid'],
  ['axes', 'Axes'],
  ['wireframe', 'Wireframe'],
];

const swatch = (p) => ({ '--skin': p.colors[0], '--skin-2': p.colors[1] });

/**
 * The Art Lab control panel: piece switcher, view (camera, pause, speed, palette), helpers, and the active piece's own
 * parameters. It can be collapsed to a title bar, or hidden altogether (H, or the small button) for a clean view.
 */
export default function ArtHud({ piece, values, onSave }) {
  const s = useArtStore();

  if (s.hidden) {
    return (
      <button type="button" className="art-reveal" onClick={() => s.setHidden(false)} aria-label="Show the controls (H)" title="Show controls (H)">
        Controls
      </button>
    );
  }
  const collapsed = s.hud === 'collapsed';

  return (
    <aside className={`art-hud${collapsed ? ' is-collapsed' : ''}`} aria-label="Art Lab controls">
      <header className="art-hud__head">
        <h2 className="art-hud__title">Art Lab</h2>
        <div className="art-hud__head-actions">
          <button type="button" className="art-chip" onClick={() => s.setHud(collapsed ? 'open' : 'collapsed')} aria-expanded={!collapsed}>
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
          <button type="button" className="art-chip" onClick={() => s.setHidden(true)} title="Hide the panel (H)">
            Hide
          </button>
        </div>
      </header>

      {!collapsed && (
        <div className="art-hud__body">
          <section className="art-section" aria-label="Piece">
            <h3 className="art-section__title">Piece</h3>
            <div className="art-pieces" role="radiogroup" aria-label="Art piece">
              {PIECES.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={p.id === piece.id} className={`art-piece${p.id === piece.id ? ' is-active' : ''}`} onClick={() => s.setPiece(p.id)}>
                  {p.title}
                </button>
              ))}
            </div>
            <p className="art-blurb">{piece.blurb}</p>
          </section>

          <section className="art-section" aria-label="View">
            <h3 className="art-section__title">View</h3>
            <div className="segmented art-segmented" role="radiogroup" aria-label="Camera preset">
              {CAMERA_PRESETS.map((c, i) => (
                <button key={c.id} type="button" role="radio" aria-checked={s.preset === c.id} className={s.preset === c.id ? 'is-active' : ''} onClick={() => s.setPreset(c.id)} title={`${c.name} (${i + 1})`}>
                  {c.name}
                </button>
              ))}
            </div>
            <div className="art-row">
              <button type="button" className="art-chip" onClick={s.togglePaused} aria-pressed={s.paused}>
                {s.paused ? 'Play' : 'Pause'}
              </button>
              <button type="button" className="art-chip" onClick={s.resetView}>
                Reset view
              </button>
              <button type="button" className="art-chip" onClick={onSave}>
                Save PNG
              </button>
            </div>
            <label className="art-field" htmlFor="art-speed">
              <span className="art-field__label">Speed</span>
              <output className="art-field__value">{s.speed.toFixed(2)}×</output>
              <input id="art-speed" className="art-range" type="range" min={0} max={3} step={0.05} value={s.speed} onChange={(e) => s.setSpeed(Number(e.target.value))} />
            </label>
            <div className="art-palettes" role="radiogroup" aria-label="Palette">
              {PALETTES.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={s.palette === p.id} className={`art-palette${s.palette === p.id ? ' is-active' : ''}`} style={swatch(p)} onClick={() => s.setPalette(p.id)}>
                  <span className="art-palette__dot" aria-hidden="true" />
                  {p.name}
                </button>
              ))}
            </div>
          </section>

          <section className="art-section" aria-label="Helpers">
            <h3 className="art-section__title">Helpers</h3>
            <div className="art-row">
              {HELPERS.map(([flag, label]) => (
                <button key={flag} type="button" className="art-chip" aria-pressed={s[flag]} onClick={() => s.toggle(flag)}>
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="art-section" aria-label={`${piece.title} parameters`}>
            <h3 className="art-section__title">{piece.title}</h3>
            <ParamControls schema={piece.params} values={values} onChange={(key, v) => s.setParam(piece.id, key, v)} idPrefix={`art-${piece.id}`} />
            <button type="button" className="art-chip art-chip--wide" onClick={() => s.resetParams(piece.id)}>
              Reset this piece
            </button>
          </section>

          <p className="art-hint">
            <kbd>H</kbd> hide · <kbd>Space</kbd> pause · <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> camera · <kbd>R</kbd> reset view · <kbd>[</kbd> <kbd>]</kbd> piece
          </p>
        </div>
      )}
    </aside>
  );
}
