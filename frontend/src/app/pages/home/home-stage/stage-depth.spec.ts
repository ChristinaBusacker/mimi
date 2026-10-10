import { PlaneGeometry } from 'three';

import { applyStageDepth } from './stage-depth';

describe('Stage depth geometry', () => {
  it('raises white pixels closer to the viewer than black pixels', () => {
    const geometry = new PlaneGeometry(2, 2, 1, 1);
    const pixels = new Uint8ClampedArray([
      255, 255, 255, 255, 0, 0, 0, 255,
      255, 255, 255, 255, 0, 0, 0, 255,
    ]);
    applyStageDepth(geometry, pixels, 2, 2, 1);
    const position = geometry.getAttribute('position');
    expect(position.getZ(0)).toBeCloseTo(0.5);
    expect(position.getZ(1)).toBeCloseTo(-0.5);
    expect(position.getZ(2)).toBeCloseTo(0.5);
    expect(position.getZ(3)).toBeCloseTo(-0.5);
    geometry.dispose();
  });

  it('rejects a truncated or invalid depth image', () => {
    const geometry = new PlaneGeometry(2, 2);
    expect(() => applyStageDepth(geometry, new Uint8ClampedArray(2), 2, 2, 1)).toThrow();
    geometry.dispose();
  });
});
