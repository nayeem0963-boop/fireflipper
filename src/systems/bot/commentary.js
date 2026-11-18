/**
 * What the auto-play mode tells the viewer: one plain sentence about the obstacle section the bird is in or
 * approaching, and a short reminder of the controls. Pure data and a tiny lookup, so it is easy to test.
 */
export const CONTROLS_TIP = 'Tap to flap. Hold to climb higher. Let go to fall.';

export const SECTION_TIPS = Object.freeze({
  gate: ['Gate', 'Fly through the gap between the two pillars.'],
  column: ['Pillar', 'Keep clear of the pillar: pass above or below it.'],
  floatingRocks: ['Floating rocks', 'Go above or below the rocks, whichever is closer.'],
  splitGate: ['Split gate', 'The wide opening is safe. The narrow one is risky but pays more orbs and gems.'],
  formation: ['Rock wall', 'Find the single gap and line up early.'],
  geysers: ['Lava columns', 'They rise and fall on a beat. Fly above them, or time the low route.'],
  passage: ['Narrow passage', 'Stay level and tap lightly: small, early corrections.'],
  tunnel: ['Winding tunnel', 'Follow the corridor as it steps up and down.'],
  boulders: ['Falling boulders', 'A red lane glows first. Be well above or below where the boulder lands.'],
  spinner: ['Spinner', 'A turning bar: go over, under, or time your pass.'],
  islandChain: ['Island chain', 'Squeeze between the slabs (near misses pay), or fly over the lot.'],
  grove: ['Grove', 'Weave between the trees, one from above, one from below.'],
  ashfall: ['Ashfall', 'Three boulders drop in a row: watch each red lane.'],
});

/**
 * The tip for the section the bird is in, or about to reach (within `lookAhead` metres).
 * Returns { title, text, distance } or null when the road ahead is clear.
 */
export function describeAhead(sim, lookAhead = 40) {
  const d = sim.distance;
  for (const c of sim.track.corridors) {
    if (c.x1 < d - 2) continue;
    if (c.x0 - d > lookAhead) return null;
    const tip = SECTION_TIPS[c.type];
    if (!tip) return null;
    return { title: tip[0], text: tip[1], distance: Math.round(Math.max(0, c.x0 - d)) };
  }
  return null;
}
