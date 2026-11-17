import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { AdditiveBlending, Box3, Euler, Matrix4, Vector3 } from 'three';
import { modelUrl } from '../../systems/avatars/avatars.js';
import { getGlowTexture } from '../../utils/textures.js';
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

/** Trail of glows behind the bird: [x offset, size, opacity], brightest at the bird. */
const FLAME_PUFFS = [
  [-0.1, 1.5, 0.75],
  [-0.55, 1.35, 0.6],
  [-1.0, 1.15, 0.5],
  [-1.4, 0.95, 0.4],
  [-1.75, 0.75, 0.3],
  [-2.05, 0.55, 0.2],
];

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
  const glowMap = useMemo(getGlowTexture, []);
  const wrap = useRef();
  const flame = useRef();
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

    // Flame tail: three tongues that flicker in length and sway.
    flame.current?.children.forEach((puff, i) => {
      const flick = 0.85 + 0.2 * Math.sin(t * 17 + i * 2.1) + 0.08 * Math.sin(t * 29 + i);
      const { size, x } = puff.userData;
      puff.scale.set(size * flick, size * 0.55 * flick, 1);
      puff.position.y = Math.sin(t * 7 + i * 1.7) * 0.06 * (i + 1) * 0.4;
      puff.position.x = x * (0.95 + 0.08 * Math.sin(t * 11 + i));
    });
  });

  const { palette } = avatar;
  return (
    <group {...props}>
      {/* Further out and gentler than the original bird's light: these models are bigger and would blow out */}
      <pointLight
        color={palette.glow}
        intensity={lightIntensity * 0.55}
        distance={9}
        decay={1.6}
        position={[0.2, 0.6, 2.4]}
      />
      <sprite scale={[4.2, 4.2, 1]} renderOrder={-1}>
        <spriteMaterial
          map={glowMap}
          color={palette.glow}
          transparent
          opacity={glow}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </sprite>

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

      {/* Flame tail: a comet of soft glows trailing behind the bird, flickering in size */}
      <group ref={flame} position={[tail * 0.9, 0, 0]}>
        {FLAME_PUFFS.map(([x, size, opacity], i) => (
          <sprite key={i} position={[x, 0, 0]} scale={[size, size * 0.55, 1]} userData={{ size, x }}>
            <spriteMaterial
              map={glowMap}
              color={i < 2 ? palette.high : i < 4 ? palette.mid : palette.low}
              transparent
              opacity={opacity}
              depthWrite={false}
              blending={AdditiveBlending}
              toneMapped={false}
            />
          </sprite>
        ))}
      </group>
    </group>
  );
}
