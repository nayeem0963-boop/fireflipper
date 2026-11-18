import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils } from 'three';
import { BASE_FOV, PORTRAIT_LEAD, cameraDistance } from './cameraConfig.js';
import { WORLD } from '../../systems/physics/constants.js';
import { prefersReducedMotion } from '../../utils/device.js';

/**
 * Side-on follow camera.
 *  - Frames the bird ~25-30% in from the left so upcoming obstacles are visible.
 *  - Pulls back on portrait screens so the full flight band fits.
 *  - Follows the bird's height loosely (damped) to avoid seasick motion.
 *  - Small FOV kicks on flap / orb pickup and a short, decaying crash shake.
 *  - Gentle feedback for intense movement: the view widens a touch with speed
 *    and dives, and leads slightly in the direction of travel. Every effect is
 *    capped (total FOV change <= MAX_FOV_BOOST degrees, framing shift <= 0.25 u)
 *    so obstacles are never hidden or displaced, and reduced-motion users get
 *    only a small fraction of it.
 */
const MAX_FOV_BOOST = 4.5;
const SPEED_FOV = 1.4;
const DIVE_FOV = 1.2;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export default function CameraRig({ sim }) {
  const base = useRef({ x: 0, y: 0.5, initialised: false, fov: BASE_FOV });
  const calm = useRef(prefersReducedMotion());

  useFrame((state, delta) => {
    const { camera, size } = state;
    const dt = Math.min(delta, 0.05);
    const aspect = size.width / Math.max(1, size.height);

    const z = cameraDistance(aspect);
    const halfWidth = Math.tan(MathUtils.degToRad(BASE_FOV / 2)) * z * aspect;
    // Portrait screens push the bird further left (to ~16% from the edge)
    // to maximise look-ahead; the tail still stays on screen.
    const lead = aspect < 1 ? PORTRAIT_LEAD : 0.45;
    const targetX = Math.min(halfWidth * lead, 6);
    const birdY = sim.renderBirdY();
    // Look slightly toward where the bird is heading (bounded, and damped below).
    const lookAhead = MathUtils.clamp(sim.bird.vy * 0.025, -0.25, 0.2) * (sim.bird.dead ? 0 : 1);
    const targetY = MathUtils.clamp(birdY * 0.3 + 0.55, -0.4, 1.6) + sim.fx.lift * 0.08 + lookAhead;

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
    // A fast two-axis wobble reads as impact; random jitter just looks noisy.
    const s = sim.fx.shake * (calm.current ? 0.25 : 1);
    const wobble = sim.time * 62;
    const sx = s > 0.001 ? Math.sin(wobble) * s * 0.5 : 0;
    const sy = s > 0.001 ? Math.cos(wobble * 1.31) * s * 0.5 : 0;

    camera.position.set(b.x + sx, b.y + sy, z);
    camera.lookAt(b.x, b.y - 0.35, 0);

    const speedNorm = clamp01((sim.speed - WORLD.baseSpeed) / (WORLD.maxSpeed - WORLD.baseSpeed));
    const live = sim.bird.dead ? 0 : 1;
    const boost = Math.min(
      MAX_FOV_BOOST,
      Math.min(sim.fx.fovKick, 3) + (speedNorm * SPEED_FOV + sim.bird.diveAmt * DIVE_FOV) * live,
    );
    // Eased so the FOV never steps when dive begins or a kick lands.
    b.fov += (BASE_FOV + boost * (calm.current ? 0.2 : 1) - b.fov) * (1 - Math.exp(-9 * dt));
    const fov = b.fov;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
