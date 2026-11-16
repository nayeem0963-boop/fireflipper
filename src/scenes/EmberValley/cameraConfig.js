/** Camera framing for Ember Valley (shared by the rig, the edge warning and the initial <Canvas> camera). */
export const BASE_FOV = 50;
export const BASE_CAMERA_Z = 11;
/** Fraction of the half-width the camera leads the bird by on portrait screens. */
export const PORTRAIT_LEAD = 0.68;

/**
 * Camera distance from the gameplay plane. Portrait screens pull back so
 * the horizontal view (= look-ahead) grows; the flight band still fits
 * vertically with room to spare.
 */
export function cameraDistance(aspect) {
  return aspect < 1 ? BASE_CAMERA_Z + (1 - aspect) * 14 : BASE_CAMERA_Z;
}
