import type { MeshBasicMaterial, Texture } from 'three';

/** Quality is selected once per scene, avoiding shader work on small/expensive displays. */
export function stageOcclusionSamples(width: number, devicePixelRatio: number): number {
  if (width < 680 || devicePixelRatio > 2) return 0;
  return width < 1100 || devicePixelRatio > 1.5 ? 8 : 16;
}

interface StageOcclusionState {
  readonly scale: { value: number };
  readonly baseScale: number;
}

const materialStates = new WeakMap<MeshBasicMaterial, StageOcclusionState>();

/**
 * Adds per-fragment relief to the existing CPU-displaced island mesh.
 * This only self-occludes within one RGBA/depth pair: separate layer ordering
 * remains the responsibility of the stage renderer.
 */
export function enableStageOcclusion(
  material: MeshBasicMaterial,
  heightMap: Texture,
  relief: number,
  samples: number,
): void {
  if (samples === 0) return;

  // Both meshes and shaders share the depth map. Keep the shader relief subtle
  // so the two effects do not double the apparent depth of the illustration.
  const state: StageOcclusionState = {
    scale: { value: 0 },
    baseScale: Math.min(0.032, relief * 0.045),
  };
  materialStates.set(material, state);

  material.onBeforeCompile = (shader) => {
    shader.uniforms['stageHeightMap'] = { value: heightMap };
    shader.uniforms['stageParallaxScale'] = state.scale;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vStageViewRay;',
      )
      .replace(
        '#include <project_vertex>',
        // mvPosition is defined by project_vertex; transpose works for our
        // uniformly scaled, billboard-oriented meshes.
        '#include <project_vertex>\nvStageViewRay = transposeMat3(mat3(modelViewMatrix)) * (-mvPosition.xyz);',
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform sampler2D stageHeightMap;
         uniform float stageParallaxScale;
         varying vec3 vStageViewRay;`,
      )
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
           vec2 stageUv = vMapUv;
           vec4 originalColor = texture2D(map, vMapUv);
           vec3 stageView = normalize(vStageViewRay);
           if (stageParallaxScale > 0.00001 && stageView.z > 0.22 && originalColor.a > 0.02) {
             // Ray march from the top of the height field down to the first
             // visible surface. White is near, black is far.
             float layers = float(${samples});
             float layerStep = 1.0 / layers;
             vec2 texelStep = (stageView.xy / max(stageView.z, 0.22))
               * (stageParallaxScale / layers);
             vec2 rayUv = vMapUv;
             float rayDepth = 0.0;
             float sampledHeight = texture2D(stageHeightMap, rayUv).r;
             for (int i = 0; i < ${samples}; i++) {
               if (rayDepth >= 1.0 - sampledHeight) break;
               rayUv -= texelStep;
               rayDepth += layerStep;
               sampledHeight = texture2D(stageHeightMap, clamp(rayUv, 0.0, 1.0)).r;
             }
             // Interpolate across the first intersection to avoid stair stepping.
             vec2 previousUv = rayUv + texelStep;
             float previousHeight = texture2D(stageHeightMap, clamp(previousUv, 0.0, 1.0)).r;
             float after = max(0.0, rayDepth - (1.0 - sampledHeight));
             float before = max(0.0, (1.0 - previousHeight) - (rayDepth - layerStep));
             float weight = after / max(0.00001, after + before);
             vec2 intersectionUv = mix(rayUv, previousUv, weight);
             if (all(greaterThanEqual(intersectionUv, vec2(0.0))) &&
                 all(lessThanEqual(intersectionUv, vec2(1.0)))) {
               stageUv = intersectionUv;
             }
           }
           vec4 displacedColor = texture2D(map, stageUv);
           // Keep the original silhouette fixed. POM cannot reconstruct
           // missing side surfaces or background pixels around translucent hair.
           float safeInterior = smoothstep(0.8, 0.99, originalColor.a)
             * smoothstep(0.2, 0.7, displacedColor.a);
           diffuseColor *= mix(originalColor, displacedColor, safeInterior);
         #endif`,
      );
  };
  material.customProgramCacheKey = () => `mimishow-stage-pom-${samples}-v1`;
}

/** Called by the orbit renderer; side islands stay on inexpensive mesh relief. */
export function setStageOcclusionFocus(material: MeshBasicMaterial, focus: number): void {
  const state = materialStates.get(material);
  if (state) state.scale.value = state.baseScale * Math.max(0, Math.min(1, focus));
}
