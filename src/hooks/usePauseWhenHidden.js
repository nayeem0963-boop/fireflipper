import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore.js';

/** Auto-pauses the run when the tab is hidden or the window loses focus. */
export function usePauseWhenHidden() {
  useEffect(() => {
    const pause = () => useGameStore.getState().pause();
    const onVisibility = () => {
      if (document.hidden) pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', pause);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', pause);
    };
  }, []);
}
