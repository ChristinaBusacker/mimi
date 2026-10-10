import {
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Texture } from 'three';

import { createStageVisuals, disposeStageIsland, type StageIsland } from './stage-island-visuals';
import { advanceStageParallax } from './stage-parallax';

import {
  isStageCarouselMoving,
  nearestStageIndex,
  nearestStageStop,
  STAGE_STEP,
  STAGE_WORLDS,
  type StageWorld,
} from './stage-orbit';

// The ellipse is wider than it is deep; the back islands leave room for the central artwork.
const ORBIT_X_RADIUS = 8.4;
const ORBIT_DEPTH_RADIUS = 4.8;
const NARROW_ORBIT_X_RADIUS = 5.1;
const NARROW_ORBIT_DEPTH_RADIUS = 3.6;
/** Owns the browser-only WebGL scene. Angular continues to own all accessible content. */
export class StageOrbitRenderer {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(39, 1, 0.1, 100);
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly labelAnchor = new Vector3();
  private readonly spotlightAnchor = new Vector3();
  private readonly islands: StageIsland[] = [];
  private readonly textures: Texture[] = [];
  private readonly resizeObserver: ResizeObserver;
  private readonly spotlightResizeObserver: ResizeObserver;
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
  private tilt = 0;
  private readonly parallax = { x: 0, y: 0 };
  private readonly parallaxVelocity = { x: 0, y: 0 };
  private readonly parallaxTarget = { x: 0, y: 0 };
  private orientationActive = false;
  private orientationBaseline: number | null = null;
  private lastRenderedRotation = 0;
  private motionActive = false;
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
    private readonly spotlight: HTMLElement,
    private readonly onMotionChange: (moving: boolean) => void,
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.camera.position.set(0, 1.65, 15);
    this.camera.lookAt(0, 0, 0);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.spotlightResizeObserver = new ResizeObserver(() => this.invalidate());
    this.spotlightResizeObserver.observe(spotlight);
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
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('lostpointercapture', this.onLostPointerCapture);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.resize();
  }

  async init(): Promise<void> {
    const visuals = await createStageVisuals(this.renderer);
    if (this.destroyed) {
      for (const island of visuals.islands) disposeStageIsland(island);
      for (const texture of visuals.textures) texture.dispose();
      return;
    }
    this.textures.push(...visuals.textures);
    this.islands.push(...visuals.islands);
    for (const island of visuals.islands) this.scene.add(island.group);

    this.placeIslands();
    this.render();
    this.ready = true;
    this.onReady();
  }

  /** Sensor access is optional and may require a user gesture on iOS. */
  async enableOrientation(): Promise<boolean> {
    if (this.destroyed || this.reducedMotion || typeof DeviceOrientationEvent === 'undefined')
      return false;
    const sensor = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    try {
      if (sensor.requestPermission && (await sensor.requestPermission()) !== 'granted')
        return false;
    } catch {
      return false;
    }
    this.orientationActive = true;
    this.orientationBaseline = null;
    window.addEventListener('deviceorientation', this.onDeviceOrientation, { passive: true });
    return true;
  }

  disableOrientation(): void {
    this.orientationActive = false;
    this.orientationBaseline = null;
    window.removeEventListener('deviceorientation', this.onDeviceOrientation);
    this.parallaxTarget.x = 0;
    this.parallaxTarget.y = 0;
    this.invalidate();
  }

  select(world: StageWorld): void {
    if (this.destroyed || !this.ready) {
      return;
    }
    const target = nearestStageStop(this.targetRotation, world);
    if (Math.abs(target - this.rotation) > 0.001 && !this.reducedMotion) {
      this.setMoving(true);
    }
    this.targetRotation = target;
    if (this.reducedMotion) {
      this.rotation = this.targetRotation;
      this.velocity = 0;
      this.setMoving(false);
    }
    this.invalidate();
  }

  step(direction: -1 | 1): void {
    if (this.destroyed || !this.ready) {
      return;
    }
    this.targetRotation =
      Math.round(this.targetRotation / STAGE_STEP) * STAGE_STEP + direction * STAGE_STEP;
    if (!this.reducedMotion) {
      this.setMoving(true);
    }
    this.onSelection(STAGE_WORLDS[nearestStageIndex(this.targetRotation)]);
    if (this.reducedMotion) {
      this.rotation = this.targetRotation;
      this.velocity = 0;
      this.setMoving(false);
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
    this.spotlightResizeObserver.disconnect();
    this.visibilityObserver.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.disableOrientation();
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.canvas.removeEventListener('lostpointercapture', this.onLostPointerCapture);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    for (const island of this.islands) disposeStageIsland(island);
    this.textures.forEach((texture) => texture.dispose());
    this.spotlight.style.removeProperty('left');
    this.spotlight.style.removeProperty('top');
    this.setMoving(false);
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
    const depthRadius =
      NARROW_ORBIT_DEPTH_RADIUS + (ORBIT_DEPTH_RADIUS - NARROW_ORBIT_DEPTH_RADIUS) * spread;

    this.islands.forEach((island, index) => {
      const { group, materials, meshes, shadow } = island;
      const angle = index * STAGE_STEP - this.rotation;
      const facing = Math.cos(angle);
      const focus = Math.max(0, (facing + 0.5) / 1.5);
      const verticalOffset = 1.15;

      group.position.set(
        Math.sin(angle) * xRadius,
        (1 - facing) * 0.18 - 0.12 * focus + verticalOffset,
        facing * depthRadius,
      );
      group.quaternion.copy(this.camera.quaternion);
      // Rotate the whole diorama together: figures remain seated on their bases.
      group.rotateY(-Math.sin(angle) * 0.18 + this.tilt * focus + this.parallax.x * (0.5 + focus));
      group.rotateX(this.tilt * 0.14 * focus + this.parallax.y * (0.5 + focus));
      // Transparent planes need depth-aware ordering between islands, not a fixed
      // world-index order. Within an island the character always renders last.
      const depthOrder = Math.round((facing + 1) * 100) * 10;
      shadow.renderOrder = depthOrder;
      meshes.forEach((mesh, layerIndex) => {
        mesh.renderOrder = depthOrder + layerIndex + 1;
      });
      const opacity = 0.84 + 0.16 * focus;
      for (const material of materials) {
        material.opacity = opacity;
        material.color.setRGB(0.93 + 0.07 * focus, 0.92 + 0.08 * focus, 1);
      }
      shadow.material.opacity = 0.22 + focus * 0.32;
      group.scale.setScalar(0.85 + 0.08 * spread + (0.62 + 0.07 * spread) * focus);
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
      const left = ((this.labelAnchor.x + 1) * this.canvas.clientWidth) / 2;
      const top = ((1 - this.labelAnchor.y) * this.canvas.clientHeight) / 2;
      label.style.left = '0';
      label.style.top = '0';
      label.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0) translate(-50%, -50%)`;
      // The focused island has its own HTML spotlight: no duplicate label beneath it.
      label.style.opacity = `${Math.max(0, Math.min(1, (1 - facing) * 0.8)).toFixed(2)}`;
    });
  }

  private positionSpotlight(): void {
    const island = this.islands[nearestStageIndex(this.targetRotation)];
    if (!island) {
      return;
    }

    // Anchor the Angular-owned HTML beneath the focused Three.js island.
    // Unlike CSS2DObject this does not reparent Angular's hydrated DOM nodes.
    this.spotlightAnchor
      .set(0, -1.92, 0)
      .applyMatrix4(island.group.matrixWorld)
      .project(this.camera);
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const halfWidth = this.spotlight.offsetWidth / 2;
    const maxX = Math.max(halfWidth + 12, width - halfWidth - 12);
    const x = Math.min(maxX, Math.max(halfWidth + 12, ((this.spotlightAnchor.x + 1) * width) / 2));
    const projectedY = ((1 - this.spotlightAnchor.y) * height) / 2 + 10;
    const maxY = Math.max(0, height - this.spotlight.offsetHeight - 12);
    const y = Math.max(0, Math.min(maxY, projectedY));
    this.spotlight.style.left = `${x.toFixed(1)}px`;
    this.spotlight.style.top = `${y.toFixed(1)}px`;
  }

  private setMoving(moving: boolean): void {
    if (this.motionActive === moving) {
      return;
    }
    this.motionActive = moving;
    this.onMotionChange(moving);
  }

  private render(): void {
    if (this.destroyed) {
      return;
    }
    this.placeIslands();
    this.renderer.render(this.scene, this.camera);
    this.positionLabels();
    this.positionSpotlight();
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
    const dt = this.lastFrameTime
      ? Math.min((timestamp - this.lastFrameTime) / 1000, 0.04)
      : 1 / 60;
    this.lastFrameTime = timestamp;
    let rotating = false;
    if (this.pointerId === null && !this.reducedMotion) {
      const difference = this.targetRotation - this.rotation;
      this.velocity += difference * 85 * dt;
      this.velocity *= Math.exp(-17 * dt);
      this.rotation += this.velocity * dt;
      rotating = Math.abs(difference) > 0.0005 || Math.abs(this.velocity) > 0.002;
      if (!rotating) {
        this.rotation = this.targetRotation;
        this.velocity = 0;
      }
    }

    // A little lag during rotation reveals the relief of the depth meshes.
    // At rest it settles to zero and stops the frame loop entirely.
    const angularSpeed = (this.rotation - this.lastRenderedRotation) / dt;
    const targetTilt = this.reducedMotion
      ? 0
      : Math.max(-0.085, Math.min(0.085, angularSpeed * 0.016));
    this.tilt += (targetTilt - this.tilt) * (1 - Math.exp(-12 * dt));
    const easingTilt = Math.abs(this.tilt) > 0.001 || Math.abs(targetTilt - this.tilt) > 0.001;
    const easingParallax =
      !this.reducedMotion &&
      advanceStageParallax(this.parallax, this.parallaxVelocity, this.parallaxTarget, dt);
    this.render();
    this.lastRenderedRotation = this.rotation;
    // Pointer/sensor parallax may keep rendering, but must never hide the spotlight.
    this.setMoving(
      !this.reducedMotion &&
        isStageCarouselMoving(
          this.pointerId !== null && this.dragged,
          this.targetRotation - this.rotation,
          this.velocity,
        ),
    );
    if (rotating || easingTilt || easingParallax) {
      this.invalidate();
    } else if (this.pointerId === null) {
      this.tilt = 0;
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
      if (!this.reducedMotion && !this.orientationActive && event.pointerType === 'mouse') {
        const bounds = this.canvas.getBoundingClientRect();
        this.parallaxTarget.x =
          Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2)) *
          0.045;
        this.parallaxTarget.y =
          Math.max(-1, Math.min(1, (0.5 - (event.clientY - bounds.top) / bounds.height) * 2)) *
          0.028;
        this.invalidate();
      }
      return;
    }
    if (event.pointerId !== this.pointerId) {
      return;
    }
    const distance = event.clientX - this.pointerStartX;
    if (Math.abs(distance) > 6 && !this.dragged) {
      this.dragged = true;
      if (!this.reducedMotion) {
        this.setMoving(true);
      }
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
        if (Math.abs(this.targetRotation - this.rotation) > 0.001 && !this.reducedMotion) {
          this.setMoving(true);
        }
        this.onSelection(picked);
      }
    } else {
      const projected = this.rotation - this.pointerVelocity * STAGE_STEP * 0.24;
      this.targetRotation = Math.round(projected / STAGE_STEP) * STAGE_STEP;
      this.onSelection(STAGE_WORLDS[nearestStageIndex(this.targetRotation)]);
    }
    if (this.reducedMotion) {
      this.rotation = this.targetRotation;
      this.setMoving(false);
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
    const hits = this.raycaster.intersectObjects(this.islands.flatMap((island) => island.meshes));
    const hit = hits[0];
    if (!hit) {
      return null;
    }
    const index = this.islands.findIndex(({ meshes }) =>
      meshes.some((mesh) => mesh === hit.object),
    );
    return index < 0 ? null : STAGE_WORLDS[index];
  }

  private readonly onPointerLeave = (): void => {
    if (this.pointerId === null && !this.orientationActive) {
      this.parallaxTarget.x = 0;
      this.parallaxTarget.y = 0;
      this.invalidate();
    }
  };

  private readonly onDeviceOrientation = (event: DeviceOrientationEvent): void => {
    if (
      !this.orientationActive ||
      this.pointerId !== null ||
      event.beta === null ||
      event.gamma === null
    )
      return;
    this.orientationBaseline ??= event.beta;
    this.parallaxTarget.x = Math.max(-1, Math.min(1, event.gamma / 35)) * 0.035;
    this.parallaxTarget.y =
      Math.max(-1, Math.min(1, (event.beta - this.orientationBaseline) / 30)) * 0.022;
    this.invalidate();
  };

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
