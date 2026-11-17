import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Box3, Euler, Matrix4, Vector3 } from 'three';
import { modelUrl } from '../../systems/avatars/avatars.js';
import FlameAura from './FlameAura.jsx';
import { createFireMaterial, createFireUniforms } from './fireMaterial.js';

/**
 * A third-party bird model (see systems/avatars/credits.js) turned into a fire bird: its plumage is re-lit with a
 * flame gradient and glow, and it gets a flame tail, a halo and a warm light. The models are static (no skeleton),
 * so wing beats are suggested by a gentle body pulse and rocking, and each flap by a quick nose-up kick.
 *
 * Takes the same props as Firebird so either can be dropped into the same scene.
 */
const STROKE_TIME = 0.22;
const easeOut = (u) => 1 - (1 - u) * (1 - u);

export default function ModelBird({
  avatar,
  float = 0.12,
  wingSpeed = 7,
  glow = 0.55,
  lightIntensity = 6,
  flight,
  ...props
}) {
  const { scene } = useGLTF(modelUrl(avatar));
  const wrap = useRef();
  const phase = useRef(Math.random() * 6);
  const kick = useRef(0);

  // A private copy of the model with fire materials, centred and scaled to the avatar's length.
  const prepared = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const center = box.getCenter(new Vector3());
    const uniforms = createFireUniforms(avatar.palette, box.min.y, box.max.y);
    const root = scene.clone(true);
    const materials = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.material = createFireMaterial(o.material, uniforms, 'bird');
      materials.push(o.material);
    });
    // Fit the silhouette the camera sees (its x-y extent once turned and pitched) to the avatar's target size.
    const turn = new Matrix4().makeRotationFromEuler(new Euler(0, avatar.facing, 0));
    const tilt = new Matrix4().makeRotationFromEuler(new Euler(0, 0, avatar.pitch));
    const seen = box
      .clone()
      .translate(center.clone().negate())
      .applyMatrix4(turn)
      .applyMatrix4(tilt)
      .getSize(new Vector3());
    return { root, materials, center, scale: avatar.length / Math.max(seen.x, seen.y, 0.001) };
  }, [scene, avatar]);

  useEffect(() => () => prepared.materials.forEach((m) => m.dispose()), [prepared]);

  const tail = -avatar.length / 2;

  useFrame((state, delta) => {
    const g = wrap.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    phase.current += dt * wingSpeed;
    const beat = Math.sin(phase.current);

    let dead = false;
    if (flight) {
      dead = flight.dead;
      kick.current =
        !dead && flight.sinceFlap < STROKE_TIME
          ? easeOut(1 - flight.sinceFlap / STROKE_TIME)
          : kick.current * 0.85;
    }
    const k = kick.current;
    const s = prepared.scale;
    g.position.y = avatar.lift + Math.sin(t * 1.8 + 1) * float;
    // Flap suggestion: nose-up kick, a little stretch, and a soft pulse and rock in between.
    g.rotation.z = k * 0.2;
    g.rotation.x = dead ? 1.1 : beat * 0.05;
    g.scale.set(s * (1 - 0.04 * k), s * (1 + 0.07 * k + (dead ? 0 : beat * 0.025)), s);
  });

  const { palette } = avatar;
  return (
    <group {...props}>
      <FlameAura palette={palette} tailX={tail} glow={glow} lightIntensity={lightIntensity} />

      <group ref={wrap}>
        <group rotation={[0, 0, avatar.pitch]}>
          <group rotation={[0, avatar.facing, 0]}>
            <primitive
              object={prepared.root}
              scale={1}
              position={[-prepared.center.x, -prepared.center.y, -prepared.center.z]}
            />
          </group>
        </group>
      </group>
    </group>
  );
}
