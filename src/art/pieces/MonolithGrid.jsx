import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BoxGeometry, Color, DoubleSide, EdgesGeometry } from 'three';
import Glow from '../Glow.jsx';
import { terrainFragment, terrainUniforms, terrainVertex } from '../shaders/terrain.js';
import { usePaletteColors } from '../usePalette.js';

const SIZE = 28;
const TERRAIN_Y = -1.2;

/**
 * Monolith Grid: a polished obsidian slab with glowing edges, hovering over a neon wireframe terrain. The terrain is a plane
 * displaced in its vertex shader by drifting noise, with grid lines drawn in the fragment shader; moving the pointer over it
 * sends a ring of ripples spreading from that point. Fewer vertices on the low quality tier.
 */
export default function MonolithGrid({ params, palette, clock, quality }) {
  const { height, cells, drift, ripple, hover, glow, edges } = params;
  const { colors, accent } = usePaletteColors(palette);
  const slab = useRef();
  const light = useRef();
  const seg = quality === 'low' ? 90 : 170;

  const box = useMemo(() => new BoxGeometry(1.3, 2.7, 0.32), []);
  const edgeGeo = useMemo(() => new EdgesGeometry(box), [box]);
  useEffect(
    () => () => {
      box.dispose();
      edgeGeo.dispose();
    },
    [box, edgeGeo],
  );

  const uniforms = useMemo(terrainUniforms, []);
  useEffect(() => {
    uniforms.uColA.value.copy(colors[3]);
    uniforms.uColB.value.copy(colors[1]).lerp(accent, 0.4);
    uniforms.uEdge.value = SIZE;
  }, [uniforms, colors, accent]);
  const edgeColor = useMemo(() => new Color().copy(accent).lerp(new Color('#ffffff'), 0.5), [accent]);

  useFrame(() => {
    const t = clock.current.t;
    uniforms.uTime.value = t;
    uniforms.uHeight.value = height;
    uniforms.uRipple.value = ripple;
    uniforms.uScroll.value = drift;
    uniforms.uCells.value = cells;
    uniforms.uGlow.value = glow;
    if (slab.current) {
      slab.current.position.y = 0.95 + hover * 0.35 * Math.sin(t * 0.9);
      slab.current.rotation.y = t * 0.2;
      slab.current.rotation.z = Math.sin(t * 0.5) * 0.04 * hover;
    }
    if (light.current) light.current.intensity = glow * 14;
  });

  return (
    <group>
      {/* The terrain: built in x/y, turned flat. An invisible plane over it catches the pointer. */}
      <mesh rotation-x={-Math.PI / 2} position-y={TERRAIN_Y} frustumCulled={false}>
        <planeGeometry args={[SIZE, SIZE, seg, seg]} />
        <shaderMaterial uniforms={uniforms} vertexShader={terrainVertex} fragmentShader={terrainFragment} transparent depthWrite={false} blending={AdditiveBlending} side={DoubleSide} />
      </mesh>
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={TERRAIN_Y}
        onPointerMove={(e) => uniforms.uMouse.value.set(e.point.x, 0, -e.point.z)}
        onPointerOut={() => uniforms.uMouse.value.set(999, 0, 999)}
      >
        <planeGeometry args={[SIZE * 0.6, SIZE * 0.6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group ref={slab}>
        <mesh geometry={box}>
          <meshPhysicalMaterial color="#0b0b14" metalness={0.5} roughness={0.12} clearcoat={1} clearcoatRoughness={0.04} envMapIntensity={6} emissive={accent} emissiveIntensity={0.03 * glow} />
        </mesh>
        {edges && (
          <>
            <lineSegments geometry={edgeGeo} scale={1.003}>
              <lineBasicMaterial color={edgeColor} toneMapped={false} />
            </lineSegments>
            <lineSegments geometry={edgeGeo} scale={1.015}>
              <lineBasicMaterial color={accent} transparent opacity={0.45 * Math.min(glow, 1.5)} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
            </lineSegments>
          </>
        )}
        <Glow color={palette.accent} size={4.2} opacity={0.22 * glow} position={[0, 0, -0.3]} />
      </group>
      <pointLight ref={light} color={accent} position={[0, TERRAIN_Y + 0.9, 0]} distance={9} decay={1.6} />
    </group>
  );
}
