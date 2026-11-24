import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Object3D } from 'three';
import Glow from '../Glow.jsx';
import { petalGeometry } from '../geometry/petal.js';
import { createRng } from '../noise.js';
import { POINT_FRAGMENT, dynamicUniforms, dynamicVertex } from '../shaders/pointFields.js';
import { usePaletteColors } from '../usePalette.js';

const MAX_STAMENS = 48;

/**
 * Bioluminescent Lotus: rings of low-poly petals (each a flat-shaded curved sheet) that slowly open and close, with the
 * rings breathing slightly out of step, round a ring of stamens whose glowing tips pulse. The petals are tilted about their
 * bases each frame (cheap: only their rotation changes); the tips are drawn as glowing points.
 */
export default function Lotus({ params, palette, clock, quality }) {
  const { petals, layers, bloom, curl, length, stamens, glow } = params;
  const { colors, accent } = usePaletteColors(palette);
  const pixel = useThree((s) => s.gl.getPixelRatio());
  const group = useRef();
  const tilts = useRef([]);
  const stalks = useRef();
  const light = useRef();
  const low = quality === 'low';

  const petal = useMemo(() => petalGeometry({ length, width: length * 0.62, curl, rows: low ? 4 : 6, cols: low ? 2 : 3 }), [length, curl, low]);
  useEffect(() => () => petal.dispose(), [petal]);

  // One material per ring: the outer ring darker and redder, the inner ones lighter, all faintly self-lit.
  const materials = useMemo(
    () =>
      Array.from({ length: layers }, (_, l) => {
        const k = layers === 1 ? 0 : l / (layers - 1);
        return {
          color: new Color().copy(colors[1]).lerp(colors[2], k),
          emissive: new Color().copy(colors[0]).lerp(colors[1], k),
        };
      }),
    [colors, layers],
  );

  // Where every stamen stands (a ring round the centre), made once per count.
  const stamenSpots = useMemo(() => {
    const rng = createRng(5);
    return Array.from({ length: MAX_STAMENS }, (_, i) => {
      const a = (i / MAX_STAMENS) * Math.PI * 2 + rng() * 0.4;
      const r = 0.12 + rng() * 0.3;
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, h: 0.55 + rng() * 0.35, lean: 0.12 + rng() * 0.2, phase: rng() * 6.28 };
    });
  }, []);

  const tipGeo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(MAX_STAMENS * 3), 3));
    g.setAttribute('aColor', new BufferAttribute(new Float32Array(MAX_STAMENS * 3), 3));
    g.setAttribute('aSize', new BufferAttribute(new Float32Array(MAX_STAMENS), 1));
    return g;
  }, []);
  useEffect(() => () => tipGeo.dispose(), [tipGeo]);
  const uniforms = useMemo(dynamicUniforms, []);
  const water = useMemo(() => new Color().copy(colors[3]).multiplyScalar(0.14), [colors]);
  const tipColor = useMemo(() => new Color().copy(colors[2]).lerp(new Color('#ffffff'), 0.4), [colors]);

  // The stalks stand still; set their matrices when the count changes.
  useEffect(() => {
    const dummy = new Object3D();
    for (let i = 0; i < stamens; i++) {
      const s = stamenSpots[i];
      dummy.position.set(s.x, s.h / 2, s.z);
      dummy.rotation.set(s.z * s.lean * 2, 0, -s.x * s.lean * 2);
      dummy.scale.set(1, s.h, 1);
      dummy.updateMatrix();
      stalks.current?.setMatrixAt(i, dummy.matrix);
    }
    if (stalks.current) stalks.current.instanceMatrix.needsUpdate = true;
  }, [stamens, stamenSpots]);

  useFrame(() => {
    const t = clock.current.t;
    if (group.current) group.current.rotation.y = t * 0.05;
    // Petals: each ring opens and closes a little out of step with the one inside it.
    tilts.current.forEach((g) => {
      if (!g) return;
      const l = g.userData.layer;
      const outer = layers === 1 ? 1 : 1 - l / (layers - 1);
      const open = 0.5 + 0.5 * Math.sin(t * 0.5 - l * 0.4);
      g.rotation.x = 0.14 + outer * 0.55 + bloom * open * (0.55 + outer * 0.5);
    });
    // Stamen tips pulse.
    uniforms.uPixel.value = pixel;
    uniforms.uAlpha.value = Math.min(1, 0.45 + glow * 0.45);
    const pos = tipGeo.attributes.position;
    const col = tipGeo.attributes.aColor;
    const sz = tipGeo.attributes.aSize;
    for (let i = 0; i < MAX_STAMENS; i++) {
      if (i >= stamens) {
        sz.setX(i, 0);
        continue;
      }
      const s = stamenSpots[i];
      const pulse = 0.5 + 0.5 * Math.sin(t * 2 + s.phase);
      pos.setXYZ(i, s.x + s.x * s.lean * 2.4 * (s.h / 0.8), s.h * 0.98, s.z + s.z * s.lean * 2.4 * (s.h / 0.8));
      col.setXYZ(i, tipColor.r, tipColor.g, tipColor.b);
      sz.setX(i, (0.7 + 1.1 * pulse) * (0.5 + glow * 0.5));
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    sz.needsUpdate = true;
    if (light.current) light.current.intensity = glow * (0.9 + 0.5 * Math.sin(t * 2));
  });

  return (
    <group>
      <group ref={group}>
        {Array.from({ length: layers }, (_, l) => {
          const n = petals + (l % 2);
          return Array.from({ length: n }, (_, i) => (
            <group key={`${l}-${i}`} rotation-y={(i / n) * Math.PI * 2 + l * (Math.PI / n)} scale={1 - l * 0.11}>
              <group ref={(g) => g && ((g.userData.layer = l), (tilts.current[`${l}-${i}`] = g))}>
                <mesh geometry={petal}>
                  <meshStandardMaterial
                    color={materials[l].color}
                    emissive={materials[l].emissive}
                    emissiveIntensity={0.3 * glow}
                    flatShading
                    roughness={0.55}
                    metalness={0.1}
                    side={2}
                  />
                </mesh>
              </group>
            </group>
          ));
        })}
        <instancedMesh key={`s${stamens}`} ref={stalks} args={[undefined, undefined, stamens]} frustumCulled={false}>
          <cylinderGeometry args={[0.01, 0.014, 1, 5]} />
          <meshStandardMaterial color={colors[2]} emissive={accent} emissiveIntensity={0.3 * glow} />
        </instancedMesh>
        <points geometry={tipGeo} frustumCulled={false}>
          <shaderMaterial uniforms={uniforms} vertexShader={dynamicVertex} fragmentShader={POINT_FRAGMENT} transparent depthWrite={false} blending={AdditiveBlending} />
        </points>
        <pointLight ref={light} color={accent} position={[0, 0.9, 0]} distance={4} decay={2} />
      </group>
      <Glow color={palette.accent} position={[0, 0.5, 0]} size={3.4} opacity={0.18 * glow} />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.03}>
        <circleGeometry args={[2.4, 48]} />
        <meshStandardMaterial color={water} emissive={water} emissiveIntensity={0.25} metalness={0.3} roughness={0.35} envMapIntensity={0.3} />
      </mesh>
    </group>
  );
}
