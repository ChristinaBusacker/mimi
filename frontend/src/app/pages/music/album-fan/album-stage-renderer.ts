import {
  AdditiveBlending,
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  RingGeometry,
  Scene,
  SpotLight,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';

import { albumStageAccent, DEFAULT_ALBUM_LIGHT } from './album-stage-palette';

/**
 * A lightweight, browser-only 3D lighting set behind the accessible HTML album covers.
 * Three.js owns the set; Angular owns the carousel and its interactive artwork.
 */
export class AlbumStageRenderer {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(42, 1, 0.1, 80);
  private readonly resizeObserver: ResizeObserver;
  private readonly visibilityObserver: IntersectionObserver | null;
  private readonly accent = new Color().setRGB(
    DEFAULT_ALBUM_LIGHT.r / 255,
    DEFAULT_ALBUM_LIGHT.g / 255,
    DEFAULT_ALBUM_LIGHT.b / 255,
    SRGBColorSpace,
  );
  private readonly targetAccent = this.accent.clone();
  private readonly leftSpot = new SpotLight(0xffb9dc, 28, 18, Math.PI / 5, 0.8, 1);
  private readonly rightSpot = new SpotLight(0xb6a3ff, 22, 18, Math.PI / 5, 0.8, 1);
  private readonly rimLight = new PointLight(0xd395ff, 18, 13, 2);
  private readonly floorMaterial = new MeshStandardMaterial({
    color: 0x44304f,
    metalness: 0.48,
    roughness: 0.54,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  private readonly railMaterial = new MeshStandardMaterial({
    color: 0xf1bbdc,
    emissive: 0x5b2649,
    emissiveIntensity: 0.18,
    metalness: 0.6,
    roughness: 0.35,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    side: DoubleSide,
  });
  private readonly beamMaterial = new MeshBasicMaterial({
    color: 0xeab1ef,
    transparent: true,
    opacity: 0.055,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  });
  private readonly particlesMaterial = new PointsMaterial({
    color: 0xf8d5e9,
    size: 0.075,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  private readonly groundGeometry = new CylinderGeometry(3.05, 3.25, 0.12, 80);
  private readonly ringGeometry = new RingGeometry(2.77, 3.18, 80);
  private readonly beamGeometry = new ConeGeometry(2.15, 7.1, 40, 1, true);
  private readonly dustGeometry = new BufferGeometry();
  private readonly glowTexture: CanvasTexture;
  private readonly glows: Sprite[] = [];
  private readonly beams: Mesh<ConeGeometry, MeshBasicMaterial>[] = [];

  private frameId: number | null = null;
  private lastFrame = 0;
  private pointerX = 0;
  private pointerY = 0;
  private targetPointerX = 0;
  private targetPointerY = 0;
  private lastCover: string | null = null;
  private coverRequest = 0;
  private visible = true;
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly reducedMotion: boolean,
    private readonly onUnavailable: () => void,
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
    this.renderer.setClearColor(0, 0);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.camera.position.set(0, 3.7, 13.6);
    this.camera.lookAt(0, -0.3, 0);

    this.scene.add(new AmbientLight(0xe8d5ff, 1.7));
    this.leftSpot.position.set(-3.2, 5.5, 2.1);
    this.rightSpot.position.set(3.2, 5.3, 2.1);
    this.leftSpot.target.position.set(-0.9, -1.3, 0);
    this.rightSpot.target.position.set(0.9, -1.3, 0);
    this.scene.add(
      this.leftSpot,
      this.leftSpot.target,
      this.rightSpot,
      this.rightSpot.target,
    );
    this.rimLight.position.set(0, -0.5, -2.2);
    this.scene.add(this.rimLight);

    const floor = new Mesh(this.groundGeometry, this.floorMaterial);
    floor.position.y = -1.72;
    floor.scale.z = 0.44;
    this.scene.add(floor);
    const ring = new Mesh(this.ringGeometry, this.railMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -1.63;
    ring.scale.y = 0.48;
    this.scene.add(ring);

    for (const x of [-2.6, 2.6]) {
      const beam = new Mesh(this.beamGeometry, this.beamMaterial.clone());
      beam.position.set(x, 1.65, -1.1);
      beam.rotation.z = x < 0 ? -0.17 : 0.17;
      beam.renderOrder = 1;
      this.scene.add(beam);
      this.beams.push(beam);
    }

    const pixels = document.createElement('canvas');
    pixels.width = pixels.height = 128;
    const context = pixels.getContext('2d');
    if (context) {
      const gradient = context.createRadialGradient(64, 64, 1, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(255,255,255,0.65)');
      gradient.addColorStop(0.18, 'rgba(255,225,250,0.22)');
      gradient.addColorStop(1, 'rgba(255,225,250,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 128, 128);
    }
    this.glowTexture = new CanvasTexture(pixels);
    for (const x of [-3.1, 3.1]) {
      const glow = new Sprite(
        new SpriteMaterial({
          map: this.glowTexture,
          color: 0xf1b5ef,
          transparent: true,
          opacity: 0.63,
          depthWrite: false,
          blending: AdditiveBlending,
        }),
      );
      glow.position.set(x, 2.7, 0);
      glow.scale.set(3.1, 3.1, 1);
      this.scene.add(glow);
      this.glows.push(glow);
    }

    // Deterministic dust positions avoid frame-to-frame randomness and constant GPU work.
    let seed = 37;
    const random = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const positions: number[] = [];
    for (let index = 0; index < 75; index++) {
      positions.push((random() - 0.5) * 11, random() * 5 - 1.8, (random() - 0.5) * 3);
    }
    this.dustGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.scene.add(new Points(this.dustGeometry, this.particlesMaterial));

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.visibilityObserver =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entry]) => {
            this.visible = entry?.isIntersecting ?? false;
            if (this.visible) this.invalidate();
            else this.stop();
          })
        : null;
    this.visibilityObserver?.observe(canvas);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.resize();
  }

  setAlbum(coverAssetId: string | null): void {
    if (this.disposed || coverAssetId === this.lastCover) return;
    this.lastCover = coverAssetId;
    const request = ++this.coverRequest;
    if (!coverAssetId) {
      this.targetAccent.copy(this.accent);
      return;
    }

    const image = new Image();
    image.onload = () => {
      if (this.disposed || request !== this.coverRequest) return;
      try {
        const sample = document.createElement('canvas');
        sample.width = sample.height = 24;
        const context = sample.getContext('2d', { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, 0, 24, 24);
        const { r, g, b } = albumStageAccent(context.getImageData(0, 0, 24, 24).data);
        this.targetAccent.setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
        this.canvas.parentElement?.style.setProperty('--album-stage-light', `${r} ${g} ${b}`);
        this.invalidate();
      } catch {
        // Unavailable or cross-origin artwork keeps the current, neutral stage color.
      }
    };
    image.onerror = () => {
      // Never let missing artwork prevent the album carousel from working.
    };
    image.src = `/api/assets/${encodeURIComponent(coverAssetId)}`;
  }

  setPointer(clientX: number, clientY: number, bounds: DOMRect): void {
    if (this.reducedMotion || !bounds.width || !bounds.height || this.disposed) return;
    this.targetPointerX = Math.max(-1, Math.min(1, (clientX - bounds.left) / bounds.width * 2 - 1));
    this.targetPointerY = Math.max(-1, Math.min(1, 1 - (clientY - bounds.top) / bounds.height * 2));
    this.invalidate();
  }

  clearPointer(): void {
    this.targetPointerX = 0;
    this.targetPointerY = 0;
    this.invalidate();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.coverRequest++;
    this.stop();
    this.resizeObserver.disconnect();
    this.visibilityObserver?.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.canvas.parentElement?.style.removeProperty('--album-stage-light');
    this.glows.forEach((sprite) => sprite.material.dispose());
    this.beams.forEach((mesh) => mesh.material.dispose());
    this.glowTexture.dispose();
    this.groundGeometry.dispose();
    this.ringGeometry.dispose();
    this.beamGeometry.dispose();
    this.dustGeometry.dispose();
    this.floorMaterial.dispose();
    this.railMaterial.dispose();
    this.beamMaterial.dispose();
    this.particlesMaterial.dispose();
    this.renderer.dispose();
  }

  private resize(): void {
    if (this.disposed) return;
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.camera.aspect = width / height;
    this.camera.fov = width < 620 ? 52 : 42;
    this.camera.position.z = width < 620 ? 15.6 : 13.6;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.invalidate();
  }

  private invalidate(): void {
    if (this.disposed || !this.visible || document.hidden || this.frameId !== null) return;
    this.frameId = requestAnimationFrame(this.tick);
  }

  private stop(): void {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
    this.lastFrame = 0;
  }

  private readonly tick = (now: number): void => {
    this.frameId = null;
    if (this.disposed || !this.visible || document.hidden) return;
    const dt = this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 1 / 60;
    this.lastFrame = now;
    const easing = this.reducedMotion ? 1 : 1 - Math.exp(-7 * dt);
    this.accent.lerp(this.targetAccent, easing);
    this.pointerX += (this.targetPointerX - this.pointerX) * easing;
    this.pointerY += (this.targetPointerY - this.pointerY) * easing;
    this.camera.position.x = this.pointerX * 0.24;
    this.camera.position.y = 3.7 + this.pointerY * 0.12;
    this.camera.lookAt(this.pointerX * -0.10, -0.3, 0);
    this.leftSpot.color.copy(this.accent);
    this.railMaterial.color.copy(this.accent);
    this.rimLight.color.copy(this.accent);
    for (const beam of this.beams) {
      (beam.material as MeshBasicMaterial).color.copy(this.accent);
    }
    for (const glow of this.glows) glow.material.color.copy(this.accent);
    this.renderer.render(this.scene, this.camera);

    const colorMoving = Math.max(
      Math.abs(this.targetAccent.r - this.accent.r),
      Math.abs(this.targetAccent.g - this.accent.g),
      Math.abs(this.targetAccent.b - this.accent.b),
    ) > 0.002;
    const pointerMoving =
      Math.abs(this.targetPointerX - this.pointerX) > 0.002 ||
      Math.abs(this.targetPointerY - this.pointerY) > 0.002;
    if (colorMoving || pointerMoving) this.invalidate();
    else this.lastFrame = 0;
  };

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.onUnavailable();
    this.dispose();
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) this.stop();
    else this.invalidate();
  };
}
