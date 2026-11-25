import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import AvatarBird from '../../components/scene/AvatarBird.jsx';
import { useTheme } from '../../hooks/useTheme.js';
import { damp } from '../../utils/math.js';

const FOV_DEG = 40;
/** Time between idle flourishes (s), and how long each lasts. */
const IDLE_EVERY = 4.2;
const IDLE_LENGTH = 1.3;
const FLOURISHES = ['roll', 'hop', 'look'];

/** Smooth 0..1..0 bump over `p` in 0..1. */
const bump = (p) => Math.sin(Math.min(Math.max(p, 0), 1) * Math.PI);
const ease = (p) => p * p * (3 - 2 * p);

/**
 * Picks the camera distance so a bird fits the preview whatever its size or the stage's shape: a morpho
 * butterfly (4 units across) and FlameBird (2.6 tall) both fill about the same share of the frame.
 */
function useFitCamera(length) {
  const { camera, size } = useThree();
  useFrame((_, delta) => {
    const aspect = size.width / Math.max(1, size.height);
    const half = Math.tan((FOV_DEG * Math.PI) / 360);
    const needW = (length * 1.45) / (2 * half * aspect);
    const needH = (length * 1.15) / (2 * half);
    const target = Math.max(4.2, needW, needH);
    const k = damp(4, delta);
    camera.position.z += (target - camera.position.z) * k;
    camera.position.y += (0.15 - camera.position.y) * k;
    camera.lookAt(0, 0, 0);
  });
}

/**
 * A small stage for previewing one avatar: the bird side-on as it flies in the game, swaying gently, with a short
 * idle flourish (a roll, a hop or a look around) every few seconds so the preview feels alive. Visual only.
 */
export default function AvatarStage({ avatar }) {
  const group = useRef();
  const { scene } = useTheme();
  const state = useRef({ n: 0, start: -1 });
  useFitCamera(avatar.length ?? 2.0);

  useFrame((frame) => {
    const g = group.current;
    if (!g) return;
    const t = frame.clock.elapsedTime;
    const s = state.current;
    const cycle = Math.floor(t / IDLE_EVERY);
    if (cycle !== s.n) {
      s.n = cycle;
      s.start = t;
    }
    const p = s.start < 0 ? 2 : (t - s.start) / IDLE_LENGTH;
    const kind = FLOURISHES[s.n % FLOURISHES.length];
    const active = p >= 0 && p <= 1;

    let rx = 0;
    let ry = -0.25 + Math.sin(t * 0.7) * 0.3;
    let y = 0;
    if (active && kind === 'roll') rx = ease(p) * Math.PI * 2;
    if (active && kind === 'hop') y = bump(p) * 0.55;
    if (active && kind === 'look') ry += bump(p) * 0.7;
    g.rotation.x = rx;
    g.rotation.y = ry;
    g.position.y = y;
  });

  return (
    <>
      <ambientLight intensity={0.35} color={scene.ambient} />
      <hemisphereLight args={[scene.hemiSky, scene.hemiGround, 0.6]} />
      <directionalLight position={[-4, 5, 3]} intensity={1.1} color={scene.key} />
      <group ref={group}>
        <AvatarBird avatar={avatar} float={0.12} wingSpeed={5.5} />
      </group>
    </>
  );
}
