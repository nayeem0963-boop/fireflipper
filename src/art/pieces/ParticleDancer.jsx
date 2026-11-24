import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color } from 'three';
import Glow from '../Glow.jsx';
import { dancerPoints } from '../geometry/dancer.js';
import { terrainHeight } from '../geometry/landscape.js';
import { RIBBON_HEIGHT, ribbonPoint } from '../geometry/ribbons.js';
import { createRng } from '../noise.js';
import { dancerUniforms, dancerVertex, moteUniforms, moteVertex } from '../shaders/dancer.js';
import { POINT_FRAGMENT, dynamicUniforms, dynamicVertex } from '../shaders/pointFields.js';
import { usePaletteColors } from '../usePalette.js';

/** The colours of the picture, feet to hand: blue, electric purple, magenta, gold. */
const IMAGE_RAMP = ['#2f6bff', '#8a3dff', '#ff3fd0', '#ffc34a'];
const TERRAIN_SIZE = 20;

/** The colour at height `h` (0 feet to 1 top) along a four-stop ramp, written into `out`. Matches the dancer shader's ramp. */
function sampleRamp(ramp, h, out) {
  if (h < 0.33) return out.copy(ramp[0]).lerp(ramp[1], h / 0.33);
  if (h < 0.66) return out.copy(ramp[1]).lerp(ramp[2], (h - 0.33) / 0.33);
  return out.copy(ramp[2]).lerp(ramp[3], (h - 0.66) / 0.34);
}

/**
 * Particle Dancer: a dancer in arabesque made entirely of glowing points, standing on rolling waves of points, with ribbons of
 * light swirling round her and embers rising through the dark.
 *  - the figure is a point cloud built in code (geometry/dancer.js) and drawn by a vertex shader that does all its motion (sway,
 *    breathing, a flowing skirt, shimmer): no solid mesh is ever drawn
 *  - the landscape is a grid of points whose heights are layered sine waves (geometry/landscape.js), rewritten every frame; the
 *    figure stands on its surface and rises and falls with it
 *  - the ribbons are glowing lines whose paths are recomputed every frame (geometry/ribbons.js)
 *  - the whole figure turns slowly; all time comes from the shared art clock, so Speed and Pause apply to everything
 * Colours: the picture's blue, purple, magenta and gold, or the active palette run through the same feet-to-hand gradient.
 */
export default function ParticleDancer({ params, palette, clock, quality }) {
  const { colours, density, size, shimmer, sway, spin, ribbons, waves, brightness } = params;
  const { colors } = usePaletteColors(palette);
  const pixel = useThree((s) => s.gl.getPixelRatio());
  const figure = useRef();
  const lines = useRef([]);
  const low = quality === 'low';
  const count = low ? Math.min(density, 14000) : density;
  const segments = low ? 48 : 90;

  // Feet-to-hand colours: the picture's, or the palette's (its darkest colour lightened so the feet still glow).
  const ramp = useMemo(
    () => (colours === 'image' ? IMAGE_RAMP.map((c) => new Color(c)) : [new Color().copy(colors[3]).lerp(colors[0], 0.45), colors[0].clone(), colors[1].clone(), colors[2].clone()]),
    [colours, colors],
  );

  // The dancer's points, made once per count.
  const body = useMemo(() => {
    const d = dancerPoints({ count });
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(d.positions, 3));
    g.setAttribute('aRand', new BufferAttribute(d.rands, 1));
    g.setAttribute('aKind', new BufferAttribute(d.kinds, 1));
    g.userData = { minY: d.minY, maxY: d.maxY };
    return g;
  }, [count]);
  useEffect(() => () => body.dispose(), [body]);
  const dancer = useMemo(dancerUniforms, []);
  useEffect(() => {
    dancer.uMinY.value = body.userData.minY;
    dancer.uMaxY.value = body.userData.maxY;
    dancer.uPixel.value = pixel;
    ramp.forEach((c, i) => dancer[`uC${i}`].value.copy(c));
  }, [dancer, body, pixel, ramp]);

  // The landscape: a square grid of points, heights and colours written each frame.
  const n = low ? 56 : 90;
  const spacing = TERRAIN_SIZE / n;
  const terrain = useMemo(() => {
    const positions = new Float32Array(n * n * 3);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const k = (i * n + j) * 3;
        positions[k] = (i - (n - 1) / 2) * spacing;
        positions[k + 2] = (j - (n - 1) / 2) * spacing;
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(positions, 3));
    g.setAttribute('aColor', new BufferAttribute(new Float32Array(n * n * 3), 3));
    g.setAttribute('aSize', new BufferAttribute(new Float32Array(n * n).fill(0.95), 1));
    return g;
  }, [n, spacing]);
  useEffect(() => () => terrain.dispose(), [terrain]);
  const waveLow = useMemo(() => (colours === 'image' ? new Color('#2f6bff') : ramp[1].clone()), [colours, ramp]);
  const waveHigh = useMemo(() => (colours === 'image' ? new Color('#8fd6ff') : new Color().copy(ramp[2]).lerp(new Color('#ffffff'), 0.2)), [colours, ramp]);
  const tint = useMemo(() => new Color(), []);
  const waveU = useMemo(dynamicUniforms, []);
  useEffect(() => {
    waveU.uPixel.value = pixel;
    waveU.uAlpha.value = 1;
  }, [waveU, pixel]);

  // Embers drifting up through the dark.
  const motes = useMemo(() => {
    const rng = createRng(21);
    const m = low ? 250 : 500;
    const positions = new Float32Array(m * 3);
    const rands = new Float32Array(m);
    for (let i = 0; i < m; i++) {
      positions[i * 3] = (rng() - 0.5) * 14;
      positions[i * 3 + 1] = -1 + rng() * 7;
      positions[i * 3 + 2] = (rng() - 0.5) * 14;
      rands[i] = rng();
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(positions, 3));
    g.setAttribute('aRand', new BufferAttribute(rands, 1));
    return g;
  }, [low]);
  useEffect(() => () => motes.dispose(), [motes]);
  const moteU = useMemo(moteUniforms, []);
  useEffect(() => {
    moteU.uColA.value.copy(ramp[3]);
    moteU.uColB.value.copy(ramp[2]);
    moteU.uPixel.value = pixel;
  }, [moteU, ramp, pixel]);

  // Ribbons: starting points, and the colour of each point from its height (set again when the colours change).
  const start = useMemo(() => Array.from({ length: segments + 1 }, (_, k) => ribbonPoint(0, k / segments, 0, [0, 0, 0])), [segments]);
  const startColors = useMemo(() => start.map(() => [1, 1, 1]), [start]);
  const flat = useMemo(() => new Float32Array((segments + 1) * 3), [segments]);
  useEffect(() => {
    const c = new Color();
    const colorArray = new Float32Array((segments + 1) * 3);
    for (let k = 0; k <= segments; k++) {
      sampleRamp(ramp, k / segments, c);
      colorArray.set([c.r, c.g, c.b], k * 3);
    }
    lines.current.forEach((l) => l?.geometry.setColors(colorArray));
  }, [ramp, ribbons, segments]);

  const point = useMemo(() => [0, 0, 0], []);
  useFrame(() => {
    const t = clock.current.t;
    dancer.uTime.value = t;
    dancer.uSize.value = size;
    dancer.uShimmer.value = shimmer;
    dancer.uSway.value = sway;
    dancer.uBright.value = brightness;
    moteU.uTime.value = t;
    moteU.uSize.value = size * 0.8;

    // The landscape rolls; the figure stands on it and turns slowly.
    const a = terrain.attributes.position.array;
    const c = terrain.attributes.aColor.array;
    const R = TERRAIN_SIZE / 2;
    for (let i = 0; i < a.length; i += 3) {
      const x = a[i];
      const z = a[i + 2];
      const y = terrainHeight(x, z, t, waves);
      a[i + 1] = y;
      const r = Math.hypot(x, z);
      const fade = r > R * 0.5 ? Math.max(0, 1 - (r - R * 0.5) / (R * 0.5)) : 1; // dims towards the edge
      tint.copy(waveLow).lerp(waveHigh, Math.min(1, Math.max(0, 0.5 + 0.55 * (y / (0.92 * Math.max(waves, 0.05))))));
      c[i] = tint.r * fade * brightness;
      c[i + 1] = tint.g * fade * brightness;
      c[i + 2] = tint.b * fade * brightness;
    }
    terrain.attributes.position.needsUpdate = true;
    terrain.attributes.aColor.needsUpdate = true;
    if (figure.current) {
      figure.current.rotation.y = t * spin * 0.3;
      figure.current.position.y = terrainHeight(0.05, 0, t, waves) - 0.02;
    }

    // The ribbons swirl.
    for (let i = 0; i < ribbons; i++) {
      const l = lines.current[i];
      if (!l) continue;
      for (let k = 0; k <= segments; k++) {
        ribbonPoint(i, k / segments, t, point);
        flat[k * 3] = point[0];
        flat[k * 3 + 1] = point[1];
        flat[k * 3 + 2] = point[2];
      }
      l.geometry.setPositions(flat);
    }
  });

  return (
    <group>
      <points geometry={terrain} frustumCulled={false}>
        <shaderMaterial uniforms={waveU} vertexShader={dynamicVertex} fragmentShader={POINT_FRAGMENT} transparent depthWrite={false} blending={AdditiveBlending} />
      </points>

      <group ref={figure}>
        <points geometry={body} frustumCulled={false}>
          <shaderMaterial uniforms={dancer} vertexShader={dancerVertex} fragmentShader={POINT_FRAGMENT} transparent depthWrite={false} blending={AdditiveBlending} />
        </points>
        {Array.from({ length: ribbons }, (_, i) => (
          <Line
            key={`${i}-${segments}`}
            ref={(l) => (lines.current[i] = l)}
            points={start}
            vertexColors={startColors}
            lineWidth={2.2}
            transparent
            opacity={0.7}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
            frustumCulled={false}
          />
        ))}
      </group>

      <points geometry={motes} frustumCulled={false}>
        <shaderMaterial uniforms={moteU} vertexShader={moteVertex} fragmentShader={POINT_FRAGMENT} transparent depthWrite={false} blending={AdditiveBlending} />
      </points>
      <Glow color={waveLow} position={[0, RIBBON_HEIGHT * 0.45, 0]} size={5} opacity={0.12 * brightness} />
    </group>
  );
}
