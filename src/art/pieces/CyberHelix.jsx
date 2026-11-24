import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Object3D, Quaternion, TubeGeometry, Vector3 } from 'three';
import { helixCurve, helixPoint } from '../geometry/helix.js';
import { POINT_FRAGMENT, dynamicUniforms, dynamicVertex } from '../shaders/pointFields.js';
import { usePaletteColors } from '../usePalette.js';

const MAX_PULSES = 16;
const UP = new Vector3(0, 1, 0);

/**
 * Cyber Helix: two metal strands wound half a turn apart, joined by rungs, with a node at each rung end. Glowing pulses
 * race up one strand and down the other (their positions are computed along the helix each frame and drawn as glowing
 * points). The geometry is rebuilt only when a shape setting changes; the pulses and the slow turn run every frame.
 */
export default function CyberHelix({ params, palette, clock, quality }) {
  const { turns, radius, height, tube, rungs, pulses, metalness, glow } = params;
  const { colors, accent } = usePaletteColors(palette);
  const pixel = useThree((s) => s.gl.getPixelRatio());
  const group = useRef();
  const rungMesh = useRef();
  const nodeMesh = useRef();
  const low = quality === 'low';
  const shape = useMemo(() => ({ radius, turns, height }), [radius, turns, height]);

  const strands = useMemo(
    () => [0, 1].map((s) => new TubeGeometry(helixCurve({ ...shape, phase: s * Math.PI }, low ? 160 : 260), low ? 200 : 420, tube, low ? 6 : 10, false)),
    [shape, tube, low],
  );
  useEffect(() => () => strands.forEach((g) => g.dispose()), [strands]);

  // Rungs and nodes sit still, so their matrices are set once per shape change.
  useEffect(() => {
    const dummy = new Object3D();
    const a = new Vector3();
    const b = new Vector3();
    const dir = new Vector3();
    const q = new Quaternion();
    for (let i = 0; i < rungs; i++) {
      const u = (i + 0.5) / rungs;
      helixPoint(u, { ...shape, phase: 0 }, a);
      helixPoint(u, { ...shape, phase: Math.PI }, b);
      dir.subVectors(b, a);
      const len = dir.length();
      dummy.position.copy(a).add(b).multiplyScalar(0.5);
      dummy.quaternion.copy(q.setFromUnitVectors(UP, dir.normalize()));
      dummy.scale.set(1, len, 1);
      dummy.updateMatrix();
      rungMesh.current?.setMatrixAt(i, dummy.matrix);
      for (const [k, p] of [[0, a], [1, b]]) {
        dummy.position.copy(p);
        dummy.quaternion.identity();
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        nodeMesh.current?.setMatrixAt(i * 2 + k, dummy.matrix);
      }
    }
    if (rungMesh.current) rungMesh.current.instanceMatrix.needsUpdate = true;
    if (nodeMesh.current) nodeMesh.current.instanceMatrix.needsUpdate = true;
  }, [shape, rungs]);

  // The pulses: up to 16 per strand, drawn as glowing points whose positions change every frame.
  const pulseGeo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(MAX_PULSES * 2 * 3), 3));
    g.setAttribute('aColor', new BufferAttribute(new Float32Array(MAX_PULSES * 2 * 3), 3));
    g.setAttribute('aSize', new BufferAttribute(new Float32Array(MAX_PULSES * 2), 1));
    return g;
  }, []);
  useEffect(() => () => pulseGeo.dispose(), [pulseGeo]);
  const uniforms = useMemo(dynamicUniforms, []);
  const hot = useMemo(() => new Color().copy(colors[2]).lerp(new Color('#ffffff'), 0.5), [colors]);
  const point = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const t = clock.current.t;
    if (group.current) group.current.rotation.y = t * 0.3;
    uniforms.uPixel.value = pixel;
    uniforms.uAlpha.value = Math.min(1, 0.4 + glow * 0.5);
    const pos = pulseGeo.attributes.position;
    const col = pulseGeo.attributes.aColor;
    const sz = pulseGeo.attributes.aSize;
    for (let s = 0; s < 2; s++) {
      for (let j = 0; j < MAX_PULSES; j++) {
        const idx = s * MAX_PULSES + j;
        if (j >= pulses) {
          sz.setX(idx, 0);
          continue;
        }
        const dir = s === 0 ? 1 : -1; // up one strand, down the other
        const u = (((t * 0.1 * dir + j / pulses) % 1) + 1) % 1;
        helixPoint(u, { ...shape, phase: s * Math.PI }, point);
        pos.setXYZ(idx, point.x, point.y, point.z);
        const c = s === 0 ? hot : colors[1];
        col.setXYZ(idx, c.r, c.g, c.b);
        sz.setX(idx, (1.3 + 0.5 * Math.sin(t * 5 + j * 1.7)) * (0.4 + glow * 0.6));
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    sz.needsUpdate = true;
  });

  return (
    <group ref={group}>
      {strands.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color={colors[i === 0 ? 1 : 0]} metalness={metalness} roughness={0.25} emissive={colors[0]} emissiveIntensity={0.12 * glow} envMapIntensity={1.4} />
        </mesh>
      ))}
      <instancedMesh key={`r${rungs}`} ref={rungMesh} args={[undefined, undefined, rungs]} frustumCulled={false}>
        <cylinderGeometry args={[0.022, 0.022, 1, 6]} />
        <meshStandardMaterial color={colors[2]} metalness={metalness} roughness={0.3} emissive={accent} emissiveIntensity={0.25 * glow} />
      </instancedMesh>
      <instancedMesh key={`n${rungs}`} ref={nodeMesh} args={[undefined, undefined, rungs * 2]} frustumCulled={false}>
        <sphereGeometry args={[tube * 1.5, 12, 10]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </instancedMesh>
      <points geometry={pulseGeo} frustumCulled={false}>
        <shaderMaterial uniforms={uniforms} vertexShader={dynamicVertex} fragmentShader={POINT_FRAGMENT} transparent depthWrite={false} blending={AdditiveBlending} />
      </points>
    </group>
  );
}
