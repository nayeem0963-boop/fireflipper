import { LatheGeometry, Vector2 } from 'three';

/**
 * A brilliant-cut gem: a flat table on top, a crown flaring to the girdle, and a pavilion tapering to a point, turned
 * `facets` times round its axis. With flat shading each lathe segment reads as a facet. The gem is centred near the origin
 * and about 2.7 units tall.
 */
export function diamondGeometry({ facets = 8, table = 0.55, girdle = 1.25, crown = 0.7, pavilion = 1.6 } = {}) {
  const profile = [new Vector2(0, crown), new Vector2(table, crown), new Vector2(girdle, 0.12), new Vector2(girdle, -0.04), new Vector2(0, -pavilion)];
  const g = new LatheGeometry(profile, Math.max(3, Math.round(facets)));
  g.computeBoundingSphere();
  return g;
}
