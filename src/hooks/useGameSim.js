import { useGameStore } from '../store/useGameStore.js';
import { game, runnerGame } from '../systems/game/gameInstance.js';
import { getVersion, isRunner } from '../systems/versions/versions.js';

/** The simulation for a version: the flying game (v1) or the ground-runner (v2). The simulations themselves never see the version. */
export function simForVersion(version) {
  return isRunner(version) ? runnerGame : game;
}

/** The simulation the screen is driving right now, read at call time (for input handlers and timers). */
export function getActiveSim() {
  return simForVersion(getVersion(useGameStore.getState().versionId));
}

/** The simulation for the selected version (React hook). */
export function useGameSim() {
  return simForVersion(getVersion(useGameStore((s) => s.versionId)));
}
