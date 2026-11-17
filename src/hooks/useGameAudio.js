import { useEffect } from 'react';
import { GAME_EVENTS, gameEvents } from '../systems/events/gameEvents.js';
import { sfx } from '../systems/audio/sfx.js';
import { setMusicActive } from '../systems/audio/music.js';
import { useGameStore, STATUS } from '../store/useGameStore.js';

/** Plays sound effects for gameplay events while sound is enabled. */
export function useGameAudio() {
  useEffect(() => {
    const play = (fn) => () => {
      if (useGameStore.getState().soundEnabled) fn();
    };
    const offs = [
      gameEvents.on(GAME_EVENTS.FLAP, play(sfx.flap)),
      gameEvents.on(GAME_EVENTS.START, play(sfx.start)),
      gameEvents.on(GAME_EVENTS.ORB, play(sfx.orb)),
      gameEvents.on(GAME_EVENTS.POWERUP, play(sfx.powerup)),
      gameEvents.on(GAME_EVENTS.SHIELD_BREAK, play(sfx.shieldBreak)),
      gameEvents.on(GAME_EVENTS.ROCK_IMPACT, play(sfx.rockImpact)),
      gameEvents.on(GAME_EVENTS.NEAR_MISS, (e) => {
        if (useGameStore.getState().soundEnabled) sfx.nearMiss(e.streak);
      }),
      gameEvents.on(GAME_EVENTS.CRASH, play(sfx.crash)),
    ];

    // Music plays only while a run is live, and follows the sound setting and pause state.
    const syncMusic = (s) => setMusicActive(s.soundEnabled && s.status === STATUS.RUNNING);
    syncMusic(useGameStore.getState());
    const unsubscribe = useGameStore.subscribe(syncMusic);

    return () => {
      offs.forEach((off) => off());
      unsubscribe();
      setMusicActive(false);
    };
  }, []);
}
