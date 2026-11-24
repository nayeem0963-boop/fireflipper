import { AdditiveBlending, CanvasTexture, SRGBColorSpace } from 'three';

/** One soft white round glow, shared by every halo (created on first use). Tinted per sprite by `color`. */
let texture = null;
function glowTexture() {
  if (texture) return texture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.14)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * A halo: an additive, unlit sprite. This is the Art Lab's dependency-free stand-in for bloom: bright things get a
 * glow without a postprocessing pass.
 */
export default function Glow({ color = '#ffffff', size = 1, opacity = 0.8, ...props }) {
  return (
    <sprite scale={[size, size, 1]} renderOrder={5} {...props}>
      <spriteMaterial map={glowTexture()} color={color} transparent opacity={opacity} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
    </sprite>
  );
}
