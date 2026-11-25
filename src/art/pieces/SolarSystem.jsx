import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, CanvasTexture, Color, DataTexture, DoubleSide, LinearFilter, RepeatWrapping, SRGBColorSpace } from 'three';
import Glow from '../Glow.jsx';
import { POINT_FRAGMENT, dynamicUniforms, dynamicVertex } from '../shaders/pointFields.js';
import { coronaFragment, coronaUniforms, coronaVertex, plasmaFragment, plasmaUniforms, plasmaVertex } from '../shaders/plasma.js';
import { usePaletteColors } from '../usePalette.js';
import {
  PLANETS, SUN, beltPoints, colorizeField, moonPosition, orbitAngle, orbitLinePoints, orbitPosition, paletteStops, planetField, ringGeometry, ringStrip, starPoints,
} from '../geometry/solarSystem.js';

/**
 * Solar System: a showcase, not to scale. The Sun is the plasma shader with a corona and a real point light, so the planets are
 * lit from the middle and have night sides. Each planet wears a texture painted procedurally (see `planetField`) in its natural
 * colours or in the palette, sits on an elliptical orbit with the Sun at one focus, and turns on a tilted axis (Uranus on its
 * side, Venus backwards). Earth has a moon, Saturn and Uranus have rings, and the asteroid belt lies between Mars and Jupiter.
 */

const NATURAL_SUN = ['#b3270a', '#ff6a1a', '#ffc04d', '#fff1c9'];
const hex = (c) => `#${c.getHexString()}`;

function dataTexture(bytes, w, h) {
  const tex = new DataTexture(bytes, w, h);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.generateMipmaps = false;
  tex.minFilter = tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** A name as a sprite that stays the same size on screen. */
function Label({ text, color, y }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const g = c.getContext('2d');
    g.font = '600 30px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,0.9)';
    g.shadowBlur = 6;
    g.fillStyle = '#ffffff';
    g.fillText(text, 128, 32);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [text]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <sprite position={[0, y, 0]} scale={[0.16, 0.04, 1]} renderOrder={10}>
      <spriteMaterial map={tex} color={color} transparent opacity={0.85} depthTest={false} depthWrite={false} sizeAttenuation={false} toneMapped={false} />
    </sprite>
  );
}

function Planet({ planet, index, clock, quality, natural, colors, light, spin, scale, labels }) {
  const w = quality === 'low' ? 128 : 256;
  const h = w / 2;
  const group = useRef();
  const body = useRef();
  const moon = useRef();
  const tmp = useMemo(() => [0, 0, 0], []);
  const field = useMemo(() => planetField(planet, w, h), [planet, w, h]);
  const stops = useMemo(() => {
    if (natural) return planet.stops;
    const rot = colors.map((_, i) => colors[(i + index) % colors.length]);
    return paletteStops(rot.map(hex));
  }, [natural, planet, colors, index]);
  const map = useMemo(() => dataTexture(colorizeField(field, stops), w, h), [field, stops, w, h]);
  const ringMap = useMemo(() => (planet.rings ? dataTexture(ringStrip(128, stops, planet.rings.faint), 128, 1) : null), [planet, stops]);
  const ringGeo = useMemo(() => (planet.rings ? ringGeometry({ ...planet.rings, segments: quality === 'low' ? 48 : 96 }) : null), [planet, quality]);
  const halo = useMemo(coronaUniforms, []);
  useEffect(() => () => map.dispose(), [map]);
  useEffect(() => () => ringMap?.dispose(), [ringMap]);
  useEffect(() => () => ringGeo?.dispose(), [ringGeo]);
  useEffect(() => {
    halo.uColor.value.set(natural && planet.atmosphere ? planet.atmosphere : light);
    halo.uPower.value = 3;
    halo.uIntensity.value = 0.9;
  }, [halo, planet, natural, light]);

  const seg = quality === 'low' ? 24 : 48;
  const r = planet.radius * scale;
  useFrame(() => {
    const t = clock.current.t;
    orbitPosition(planet, orbitAngle(planet, t), tmp);
    group.current?.position.set(tmp[0], tmp[1], tmp[2]);
    if (body.current) body.current.rotation.y = planet.phase + t * planet.spin * spin * 0.6;
    if (moon.current && planet.moon) {
      moonPosition(planet.moon, t, tmp);
      moon.current.position.set(tmp[0] * scale, tmp[1], tmp[2] * scale);
    }
  });

  return (
    <group ref={group}>
      <group rotation={[0, 0, planet.tilt]}>
        <mesh ref={body} scale={r}>
          <sphereGeometry args={[1, seg, seg / 2]} />
          <meshStandardMaterial map={map} roughness={planet.kind === 'gas' ? 0.75 : 0.95} metalness={0} envMapIntensity={0.15} />
        </mesh>
        {planet.atmosphere && (
          <mesh scale={r * 1.12}>
            <sphereGeometry args={[1, 32, 16]} />
            <shaderMaterial uniforms={halo} vertexShader={coronaVertex} fragmentShader={coronaFragment} side={BackSide} transparent depthWrite={false} blending={AdditiveBlending} />
          </mesh>
        )}
        {ringGeo && (
          <mesh geometry={ringGeo} scale={r} renderOrder={2}>
            <meshStandardMaterial map={ringMap} transparent side={DoubleSide} depthWrite={false} roughness={1} emissive="#ffffff" emissiveMap={ringMap} emissiveIntensity={0.08} />
          </mesh>
        )}
      </group>
      {planet.moon && (
        <mesh ref={moon} scale={planet.moon.radius * scale}>
          <sphereGeometry args={[1, 20, 12]} />
          <meshStandardMaterial color="#b9b6b0" roughness={1} envMapIntensity={0.1} />
        </mesh>
      )}
      {labels && <Label text={planet.name} color={light} y={r * (planet.rings ? 2.4 : 1) + 0.55} />}
    </group>
  );
}

function Orbit({ planet, color }) {
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(orbitLinePoints(planet, 180), 3));
    return g;
  }, [planet]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <lineLoop geometry={geo}>
      <lineBasicMaterial color={color} transparent opacity={0.22} depthWrite={false} />
    </lineLoop>
  );
}

/** Round, soft points (the shared point shader) from positions, a colour per point and a size per point. */
function Dust({ positions, sizes, colorOf, pixel, alpha, group }) {
  const geo = useMemo(() => {
    const n = sizes.length;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const c = colorOf(i);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(positions, 3));
    g.setAttribute('aColor', new BufferAttribute(col, 3));
    g.setAttribute('aSize', new BufferAttribute(sizes, 1));
    return g;
  }, [positions, sizes, colorOf]);
  const uniforms = useMemo(dynamicUniforms, []);
  useEffect(() => () => geo.dispose(), [geo]);
  uniforms.uPixel.value = pixel;
  uniforms.uAlpha.value = alpha;
  return (
    <points ref={group} geometry={geo} frustumCulled={false}>
      <shaderMaterial uniforms={uniforms} vertexShader={dynamicVertex} fragmentShader={POINT_FRAGMENT} transparent depthWrite={false} blending={AdditiveBlending} />
    </points>
  );
}

export default function SolarSystem({ params, palette, clock, quality }) {
  const { orbits, labels, colours, belt, spin, planetScale, sunGlow, tilt } = params;
  const natural = colours === 'natural';
  const { colors, accent, light } = usePaletteColors(palette);
  const low = quality === 'low';
  const pixel = useThree((s) => s.gl.getPixelRatio());
  const sun = useRef();
  const corona = useRef();
  const lamp = useRef();
  const beltGroup = useRef();
  const surface = useMemo(plasmaUniforms, []);
  const halo = useMemo(coronaUniforms, []);
  const white = useMemo(() => new Color('#ffffff'), []);

  useEffect(() => {
    const c = natural ? NATURAL_SUN.map((h) => new Color(h)) : [colors[3], colors[0], colors[1], colors[2]];
    surface.uColDark.value.copy(c[0]);
    surface.uColA.value.copy(c[1]);
    surface.uColB.value.copy(c[2]);
    surface.uColHot.value.copy(c[3]).lerp(white, 0.4);
    halo.uColor.value.copy(natural ? new Color('#ff8a2a') : accent);
  }, [surface, halo, colors, accent, natural, white]);

  const beltData = useMemo(() => beltPoints({ count: low ? 900 : 2800 }), [low]);
  const beltSizes = useMemo(() => Float32Array.from(beltData.rands, (r) => 0.25 + r * 0.55), [beltData]);
  const beltColor = useMemo(() => {
    const c = new Color();
    return (i) => c.set(natural ? '#a89a88' : hex(colors[i % 3])).lerp(white, natural ? 0 : 0.15).multiplyScalar(0.6 + beltData.rands[i] * 0.6).clone();
  }, [natural, colors, white, beltData]);
  const stars = useMemo(() => starPoints({ count: low ? 700 : 1800 }), [low]);
  const starColor = useMemo(() => (i) => new Color('#ffffff').lerp(light, 0.25 + 0.4 * ((i * 37) % 10) / 10).multiplyScalar(stars.brightness[i]), [stars, light]);
  const starSizes = stars.sizes;

  useFrame(() => {
    const t = clock.current.t;
    surface.uTime.value = t;
    surface.uAmp.value = 0.012;
    surface.uScale.value = 1.6;
    surface.uBoil.value = 0.6;
    surface.uCore.value = 0.7 + 0.5 * sunGlow;
    halo.uIntensity.value = sunGlow * 1.1;
    halo.uPower.value = 2.4;
    if (sun.current) sun.current.rotation.y = t * 0.05;
    if (corona.current) corona.current.scale.setScalar(SUN.radius * 1.35 * (1 + 0.02 * Math.sin(t * 1.4)));
    if (lamp.current) lamp.current.intensity = 55 + 8 * Math.sin(t * 1.1);
    if (beltGroup.current) beltGroup.current.rotation.y = t * 0.03;
  });

  return (
    <group>
      <ambientLight intensity={0.12} />
      <pointLight ref={lamp} color={natural ? '#fff0d8' : light} distance={0} decay={1.2} />
      <Dust positions={stars.positions} sizes={starSizes} colorOf={starColor} pixel={pixel * 2.5} alpha={0.9} />

      <group rotation={[tilt, 0, 0]}>
        <mesh ref={sun} scale={SUN.radius}>
          <icosahedronGeometry args={[1, low ? 14 : 30]} />
          <shaderMaterial uniforms={surface} vertexShader={plasmaVertex} fragmentShader={plasmaFragment} />
        </mesh>
        <mesh ref={corona}>
          <sphereGeometry args={[1, 40, 24]} />
          <shaderMaterial uniforms={halo} vertexShader={coronaVertex} fragmentShader={coronaFragment} side={BackSide} transparent depthWrite={false} blending={AdditiveBlending} />
        </mesh>
        {sunGlow > 0 && <Glow color={natural ? '#ff9a3a' : palette.colors[0]} size={SUN.radius * 5} opacity={0.35 * Math.min(sunGlow, 1.5)} />}
        {labels && <Label text="Sun" color={light} y={-SUN.radius * 1.6 - 0.4} />}

        {PLANETS.map((p, i) => (
          <Planet key={p.id} planet={p} index={i} clock={clock} quality={quality} natural={natural} colors={colors} light={light} spin={spin} scale={planetScale} labels={labels} />
        ))}
        {orbits && PLANETS.map((p) => <Orbit key={p.id} planet={p} color={light} />)}
        {belt && (
          <group ref={beltGroup}>
            <Dust positions={beltData.positions} sizes={beltSizes} colorOf={beltColor} pixel={pixel * 1.8} alpha={1} />
          </group>
        )}
      </group>
    </group>
  );
}
