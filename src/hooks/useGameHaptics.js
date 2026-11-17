import { useEffect } from 'react';
import { GAME_EVENTS, gameEvents } from '../systems/events/gameEvents.js';
import { HAPTIC, vibrate } from '../utils/haptics.js';
import { useGameStore } from '../store/useGameStore.js';

/** Vibrates on notable gameplay events while the haptics setting is on. Flaps stay silent: they would buzz constantly. */
export function useGameHaptics() {
  useEffect(() => {
    const buzz = (pattern) => () => {
      if (useGameStore.getState().hapticsEnabled) vibrate(pattern);
    };
    const offs = [
      gameEvents.on(GAME_EVENTS.ORB, buzz(HAPTIC.orb)),
      gameEvents.on(GAME_EVENTS.NEAR_MISS, buzz(HAPTIC.nearMiss)),
      gameEvents.on(GAME_EVENTS.POWERUP, buzz(HAPTIC.powerup)),
      gameEvents.on(GAME_EVENTS.SHIELD_BREAK, buzz(HAPTIC.shieldBreak)),
      gameEvents.on(GAME_EVENTS.CRASH, buzz(HAPTIC.crash)),
      gameEvents.on(GAME_EVENTS.ROCK_IMPACT, buzz(HAPTIC.rockImpact)),
    ];
    return () => offs.forEach((off) => off());
  }, []);
}
