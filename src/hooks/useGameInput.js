import { useEffect } from 'react';
import { ACTIONS, emitAction } from '../systems/input/inputBus.js';

const FLAP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
const PAUSE_KEYS = new Set(['Escape', 'KeyP']);

/**
 * Maps raw keyboard / pointer events to abstract game actions.
 * Pointer input is bound to `targetRef` (the play surface) so taps on HUD
 * buttons never count as flaps. Pointer events cover mouse, touch and pen.
 */
export function useGameInput(targetRef) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.repeat) return;
      if (FLAP_KEYS.has(e.code)) {
        e.preventDefault();
        emitAction(ACTIONS.FLAP);
      } else if (PAUSE_KEYS.has(e.code)) {
        emitAction(ACTIONS.PAUSE);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    const target = targetRef.current;
    const onPointerDown = (e) => {
      if (e.button !== 0) return;
      emitAction(ACTIONS.FLAP);
    };
    target?.addEventListener('pointerdown', onPointerDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      target?.removeEventListener('pointerdown', onPointerDown);
    };
  }, [targetRef]);
}
