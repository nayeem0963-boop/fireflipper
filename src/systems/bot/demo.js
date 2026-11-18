import { game } from '../game/gameInstance.js';
import { BIOMES, biomeIndexAt } from '../world/environments.js';
import { createAutopilot } from './autopilot.js';

/**
 * The auto-play bot for the live game, and the few things the demo screen can ask of it.
 * One game simulation exists (gameInstance), so one bot is enough.
 */
export const demoBot = createAutopilot(game);

/** Metres before a boundary to land at, so the viewer sees the blend begin. */
const WARP_LEAD = 30;

/**
 * Jump ahead to just before the next environment. Returns its name, or null when already in the last one.
 * The bird is placed at a spot the track guarantees is reachable, and the bot starts afresh from there.
 */
export function warpToNextEnvironment() {
  const next = biomeIndexAt(game.distance) + 1;
  if (next >= BIOMES.length) return null;
  game.warpTo(BIOMES[next].from - WARP_LEAD);
  demoBot.planNow(); // no blind moment after the jump
  return BIOMES[next].name;
}
