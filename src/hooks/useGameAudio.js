import { useEffect } from 'react';
import { GAME_EVENTS, gameEvents } from '../systems/events/gameEvents.js';
import { sfx } from '../systems/audio/sfx.js';
import { useGameStore } from '../store/useGameStore.js';

/** Plays sound effects for gameplay events while sound is enabled. */
export function useGameAudio() {
  useEffect(() => {
    const play = (fn) => () => {
      if (useGameStore.getState().soundEnabled) fn();
    };
    const offs = [
      gameEvents.on(GAME_EVENTS.FLAP, play(sfx.flap)),
      gameEvents.on(GAME_EVENTS.ORB, play(sfx.orb)),
      gameEvents.on(GAME_EVENTS.CRASH, play(sfx.crash)),
    ];
    return () => offs.forEach((off) => off());
  }, []);
}
