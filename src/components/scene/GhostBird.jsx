import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import Firebird from './Firebird.jsx';
import { ghostState } from '../../systems/game/gameInstance.js';
import { PHASE } from '../../systems/game/createGameSim.js';

/** Pale, cool colours so the ghost never reads as a second player bird. */
const GHOST_PALETTE = {
  body: '#bfe6ff',
  bodyEmissive: '#5aa6e8',
  belly: '#ffffff',
  bellyEmissive: '#8ccaff',
  wing: '#9fd8ff',
  wingEmissive: '#4a9be0',
  wingInner: '#ffffff',
  flame: '#e6f6ff',
  beak: '#ffffff',
  beakEmissive: '#9fd8ff',
  glow: '#7ab8ff',
};
const OPACITY = 0.32;

/**
 * Translucent replay of the player's best attempt on today's daily track. Reads the ghost simulation
 * from `ghostState` each frame; visible only while a run is live and the ghost is still flying.
 */
export default function GhostBird({ sim }) {
  const group = useRef();
  // Wing animation state, copied from the ghost sim each frame (the ghost changes every run).
  const flight = useRef({ vy: 0, sinceFlap: 99, dead: false });

  // Make every material of the (shared) bird model translucent once.
  useEffect(() => {
    group.current?.traverse((o) => {
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        m.transparent = true;
        m.opacity = (m.opacity ?? 1) * OPACITY;
        m.depthWrite = false;
      }
    });
  }, []);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const ghost = ghostState.ghost;
    const live = sim.phase === PHASE.RUNNING || sim.phase === PHASE.READY;
    if (!ghost || !live || ghost.sim.phase === PHASE.OVER) {
      g.visible = false;
      return;
    }
    g.visible = true;
    ghost.sim.alpha = sim.alpha;
    g.position.x = ghost.sim.renderDistance() - sim.renderDistance();
    g.position.y = ghost.sim.renderBirdY();
    g.rotation.z = ghost.sim.bird.pitch + ghost.sim.bird.spin;
    const b = ghost.sim.bird;
    flight.current.vy = b.vy;
    flight.current.sinceFlap = b.sinceFlap;
    flight.current.dead = b.dead;
  });

  return (
    <group ref={group} visible={false}>
      <Firebird
        palette={GHOST_PALETTE}
        scale={0.6}
        rotation={[0, -0.12, 0]}
        flight={flight.current}
        float={0.03}
        wingSpeed={9}
        lightIntensity={0}
        glow={0.25}
      />
    </group>
  );
}
