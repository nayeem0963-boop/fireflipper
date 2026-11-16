import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils } from 'three';
import { BASE_CAMERA_Z, BASE_FOV } from './cameraConfig.js';

/**
 * Side-on follow camera.
 *  - Frames the bird ~25-30% in from the left so upcoming obstacles are visible.
 *  - Pulls back on portrait screens so the full flight band fits.
 *  - Follows the bird's height loosely (damped) to avoid seasick motion.
 *  - Small FOV kicks on flap / orb pickup and a short, decaying crash shake.
 */
const BASE_Z = BASE_CAMERA_Z;

export default function CameraRig({ sim }) {
  const base = useRef({ x: 0, y: 0.5, initialised: false });

  useFrame((state, delta) => {
    const { camera, size } = state;
    const dt = Math.min(delta, 0.05);
    const aspect = size.width / Math.max(1, size.height);

    const z = aspect < 1 ? BASE_Z + (1 - aspect) * 12 : BASE_Z;
    const halfWidth = Math.tan(MathUtils.degToRad(BASE_FOV / 2)) * z * aspect;
    // Narrow screens push the bird further left to maximise look-ahead.
    const lead = aspect < 1 ? 0.58 : 0.45;
    const targetX = Math.min(halfWidth * lead, 6);
    const birdY = sim.renderBirdY();
    const targetY = MathUtils.clamp(birdY * 0.3 + 0.55, -0.4, 1.6) + sim.fx.lift * 0.08;

    const b = base.current;
    if (!b.initialised) {
      b.x = targetX;
      b.y = targetY;
      b.initialised = true;
    }
    const k = 1 - Math.exp(-3.5 * dt);
    b.x += (targetX - b.x) * k;
    b.y += (targetY - b.y) * k;

    // Shake is bounded and decays in the sim (fx.shake ≤ ~0.35).
    const s = sim.fx.shake;
    const sx = s > 0.001 ? (Math.random() - 0.5) * s : 0;
    const sy = s > 0.001 ? (Math.random() - 0.5) * s : 0;

    camera.position.set(b.x + sx, b.y + sy, z);
    camera.lookAt(b.x, b.y - 0.35, 0);

    const fov = BASE_FOV + Math.min(sim.fx.fovKick, 3);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
