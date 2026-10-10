import { PlaneGeometry } from 'three';

/**
 * Displaces a subdivided plane from an aligned grayscale depth image.
 * White is close to the camera and black is far away. Sampling normalized UVs
 * deliberately tolerates the small dimension differences between RGB and depth images.
 */
export function applyStageDepth(
  geometry: PlaneGeometry,
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  relief: number,
): void {
  if (width < 2 || height < 2 || rgba.length < width * height * 4) {
    throw new Error('Invalid stage depth image');
  }

  const positions = geometry.getAttribute('position');
  const uvs = geometry.getAttribute('uv');
  const sample = (x: number, y: number): number => {
    const offset = (y * width + x) * 4;
    return rgba[offset] / 255;
  };

  for (let i = 0; i < positions.count; i++) {
    const x = Math.max(0, Math.min(width - 1, uvs.getX(i) * (width - 1)));
    const y = Math.max(0, Math.min(height - 1, (1 - uvs.getY(i)) * (height - 1)));
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);
    const fx = x - x0;
    const fy = y - y0;
    const top = sample(x0, y0) * (1 - fx) + sample(x1, y0) * fx;
    const bottom = sample(x0, y1) * (1 - fx) + sample(x1, y1) * fx;
    positions.setZ(i, (top * (1 - fy) + bottom * fy - 0.5) * relief);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
}
