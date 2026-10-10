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
import { STAGE_WORLDS, type StageWorld } from './stage-orbit';

interface LayerAsset {
  image: string;
  depth: string;
  relief: number;
  z: number;
  character?: boolean;
}

// Two visible layers at most. Both PNGs use the same 1448 × 1086 canvas and UVs.
// The slight height difference in the depth files is handled by normalized UV sampling.
const WORLD_LAYERS: Record<StageWorld, readonly LayerAsset[]> = {
  music: [
    { image: 'music-island.png', depth: 'music-island-depth.png', relief: 0.52, z: 0 },
    { image: 'music-character.png', depth: 'music-character-depth.png', relief: 0.035, z: 0.38, character: true },
  ],
  community: [
    { image: 'community.png', depth: 'community-depth.png', relief: 0.55, z: 0 },
  ],
  gaming: [
    // The uploaded filename is intentionally "gamin", not "gaming".
    { image: 'gaming-island.png', depth: 'gamin-island-depth.png', relief: 0.55, z: 0 },
    { image: 'gaming-character.png', depth: 'gaming-character-depth.png', relief: 0.035, z: 0.38, character: true },
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

function makeGeometry(
  depth: Texture | null,
  relief: number,
  character: boolean,
): PlaneGeometry {
  const geometry = new PlaneGeometry(4.8, 3.6, character ? 48 : 112, character ? 36 : 84);
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
  } finally {
    depth.dispose();
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

  try {
    // Load each island concurrently, preserving background-before-character ordering.
    const assets = await Promise.all(STAGE_WORLDS.map(async (world) =>
      Promise.all(WORLD_LAYERS[world].map(async (layer) => {
        const color = await loader.loadAsync(`/images/island/${layer.image}`);
        textures.push(color);
        let depth: Texture | null = null;
        try {
          depth = await loader.loadAsync(`/images/island/${layer.depth}`);
        } catch {
          // Keep the RGB layer if only its optional depth map is missing.
        }
        return { layer, color, depth };
      })),
    ));

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
        const mesh = new Mesh(geometry, material);
        mesh.position.z = layer.z;
        // PNG transparency and explicit order prevent the character from being occluded
        // by protruding vertices of the island base.
        mesh.renderOrder = index * 10 + layerIndex + 1;
        group.add(mesh);
        meshes.push(mesh);
        materials.push(material);
      }

      const shadowMaterial = new MeshBasicMaterial({
        map: shadowTexture, transparent: true, opacity: 0.48,
        depthWrite: false, side: DoubleSide,
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
