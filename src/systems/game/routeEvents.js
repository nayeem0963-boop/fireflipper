import { GAME_EVENTS } from '../events/gameEvents.js';

/**
 * How a simulation event reaches the store. Pure (the store is passed in), so the game loop and the headless tests run the very same routing: the tests can fly a whole journey through the
 * real store without a browser. Every store action it calls guards itself (once-only, status-checked, Auto play and Journey Preview isolated), so the order of events cannot corrupt anything.
 */
export function routeSimEvent(store, sim, e) {
  if (e.type === GAME_EVENTS.START) store.beginRun();
  else if (e.type === GAME_EVENTS.CRASH) store.crash();
  else if (e.type === GAME_EVENTS.OVER) store.endRun(sim.results());
  else if (e.type === GAME_EVENTS.MILESTONE) store.milestoneReached(e);
  else if (e.type === GAME_EVENTS.COMPLETE) store.endRun(sim.results());
}
