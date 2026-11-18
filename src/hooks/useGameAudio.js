import { useEffect } from 'react';
import { GAME_EVENTS, gameEvents } from '../systems/events/gameEvents.js';
import { sfx } from '../systems/audio/sfx.js';
import { useGameStore } from '../store/useGameStore.js';

/** Plays sound effects for gameplay events while sound is enabled. */
export function useGameAudio() {
  useEffect(() => {
    const play = (fn, arg) => (e) => {
      if (useGameStore.getState().soundEnabled) fn(arg ? arg(e) : undefined);
    };
    const offs = [
      gameEvents.on(GAME_EVENTS.FLAP, play(sfx.flap)),
      gameEvents.on(GAME_EVENTS.ORB, (e) => (e.gem ? play(sfx.gem)() : play(sfx.orb, (ev) => ev.streak)(e))),
      gameEvents.on(GAME_EVENTS.MULTIPLIER, play(sfx.multiplier, (e) => e.mult)),
      gameEvents.on(GAME_EVENTS.STREAK_BREAK, (e) => e.count >= 3 && play(sfx.streakBreak)()),
      gameEvents.on(GAME_EVENTS.POWERUP, (e) => play(e.kind === 'shield' ? sfx.shieldGet : sfx.magnetGet)()),
      gameEvents.on(GAME_EVENTS.SHIELD_BREAK, play(sfx.shieldBreak)),
      gameEvents.on(GAME_EVENTS.ENVIRONMENT, play(sfx.environment)),
      gameEvents.on(GAME_EVENTS.RING, play(sfx.ring)),
      gameEvents.on(GAME_EVENTS.LANDING, play(sfx.landing)),
      gameEvents.on(GAME_EVENTS.CRASH, play(sfx.crash, (e) => e.cause)),
      gameEvents.on(GAME_EVENTS.NEAR_MISS, play(sfx.nearMiss, (e) => Math.min(1, Math.max(0, 1 - e.clearance / 0.3)))),
    ];
    return () => offs.forEach((off) => off());
  }, []);
}
