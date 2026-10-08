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
  WebGLRenderer,
} from 'three';
import type { Texture } from 'three';

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

const ORBIT_RADIUS = 4.5;
const ASSET_ROOT = '/images/stage/';

/** Owns the browser-only WebGL scene. Angular continues to own all accessible content. */
export class StageOrbitRenderer {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(39, 1, 0.1, 100);
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
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
  private visible = true;
  private destroyed = false;
  private ready = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onSelection: (world: StageWorld) => void,
    private readonly onReady: () => void,
    private readonly onUnavailable: () => void,
    private readonly reducedMotion: boolean,
  ) {
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.camera.position.set(0, 1.4, 12.6);
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
    canvas.addEventListener('lostpointercapture', this.onLostPointerCapture);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.resize();
  }

  async init(): Promise<void> {
    const loader = new TextureLoader();
    const urls = [
      'music-island.png',
      'community-island.png',
      'gaming-island.png',
      'dragon.png',
    ];
    const loaded = await Promise.all(urls.map((file) => loader.loadAsync(ASSET_ROOT + file)));

    if (this.destroyed) {
      loaded.forEach((texture) => texture.dispose());
      return;
    }

    for (const texture of loaded) {
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 4);
      this.textures.push(texture);
    }

    STAGE_WORLDS.forEach((_, index) => {
      const geometry = new PlaneGeometry(4.8, 3.6);
      const material = new MeshBasicMaterial({
        map: loaded[index],
        transparent: true,
        side: DoubleSide,
        depthWrite: false,
        alphaTest: 0.015,
      });
      const mesh = new Mesh(geometry, material);
      const group = new Group();
      group.add(mesh);
      this.scene.add(group);
      this.islands.push({ group, material, mesh });
    });

    // The dragon travels with Mimi's music island instead of hovering in screen space.
    const dragon = new Mesh(
      new PlaneGeometry(1.12, 1.12),
      new MeshBasicMaterial({
        map: loaded[3],
        transparent: true,
        side: DoubleSide,
        depthWrite: false,
        alphaTest: 0.015,
      }),
    );
    dragon.position.set(1.1, -0.9, 0.04);
    this.islands[0].group.add(dragon);
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
    this.camera.fov = width < 680 ? 52 : 39;
    this.camera.position.z = width < 680 ? 14.8 : 12.6;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.invalidate();
  }

  private placeIslands(): void {
    this.islands.forEach(({ group, material }, index) => {
      const angle = index * STAGE_STEP - this.rotation;
      const facing = Math.cos(angle);
      group.position.set(Math.sin(angle) * ORBIT_RADIUS, (1 - facing) * 0.15, facing * ORBIT_RADIUS * 0.78);
      group.quaternion.copy(this.camera.quaternion);
      group.rotateY(-Math.sin(angle) * 0.1);
      material.opacity = 0.79 + 0.21 * ((facing + 1) / 2);
      group.scale.setScalar(0.97 + 0.06 * ((facing + 1) / 2));
    });
  }

  private render(): void {
    if (this.destroyed) {
      return;
    }
    this.placeIslands();
    this.renderer.render(this.scene, this.camera);
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

    if (this.pointerId === null && !this.reducedMotion) {
      const difference = this.targetRotation - this.rotation;
      this.velocity += difference * 85 * dt;
      this.velocity *= Math.exp(-17 * dt);
      this.rotation += this.velocity * dt;
      moving = Math.abs(difference) > 0.0005 || Math.abs(this.velocity) > 0.002;
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
