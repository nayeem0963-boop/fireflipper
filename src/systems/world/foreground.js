import { WORLD } from '../physics/constants.js';
import { loopOffset, wrap } from './scrollDriver.js';

/**
 * The foreground layer: a thin strip of low props (rocks, snow mounds, crystals, blossom) in front of the flight plane, along the bottom
 * edge of the screen. Pure placement maths, shared by the renderer and the tests.
 *
 * Safety by construction: a prop's top edge is always kept below the screen position of the ground at the front of the gameplay
 * plane (where obstacles stand, with a margin), so nothing here can cover the bird, an obstacle, an orb or an edge warning. When the
 * camera rides high and the ground falls off the bottom of the screen, the props simply scroll out of view.
 */
export const FOREGROUND = {
  /** Distance from the camera (world units): constant, so props look the same size on every screen (z follows the camera). */
  distance: 8,
  /** Where the props stand: the floor surface (the canyon / polar / star / pool floors sit 0.04 above WORLD.groundY). */
  floorOffset: 0.04,
  /** The front face of the gameplay plane (obstacles and orbs are shallower than this). */
  gameplayFrontZ: 0.9,
  /** Gap kept below the ground's screen position, in NDC units (the camera's small downward pitch is about 0.07). */
  margin: 0.12,
  /** Prop height range in NDC units (screen fractions of half the height). */
  height: [0.05, 0.11],
  /** Loop length and count of props per zone (instanced, one draw call per live zone). */
  span: 40,
  count: 14,
  /** World units a prop travels per metre flown: it is world-fixed, like the bird's own plane. */
  speed: 1,
};

const halfTan = (fovDeg) => Math.tan((fovDeg * Math.PI) / 360);

/** z of the foreground plane for a camera at distance `camZ` from the flight plane. */
export const foregroundZ = (camZ) => camZ - FOREGROUND.distance;

/** Highest NDC y any foreground prop may reach for a camera at height `camY`, distance `camZ` and vertical fov. */
export function foregroundTopNdc(camY, camZ, fovDeg) {
  const groundNdc = (WORLD.groundY - camY) / ((camZ - FOREGROUND.gameplayFrontZ) * halfTan(fovDeg));
  return groundNdc - FOREGROUND.margin;
}

/** World height of `ndc` screen units at the foreground distance. */
export const ndcToWorld = (ndc, fovDeg) => ndc * FOREGROUND.distance * halfTan(fovDeg);

/** World y of the floor the props stand on. */
export const foregroundBaseY = () => WORLD.groundY + FOREGROUND.floorOffset;

/** World y of the top of the safe strip. */
export const foregroundTopY = (camY, camZ, fovDeg) => camY + ndcToWorld(foregroundTopNdc(camY, camZ, fovDeg), fovDeg);

/**
 * World height a prop of preferred height `prefNdc` may have: its preferred screen height, cut down so its top stays under the safe
 * line (zero when the floor at this depth is already above it, for example when the camera rides high).
 */
export function foregroundHeight(prefNdc, camY, camZ, fovDeg) {
  const room = foregroundTopY(camY, camZ, fovDeg) - foregroundBaseY();
  return Math.max(0, Math.min(ndcToWorld(prefNdc, fovDeg), room));
}

/** Deterministic prop layout (x slot, height, width, rotation, shade) from a seed. */
export function foregroundItems(seed, count = FOREGROUND.count, span = FOREGROUND.span) {
  let s = seed;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: count }, (_, i) => ({
    x: (i / count) * span - span / 2 + rand() * (span / count) * 0.8,
    h: FOREGROUND.height[0] + rand() * (FOREGROUND.height[1] - FOREGROUND.height[0]),
    w: 0.8 + rand() * 1.1,
    rot: rand() * Math.PI * 2,
    shade: 0.8 + rand() * 0.3,
  }));
}

/** x of a prop relative to the camera for the current run distance (seamless loop). */
export function foregroundX(item, distance) {
  const { span, speed } = FOREGROUND;
  let x = item.x - loopOffset(distance, speed, span);
  if (x < -span / 2) x += span;
  return wrap(x + span / 2, span) - span / 2;
}
