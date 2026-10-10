import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Texture } from 'three';

import { applyStageDepth } from './stage-depth';

import {
  nearestStageIndex,
  nearestStageStop,
  STAGE_STEP,
  STAGE_WORLDS,
  type StageWorld,
} from './stage-orbit';

interface StageIsland {
  group: Group;
  material: MeshBasicMaterial;
  mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
}

// The ellipse is wider than it is deep; the back islands leave room for the central artwork.
const ORBIT_X_RADIUS = 11.4;
const ORBIT_DEPTH_RADIUS = 5.8;
const NARROW_ORBIT_X_RADIUS = 5.4;
const NARROW_ORBIT_DEPTH_RADIUS = 3.8;
const ASSET_ROOT = '/images/island/';

/** Owns the browser-only WebGL scene. Angular continues to own all accessible content. */
export class StageOrbitRenderer {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(39, 1, 0.1, 100);
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly labelAnchor = new Vector3();
  private readonly islands: StageIsland[] = [];
  private readonly textures: Texture[] = [];
  private readonly resizeObserver: ResizeObserver;
  private readonly visibilityObserver: IntersectionObserver;
  private frameId: number | null = null;
  private lastFrameTime = 0;
  private rotation = 0;
  private targetRotation = 0;
  private velocity = 0;
  private pointerId: number | null = null;
  private pointerStartX = 0;
  private pointerLastX = 0;
  private pointerLastTime = 0;
  private pointerVelocity = 0;
  private pointerStartRotation = 0;
  private dragged = false;
  private lookX = 0;
  private lookY = 0;
  private targetLookX = 0;
  private targetLookY = 0;
  private visible = true;
  private destroyed = false;
  private ready = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onSelection: (world: StageWorld) => void,
    private readonly onReady: () => void,
    private readonly onUnavailable: () => void,
    private readonly reducedMotion: boolean,
    private readonly worldLabels: readonly HTMLElement[],
  ) {
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.camera.position.set(0, 1.65, 15);
    this.camera.lookAt(0, 0, 0);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.visibilityObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry?.isIntersecting ?? false;
      if (this.visible) {
        this.invalidate();
      } else {
        this.stopFrame();
      }
    });
    this.visibilityObserver.observe(canvas);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('lostpointercapture', this.onLostPointerCapture);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.resize();
  }

  async init(): Promise<void> {
    const loader = new TextureLoader();
    // Depth maps are aligned to the artwork by normalized UVs, not absolute pixels.
    // Failed depth loading leaves that island usable as a flat plane.
    const assets = await Promise.all(STAGE_WORLDS.map(async (world) => {
      const color = await loader.loadAsync(`${ASSET_ROOT}${world}.png`);
      let depth: Texture | null = null;
      try {
        depth = await loader.loadAsync(`${ASSET_ROOT}${world}-depth.png`);
      } catch {
        // The RGB artwork remains usable when a depth map is temporarily unavailable.
      }
      return { color, depth };
    }));

    if (this.destroyed) {
      for (const { color, depth } of assets) {
        color.dispose();
        depth?.dispose();
      }
      return;
    }

    for (const [index, { color, depth }] of assets.entries()) {
      color.colorSpace = SRGBColorSpace;
      color.anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 4);
      this.textures.push(color);

      const geometry = new PlaneGeometry(4.8, 3.6, 112, 84);
      if (depth) {
        try {
          const source = depth.image as HTMLImageElement;
          const samplingCanvas = document.createElement('canvas');
          // Downsampling keeps the per-vertex sampling inexpensive and smooths noisy depth.
          samplingCanvas.width = 512;
          samplingCanvas.height = 384;
          const context = samplingCanvas.getContext('2d', { willReadFrequently: true });
          if (context) {
            context.drawImage(source, 0, 0, samplingCanvas.width, samplingCanvas.height);
            const pixels = context.getImageData(0, 0, samplingCanvas.width, samplingCanvas.height);
            applyStageDepth(geometry, pixels.data, pixels.width, pixels.height, index === 0 ? 1.25 : 1.1);
          }
        } catch {
          // Security restrictions or damaged depth maps must not hide the artwork.
        } finally {
          depth.dispose();
        }
      }

      const material = new MeshBasicMaterial({
        map: color,
        transparent: true,
        side: DoubleSide,
        depthWrite: false,
        alphaTest: 0.025,
      });
      const mesh = new Mesh(geometry, material);
      const group = new Group();
      group.add(mesh);
      this.scene.add(group);
      this.islands.push({ group, material, mesh });
    }

    this.placeIslands();
    this.render();
    this.ready = true;
    this.onReady();
  }

  select(world: StageWorld): void {
    if (this.destroyed || !this.ready) {
      return;
    }
    this.targetRotation = nearestStageStop(this.targetRotation, world);
    if (this.reducedMotion) {
      this.rotation = this.targetRotation;
      this.velocity = 0;
    }
    this.invalidate();
  }

  step(direction: -1 | 1): void {
    if (this.destroyed || !this.ready) {
      return;
    }
    this.targetRotation = Math.round(this.targetRotation / STAGE_STEP) * STAGE_STEP + direction * STAGE_STEP;
    this.onSelection(STAGE_WORLDS[nearestStageIndex(this.targetRotation)]);
    if (this.reducedMotion) {
      this.rotation = this.targetRotation;
      this.velocity = 0;
    }
    this.invalidate();
  }

  dispose(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.stopFrame();
    this.resizeObserver.disconnect();
    this.visibilityObserver.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('lostpointercapture', this.onLostPointerCapture);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        if (object.material instanceof MeshBasicMaterial) {
          object.material.dispose();
        }
      }
    });
    this.textures.forEach((texture) => texture.dispose());
    this.renderer.dispose();
  }

  private resize(): void {
    if (this.destroyed) {
      return;
    }
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.camera.aspect = width / height;
    const spread = Math.max(0, Math.min(1, (width - 640) / 480));
    this.camera.fov = 51 - spread * 14;
    this.camera.position.z = 14.2 + spread * 0.8;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.invalidate();
  }

  private placeIslands(): void {
    const spread = Math.max(0, Math.min(1, (this.canvas.clientWidth - 640) / 480));
    const xRadius = NARROW_ORBIT_X_RADIUS + (ORBIT_X_RADIUS - NARROW_ORBIT_X_RADIUS) * spread;
    const depthRadius = NARROW_ORBIT_DEPTH_RADIUS + (ORBIT_DEPTH_RADIUS - NARROW_ORBIT_DEPTH_RADIUS) * spread;

    this.islands.forEach(({ group, material }, index) => {
      const angle = index * STAGE_STEP - this.rotation;
      const facing = Math.cos(angle);
      // Full focus only at the front; side worlds recede on the same continuous orbit.
      const focus = Math.max(0, (facing + 0.5) / 1.5);
      group.position.set(
        Math.sin(angle) * xRadius,
        (1 - facing) * 0.18 - 0.12 * focus,
        facing * depthRadius,
      );
      group.quaternion.copy(this.camera.quaternion);
      // A restrained local change of viewpoint reveals the depth-map geometry.
      // Avoid large rotations: these illustrations have no real reverse side.
      group.rotateY(-Math.sin(angle) * 0.16 + this.lookX * 0.18 * focus);
      group.rotateX(this.lookY * 0.12 * focus);
      material.opacity = 0.75 + 0.25 * focus;
      group.scale.setScalar(0.79 + 0.09 * spread + (0.46 + 0.04 * spread) * focus);
    });
  }

  private positionLabels(): void {
    // Project the bottom of each 3D plane into the HTML overlay. Text stays sharp and accessible.
    this.islands.forEach(({ group }, index) => {
      const label = this.worldLabels[index];
      if (!label) {
        return;
      }
      const angle = index * STAGE_STEP - this.rotation;
      const facing = Math.cos(angle);
      this.labelAnchor.set(0, -1.83, 0).applyMatrix4(group.matrixWorld).project(this.camera);
      const left = (this.labelAnchor.x + 1) * this.canvas.clientWidth / 2;
      const top = (1 - this.labelAnchor.y) * this.canvas.clientHeight / 2;
      label.style.left = '0';
      label.style.top = '0';
      label.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0) translate(-50%, -50%)`;
      label.style.opacity = `${(0.55 + 0.45 * Math.max(0, facing)).toFixed(2)}`;
    });
  }

  private render(): void {
    if (this.destroyed) {
      return;
    }
    this.placeIslands();
    this.renderer.render(this.scene, this.camera);
    this.positionLabels();
  }

  private invalidate(): void {
    if (this.destroyed || !this.visible || document.hidden || this.frameId !== null) {
      return;
    }
    this.frameId = requestAnimationFrame(this.animate);
  }

  private stopFrame(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.lastFrameTime = 0;
  }

  private readonly animate = (timestamp: number): void => {
    this.frameId = null;
    const dt = this.lastFrameTime ? Math.min((timestamp - this.lastFrameTime) / 1000, 0.04) : 1 / 60;
    this.lastFrameTime = timestamp;
    let moving = false;

    if (!this.reducedMotion) {
      const blend = 1 - Math.exp(-10 * dt);
      this.lookX += (this.targetLookX - this.lookX) * blend;
      this.lookY += (this.targetLookY - this.lookY) * blend;
      moving = Math.abs(this.targetLookX - this.lookX) > 0.001 ||
        Math.abs(this.targetLookY - this.lookY) > 0.001;
    }

    if (this.pointerId === null && !this.reducedMotion) {
      const difference = this.targetRotation - this.rotation;
      this.velocity += difference * 85 * dt;
      this.velocity *= Math.exp(-17 * dt);
      this.rotation += this.velocity * dt;
      moving ||= Math.abs(difference) > 0.0005 || Math.abs(this.velocity) > 0.002;
      if (!moving) {
        this.rotation = this.targetRotation;
        this.velocity = 0;
      }
    }

    this.render();
    if (moving) {
      this.invalidate();
    }
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.pointerId !== null || !this.ready) {
      return;
    }
    this.pointerId = event.pointerId;
    this.pointerStartX = event.clientX;
    this.pointerLastX = event.clientX;
    this.pointerLastTime = event.timeStamp;
    this.pointerVelocity = 0;
    this.pointerStartRotation = this.rotation;
    this.dragged = false;
    this.velocity = 0;
    this.canvas.setPointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.pointerId === null) {
      if (!this.reducedMotion && event.pointerType !== 'touch') {
        const bounds = this.canvas.getBoundingClientRect();
        this.targetLookX = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2));
        this.targetLookY = Math.max(-1, Math.min(1, (0.5 - (event.clientY - bounds.top) / bounds.height) * 2));
        this.invalidate();
      }
      return;
    }
    if (event.pointerId !== this.pointerId) {
      return;
    }
    const distance = event.clientX - this.pointerStartX;
    if (Math.abs(distance) > 6) {
      this.dragged = true;
    }
    if (!this.dragged) {
      return;
    }
    const elapsed = Math.max(1, event.timeStamp - this.pointerLastTime);
    this.pointerVelocity = (event.clientX - this.pointerLastX) / elapsed;
    this.pointerLastX = event.clientX;
    this.pointerLastTime = event.timeStamp;
    const pixelsPerStop = Math.max(110, Math.min(this.canvas.clientWidth * 0.27, 230));
    this.rotation = this.pointerStartRotation - (distance / pixelsPerStop) * STAGE_STEP;
    this.targetRotation = this.rotation;
    this.invalidate();
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    this.releasePointer(event.pointerId);
    if (!this.dragged) {
      const picked = this.pickWorld(event);
      if (picked) {
        this.targetRotation = nearestStageStop(this.rotation, picked);
        this.onSelection(picked);
      }
    } else {
      const projected = this.rotation - this.pointerVelocity * STAGE_STEP * 0.24;
      this.targetRotation = Math.round(projected / STAGE_STEP) * STAGE_STEP;
      this.onSelection(STAGE_WORLDS[nearestStageIndex(this.targetRotation)]);
    }
    if (this.reducedMotion) {
      this.rotation = this.targetRotation;
    }
    this.invalidate();
  };

  private readonly onPointerLeave = (): void => {
    this.targetLookX = 0;
    this.targetLookY = 0;
    this.invalidate();
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    this.releasePointer(event.pointerId);
    this.targetRotation = Math.round(this.rotation / STAGE_STEP) * STAGE_STEP;
    this.onSelection(STAGE_WORLDS[nearestStageIndex(this.targetRotation)]);
    this.invalidate();
  };

  private readonly onLostPointerCapture = (event: PointerEvent): void => {
    if (event.pointerId === this.pointerId) {
      this.pointerId = null;
      this.targetRotation = Math.round(this.rotation / STAGE_STEP) * STAGE_STEP;
      this.invalidate();
    }
  };

  private releasePointer(pointerId: number): void {
    this.pointerId = null;
    if (this.canvas.hasPointerCapture(pointerId)) {
      this.canvas.releasePointerCapture(pointerId);
    }
  }

  private pickWorld(event: PointerEvent): StageWorld | null {
    const bounds = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.islands.map((island) => island.mesh));
    const hit = hits[0];
    if (!hit) {
      return null;
    }
    const index = this.islands.findIndex(({ mesh }) => mesh === hit.object);
    return index < 0 ? null : STAGE_WORLDS[index];
  }

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.onUnavailable();
    this.dispose();
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      this.stopFrame();
    } else {
      this.invalidate();
    }
  };
}
