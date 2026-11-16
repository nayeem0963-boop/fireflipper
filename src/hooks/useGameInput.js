import { useEffect } from 'react';
import { ACTIONS, emitAction } from '../systems/input/inputBus.js';

const FLAP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
const DIVE_KEYS = new Set(['ArrowDown', 'KeyS']);
const PAUSE_KEYS = new Set(['Escape', 'KeyP']);

const isControl = (el) => el instanceof Element && el.closest('button, input, select, textarea, a');

/**
 * Maps raw keyboard / pointer events to abstract game actions.
 *  - Pointer input is bound to `targetRef` (the play surface), so taps on
 *    HUD buttons never count as flaps. Pointer events cover mouse, touch and pen.
 *  - Every new touch flaps; "holding" lasts until the last pointer lifts.
 *  - Space/Enter on a focused button activates the button instead of flapping.
 */
export function useGameInput(targetRef) {
  useEffect(() => {
    const target = targetRef.current;
    const pointers = new Set();
    let keysHeld = 0;

    const releaseFlapIfIdle = () => {
      if (pointers.size === 0 && keysHeld === 0) emitAction(ACTIONS.FLAP_RELEASE);
    };

    const onKeyDown = (e) => {
      if (e.repeat) return;
      if (isControl(e.target) && (e.code === 'Space' || e.code === 'Enter')) return;
      if (FLAP_KEYS.has(e.code)) {
        e.preventDefault();
        keysHeld++;
        emitAction(ACTIONS.FLAP_PRESS);
      } else if (DIVE_KEYS.has(e.code)) {
        e.preventDefault();
        emitAction(ACTIONS.DIVE_PRESS);
      } else if (PAUSE_KEYS.has(e.code)) {
        emitAction(ACTIONS.PAUSE);
      }
    };
    const onKeyUp = (e) => {
      if (FLAP_KEYS.has(e.code)) {
        keysHeld = Math.max(0, keysHeld - 1);
        releaseFlapIfIdle();
      } else if (DIVE_KEYS.has(e.code)) {
        emitAction(ACTIONS.DIVE_RELEASE);
      }
    };

    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      pointers.add(e.pointerId);
      emitAction(ACTIONS.FLAP_PRESS);
    };
    const onPointerUp = (e) => {
      if (pointers.delete(e.pointerId)) releaseFlapIfIdle();
    };
    const onBlur = () => {
      pointers.clear();
      keysHeld = 0;
      emitAction(ACTIONS.FLAP_RELEASE);
      emitAction(ACTIONS.DIVE_RELEASE);
    };
    const preventMenu = (e) => e.preventDefault();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('blur', onBlur);
    target?.addEventListener('pointerdown', onPointerDown);
    target?.addEventListener('contextmenu', preventMenu);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('blur', onBlur);
      target?.removeEventListener('pointerdown', onPointerDown);
      target?.removeEventListener('contextmenu', preventMenu);
    };
  }, [targetRef]);
}
