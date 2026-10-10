import { MeshBasicMaterial, Texture } from 'three';

import {
  enableStageOcclusion,
  setStageOcclusionFocus,
  stageOcclusionSamples,
} from './stage-occlusion-material';

describe('Stage occlusion shader', () => {
  it('uses mesh-only relief on narrow or high-DPR screens', () => {
    expect(stageOcclusionSamples(390, 2)).toBe(0);
    expect(stageOcclusionSamples(1600, 3)).toBe(0);
  });

  it('selects a limited ray count on larger screens', () => {
    expect(stageOcclusionSamples(800, 1)).toBe(8);
    expect(stageOcclusionSamples(1600, 1)).toBe(16);
    expect(stageOcclusionSamples(1600, 1.75)).toBe(8);
  });

  it('injects view-dependent relief without replacing the base material', () => {
    const material = new MeshBasicMaterial({ transparent: true, alphaTest: 0.035 });
    const heightMap = new Texture();
    enableStageOcclusion(material, heightMap, 0.6, 8);
    setStageOcclusionFocus(material, 1);
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: '#include <common>\n#include <project_vertex>',
      fragmentShader: '#include <common>\n#include <map_fragment>',
    };
    // Shader compilation is browser-only; test the injected GLSL and uniforms.
    material.onBeforeCompile(shader as Parameters<typeof material.onBeforeCompile>[0], {} as never);
    expect(shader.vertexShader).toContain('vStageViewRay');
    expect(shader.fragmentShader).toContain('rayDepth');
    expect(shader.uniforms['stageParallaxScale'].value).toBeCloseTo(0.027);
    setStageOcclusionFocus(material, 0);
    expect(shader.uniforms['stageParallaxScale'].value).toBe(0);
    material.dispose();
    heightMap.dispose();
  });
});
