/**
 * The scenery scroll driver: pure functions that turn the run distance into scenery offsets. Everything the environment draws as it
 * moves (painted backdrops, parallax layers) takes its position from these functions and from `sim.renderDistance()` alone, so
 * scenery motion is:
 *  - frame-rate independent (the same distance always gives the same offset, however many frames it took to get there),
 *  - frozen while the run is paused (the distance stops, and so does everything derived from it),
 *  - free of wall-clock time (no Date / performance.now / clock.elapsedTime),
 *  - seamless (looping layers wrap with a positive modulo, so there is no jump at the seam).
 * Nothing here touches the simulation.
 */

/** World units the layers travel per metre flown: far < mid < near (the bird's own plane moves 1 unit per metre). */
export const SCROLL_SPEED = { far: 0.05, mid: 0.25, near: 0.7 };

/** Positive modulo, so a looping layer wraps seamlessly for any distance (including negatives). */
export const wrap = (v, span) => ((v % span) + span) % span;

/** Offset of a looping layer: `distance * speed`, wrapped to its span. */
export const loopOffset = (distance, speed, span) => wrap(distance * speed, span);

/** 0..1 progress of the run through [start, end], clamped. */
export function progress(distance, start, end) {
  if (end <= start) return distance >= end ? 1 : 0;
  return Math.min(1, Math.max(0, (distance - start) / (end - start)));
}

/**
 * Sideways position of a painted backdrop relative to the camera. The painting slides its whole slack (`slack` units each side of
 * centre) across the stretch [start, end] of the run: it starts at +slack (picture shifted right, so its right edge is in view
 * first) and ends at -slack, moving at a constant `2 * slack / (end - start)` units per metre, so it is in motion for the whole
 * stretch instead of crawling or being parked at a clamp.
 */
export function paintingSlide(distance, start, end, slack) {
  return slack * (1 - 2 * progress(distance, start, end));
}

/**
 * The stretch of the run over which painting `i` of a zone slides: from where it starts to appear (half a dissolve before its cut,
 * or the zone's cross-fade edge for the first) to where the next one has fully replaced it (half a dissolve after its cut, or the
 * zone's far cross-fade edge for the last).
 */
export function paintingSpan(zone, cuts, dissolve, i, count, crossfade) {
  const first = i === 0;
  const last = i === count - 1;
  const start = first ? zone.start - (zone.start > 0 ? crossfade / 2 : 0) : cuts[i - 1] - dissolve / 2;
  const end = last ? zone.end + crossfade / 2 : cuts[i] + dissolve / 2;
  return [start, end];
}

/**
 * Width a painting needs so that sliding it across its stretch at (at least) the far layer speed is possible without ever showing
 * its edge: the view plus the travel.
 */
export const slideWidth = (viewW, spanMetres, speed = SCROLL_SPEED.far) => viewW + speed * spanMetres;

/**
 * Painted backdrops cannot loop, so their depth layers slide at much smaller speeds than the 3D layers (the picture would run out).
 * With `depth` on, the same picture is drawn three times through different masks (the whole picture, the side cliffs, the near edges)
 * and each layer slides this fast (units per metre, at the minimum width); the painting is sized for the fastest one.
 */
export const DEPTH_SLIDE = { far: 0.05, mid: 0.08, near: 0.1 };

/** Slack (units each side) a layer slides: the fastest layer uses all of it, slower layers a proportional part. */
export const layerSlack = (slack, layer) => slack * (DEPTH_SLIDE[layer] / DEPTH_SLIDE.near);

/**
 * Upper limit (units per metre) on how fast a painted backdrop's slack is used, so a short stretch with a very wide picture (the 165 m Frosty
 * scenes) never makes the far backdrop move faster than the 3D mid layer (0.25).
 */
export const SLIDE_CAP = 0.2;

/** Slack actually used across the stretch [start, end]: the picture's own slack, limited by SLIDE_CAP. */
export const effectiveSlack = (slack, start, end) => Math.min(slack, (SLIDE_CAP * (end - start)) / 2);

/**
 * Texture lifecycle for painted backdrops. A painting loads when the run gets within its `loadAt`, and its texture is disposed once the
 * run is UNLOAD_AFTER metres past the end of its stretch (or far enough before its `loadAt`, after a restart), so only the paintings near
 * the player are on the GPU. A painting with `loadAt < 0` (the very first one) is never unloaded, so a retry starts without a reload.
 * Returns 'load' | 'unload' | 'keep' | 'idle'.
 */
export const UNLOAD_AFTER = 100;
export function residency(distance, loadAt, spanEnd, loaded) {
  if (!loaded) return distance > loadAt && distance < spanEnd + UNLOAD_AFTER ? 'load' : 'idle';
  if (loadAt >= 0 && (distance > spanEnd + UNLOAD_AFTER || distance < loadAt - UNLOAD_AFTER)) return 'unload';
  return 'keep';
}

/**
 * Looping painted zones (the Cloud Sanctuary, 5000 m onwards without end): painting k covers [start + k * length, start + (k + 1) * length) and the
 * file shown is `k % count`, so the pictures repeat for ever. Only the painting being shown, the next one (preloaded `preload` m before it is needed) and
 * the previous one (kept `unloadAfter` m, while it is dissolving out) are ever on the GPU: at most two at once, one per slot (`k % 2`).
 */
export const CYCLE = { length: 1000, dissolve: 60, preload: 150, unloadAfter: 100 };

export function cyclePlan(distance, start, length = CYCLE.length, preload = CYCLE.preload, unloadAfter = CYCLE.unloadAfter) {
  const pos = distance - start;
  const k = Math.floor(pos / length);
  const off = pos - k * length;
  const wanted = [];
  if (k >= 0) wanted.push(k);
  if (off > length - preload && k + 1 >= 0) wanted.push(k + 1);
  if (off <= unloadAfter && k - 1 >= 0) wanted.push(k - 1);
  return { k, off, wanted };
}

/** The stretch of the run over which painting `k` of a looping zone slides: from half a dissolve before it starts to half a dissolve after it ends. */
export function cycleSpan(k, start, length = CYCLE.length, dissolve = CYCLE.dissolve, crossfade = 80) {
  const a = start + k * length - (k === 0 ? crossfade / 2 : dissolve / 2);
  return [a, start + (k + 1) * length + dissolve / 2];
}
