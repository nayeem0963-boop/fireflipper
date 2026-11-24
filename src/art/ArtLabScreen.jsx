import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import SceneCanvas from '../components/scene/SceneCanvas.jsx';
import IconButton from '../components/ui/IconButton.jsx';
import { ExitIcon } from '../components/ui/Icons.jsx';
import { useRenderSettings } from '../hooks/useRenderSettings.js';
import ArtStage from './ArtStage.jsx';
import ArtHud from './ArtHud.jsx';
import { presetFor } from './cameraPresets.js';
import { getPalette } from './palettes.js';
import { resolveParams } from './params.js';
import { getPiece } from './pieces/index.js';
import { useArtStore } from './useArtStore.js';
import '../styles/art.css';

/**
 * True when the key press belongs to a control that uses the keyboard for typing or choosing, so a shortcut should
 * leave it alone. A slider or a colour swatch does not type letters, so the shortcuts still work after using one.
 */
const inField = (e) => {
  const t = e.target;
  if (!t) return false;
  if (t.isContentEditable || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return true;
  return t.tagName === 'INPUT' && !['range', 'color', 'checkbox', 'radio', 'button'].includes(t.type);
};

/** Same breakpoint as the stylesheet: below it the panel is a bottom sheet instead of a right-hand column. */
const NARROW = '(max-width: 720px), (max-height: 520px)';
function useNarrow() {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(NARROW);
      mq.addEventListener('change', notify);
      return () => mq.removeEventListener('change', notify);
    },
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}

/**
 * The Art Lab: a standalone playground for digital 3D artwork (shaders, lighting, procedural geometry, materials,
 * camera moods). It has no game loop, no score and no physics, and shares nothing with the runner but the shell
 * (canvas wrapper, buttons, theme). Reached from the home screen, or directly with `?art` on the address.
 */
export default function ArtLabScreen() {
  const exitToMenu = useGameStore((s) => s.exitToMenu);
  const s = useArtStore();
  const { tier } = useRenderSettings();
  const captureRef = useRef(null);
  const narrow = useNarrow();

  const piece = getPiece(s.pieceId);
  const palette = getPalette(s.palette);
  const values = useMemo(() => resolveParams(piece.params, s.params[piece.id]), [piece, s.params]);
  const preset = useMemo(() => presetFor(piece, s.preset), [piece, s.preset]);
  const bloom = useMemo(() => ({ on: s.bloom, ...s.bloomSettings }), [s.bloom, s.bloomSettings]);

  // Keep the artwork in the free part of the screen while the panel is open: up on a phone (the panel is a sheet at the
  // bottom), left on a wide screen (the panel is a column on the right).
  const panelOpen = !s.hidden && s.hud === 'open';
  const shift = useMemo(
    () => (!panelOpen ? { x: 0, y: 0 } : narrow ? { x: 0, y: Math.round(window.innerHeight * 0.2) } : { x: 167, y: 0 }),
    [panelOpen, narrow],
  );

  const exit = useCallback(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('art')) {
        url.searchParams.delete('art');
        window.history.replaceState(null, '', url);
      }
    } catch {
      /* the address bar is not essential */
    }
    exitToMenu();
  }, [exitToMenu]);

  const save = useCallback(() => {
    const data = captureRef.current?.();
    if (!data) return;
    const link = document.createElement('a');
    link.href = data;
    link.download = `fireflipper-art-${piece.id}.png`;
    link.click();
  }, [piece.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || inField(e)) return;
      const st = useArtStore.getState();
      const k = e.key.toLowerCase();
      if (k === 'h') st.setHidden(!st.hidden);
      else if (k === 'r') st.resetView();
      else if (k === '1') st.setPreset('hero');
      else if (k === '2') st.setPreset('close');
      else if (k === '3') st.setPreset('overview');
      else if (k === '[') st.stepPiece(-1);
      else if (k === ']') st.stepPiece(1);
      else if (k === ' ' && !/^(BUTTON|A)$/.test(e.target?.tagName)) {
        e.preventDefault();
        st.togglePaused();
      } else if (k === 'escape') exit();
      else return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exit]);

  return (
    <main className="art" aria-label="Art Lab">
      <SceneCanvas className="art__canvas" camera={{ position: preset.position, fov: preset.fov, near: 0.1, far: 200 }} background={palette.bg[0]}>
        <ArtStage
          piece={piece}
          params={values}
          palette={palette}
          speed={s.speed}
          paused={s.paused}
          preset={preset}
          viewNonce={s.viewNonce}
          wireframe={s.wireframe}
          grid={s.grid}
          axes={s.axes}
          studio={s.studio}
          quality={tier}
          captureRef={captureRef}
          shift={shift}
          bloom={bloom}
        />
      </SceneCanvas>

      <div className="art__exit">
        <IconButton label="Back to Fire Flipper (Esc)" onClick={exit}>
          <ExitIcon />
        </IconButton>
      </div>

      <ArtHud piece={piece} values={values} onSave={save} />
    </main>
  );
}
