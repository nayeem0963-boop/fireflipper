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
      gameEvents.on(GAME_EVENTS.ORB, (e) => {
        if (useGameStore.getState().soundEnabled) sfx.orb(e.streak);
      }),
      gameEvents.on(GAME_EVENTS.NEAR, play(sfx.near)),
      gameEvents.on(GAME_EVENTS.CRASH, play(sfx.crash)),
      // the milestone chime and the finish fanfare belong to real play and the Journey Preview; plain Auto play stays quiet about them
      gameEvents.on(GAME_EVENTS.MILESTONE, () => {
        const s = useGameStore.getState();
        if (s.soundEnabled && (!s.demo || s.preview)) sfx.milestone();
      }),
      gameEvents.on(GAME_EVENTS.COMPLETE, () => {
        const s = useGameStore.getState();
        if (s.soundEnabled && (!s.demo || s.preview)) sfx.journey();
      }),
    ];
    return () => offs.forEach((off) => off());
  }, []);
}
