import {
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
} from 'three';
import type { Texture, WebGLRenderer } from 'three';

import { applyStageDepth } from './stage-depth';
import { enableStageOcclusion, stageOcclusionSamples } from './stage-occlusion-material';
import { STAGE_WORLDS, type StageWorld } from './stage-orbit';

interface LayerAsset {
  image: string;
  depth: string;
  relief: number;
  z: number;
  character?: boolean;
}

// The two PNGs must remain registered: their centers, transforms and Z origins match.
// The slight height difference in the depth files is handled by normalized UV sampling.
const WORLD_LAYERS: Record<StageWorld, readonly LayerAsset[]> = {
  music: [
    { image: 'music-island.webp', depth: 'music-island-depth.webp', relief: 1, z: 0 },
    {
      image: 'music-character.webp',
      depth: 'music-character-depth.webp',
      relief: 1.6,
      z: 0,
      character: true,
    },
  ],
  community: [{ image: 'community.webp', depth: 'community-depth.webp', relief: 1, z: 0 }],
  gaming: [
    { image: 'gaming-island.webp', depth: 'gaming-island-depth.webp', relief: 1, z: 0 },
    {
      image: 'gaming-character.webp',
      depth: 'gaming-character-depth.webp',
      relief: 1,
      z: 0,
      character: true,
    },
  ],
};

export interface StageIsland {
  group: Group;
  mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  meshes: Mesh<PlaneGeometry, MeshBasicMaterial>[];
  materials: MeshBasicMaterial[];
  shadow: Mesh<PlaneGeometry, MeshBasicMaterial>;
}

export interface StageVisuals {
  islands: StageIsland[];
  textures: Texture[];
}

function makeShadowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 3, 64, 64, 61);
    gradient.addColorStop(0, 'rgba(31, 8, 39, 0.46)');
    gradient.addColorStop(0.46, 'rgba(47, 16, 55, 0.19)');
    gradient.addColorStop(1, 'rgba(47, 16, 55, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new CanvasTexture(canvas);
}

function makeGeometry(depth: Texture | null, relief: number, character: boolean): PlaneGeometry {
  const geometry = new PlaneGeometry(4.8, 3.6, character ? 256 : 112, character ? 256 : 84);
  if (!depth) return geometry;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 384;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context) {
      context.drawImage(depth.image as HTMLImageElement, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      applyStageDepth(geometry, pixels.data, pixels.width, pixels.height, relief);
    }
  } catch {
    // A missing or unreadable depth map must never hide the image.
  }
  return geometry;
}

/** Builds a small 2.5D relief per island without additional network image layers. */
export async function createStageVisuals(renderer: WebGLRenderer): Promise<StageVisuals> {
  const loader = new TextureLoader();
  const textures: Texture[] = [];
  const islands: StageIsland[] = [];
  const shadowTexture = makeShadowTexture();
  textures.push(shadowTexture);
  const pomSamples = stageOcclusionSamples(
    renderer.domElement.clientWidth,
    renderer.getPixelRatio(),
  );

  try {
    // Load each island concurrently, preserving background-before-character ordering.
    const assets = await Promise.all(
      STAGE_WORLDS.map(async (world) =>
        Promise.all(
          WORLD_LAYERS[world].map(async (layer) => {
            const color = await loader.loadAsync(`/images/island/${layer.image}`);
            textures.push(color);
            let depth: Texture | null = null;
            try {
              depth = await loader.loadAsync(`/images/island/${layer.depth}`);
              if (pomSamples > 0) textures.push(depth);
            } catch {
              // Keep the RGB layer if only its optional depth map is missing.
            }
            return { layer, color, depth };
          }),
        ),
      ),
    );

    for (const [index, layers] of assets.entries()) {
      const group = new Group();
      const meshes: StageIsland['meshes'] = [];
      const materials: MeshBasicMaterial[] = [];
      for (const [layerIndex, { layer, color, depth }] of layers.entries()) {
        color.colorSpace = SRGBColorSpace;
        color.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
        const geometry = makeGeometry(depth, layer.relief, !!layer.character);
        const material = new MeshBasicMaterial({
          map: color,
          transparent: true,
          side: DoubleSide,
          depthWrite: false,
          alphaTest: 0.035,
        });
        if (depth) {
          if (pomSamples > 0) {
            enableStageOcclusion(material, depth, layer.relief, pomSamples);
          } else {
            // No shader sampling on this display; free the GPU depth texture.
            depth.dispose();
          }
        }
        const mesh = new Mesh(geometry, material);
        mesh.position.z = layer.z;
        // Both transparent layers share their origin; explicit rendering order keeps
        // the character on top without moving it away from its contact points.
        mesh.renderOrder = index * 10 + layerIndex + 1;
        group.add(mesh);
        meshes.push(mesh);
        materials.push(material);
      }

      const shadowMaterial = new MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
        side: DoubleSide,
      });
      const shadow = new Mesh(new PlaneGeometry(4.9, 2), shadowMaterial);
      shadow.position.set(0, -0.8, -0.35);
      shadow.renderOrder = index * 10;
      group.add(shadow);
      islands.push({ group, mesh: meshes[0], meshes, materials, shadow });
    }
    return { islands, textures };
  } catch (error) {
    for (const island of islands) disposeStageIsland(island);
    for (const texture of textures) texture.dispose();
    throw error;
  }
}

export function disposeStageIsland(island: StageIsland): void {
  for (const mesh of island.meshes) mesh.geometry.dispose();
  for (const material of island.materials) material.dispose();
  island.shadow.geometry.dispose();
  island.shadow.material.dispose();
}
