import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';

interface SkylineLight {
  x: number;
  y: number;
  size: number;
  active: boolean;
  nextToggleAt: number;
  intensity: number;
  color: string;
}

interface CandidatePoint {
  x: number;
  y: number;
}

@Component({
  selector: 'app-skyline-background',
  templateUrl: './skyline-background.html',
  styleUrl: './skyline-background.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkylineBackground implements OnDestroy {
  @ViewChild('image', { static: true })
  private readonly imageRef!: ElementRef<HTMLImageElement>;

  @ViewChild('canvas', { static: true })
  private readonly canvasRef!: ElementRef<HTMLCanvasElement>;

  private sourceCanvas?: HTMLCanvasElement;
  private sourceContext?: CanvasRenderingContext2D;

  private resizeObserver?: ResizeObserver;
  private animationFrameId = 0;

  private candidates: CandidatePoint[] = [];
  private lights: SkylineLight[] = [];

  constructor() {
    afterNextRender(() => {
      this.resizeObserver = new ResizeObserver(() => {
        this.resizeCanvas();
        this.draw();
      });

      this.resizeObserver.observe(this.imageRef.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();

    if (this.animationFrameId !== 0) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  protected onImageLoad(): void {
    const image = this.imageRef.nativeElement;

    this.sourceCanvas ??= image.ownerDocument.createElement('canvas');

    this.sourceContext ??=
      this.sourceCanvas.getContext('2d', {
        willReadFrequently: true,
      }) ?? undefined;

    if (!this.sourceContext) {
      return;
    }

    this.sourceCanvas.width = image.naturalWidth;
    this.sourceCanvas.height = image.naturalHeight;

    this.sourceContext.clearRect(0, 0, this.sourceCanvas.width, this.sourceCanvas.height);

    this.sourceContext.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);

    this.candidates = this.collectCandidates();
    this.lights = this.createLights();

    this.resizeCanvas();
    this.startAnimation();
  }

  private resizeCanvas(): void {
    const image = this.imageRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;

    const rect = image.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private collectCandidates(): CandidatePoint[] {
    if (!this.sourceCanvas || !this.sourceContext) {
      return [];
    }

    const width = this.sourceCanvas.width;
    const height = this.sourceCanvas.height;

    const imageData = this.sourceContext.getImageData(0, 0, width, height);

    const points: CandidatePoint[] = [];

    for (let x = 6; x < width - 6; x += 7) {
      for (let y = 8; y < height - 10; y += 8) {
        if (!this.isInteriorPixel(imageData, width, x, y)) {
          continue;
        }

        if (y > height * 0.82) {
          continue;
        }

        points.push({
          x: x / width,
          y: y / height,
        });
      }
    }

    return points;
  }

  private isInteriorPixel(imageData: ImageData, width: number, x: number, y: number): boolean {
    const alpha = (pixelX: number, pixelY: number): number => {
      const index = (pixelY * width + pixelX) * 4 + 3;

      return imageData.data[index] ?? 0;
    };

    return (
      alpha(x, y) > 200 &&
      alpha(x - 2, y) > 200 &&
      alpha(x + 2, y) > 200 &&
      alpha(x, y - 2) > 200 &&
      alpha(x, y + 2) > 200
    );
  }

  private createLights(): SkylineLight[] {
    const shuffled = [...this.candidates].sort(() => Math.random() - 0.5);

    return shuffled.slice(0, 140).map((point) => ({
      x: point.x,
      y: point.y,
      size: Math.random() > 0.75 ? 3 : 2,
      active: Math.random() > 0.55,
      nextToggleAt: performance.now() + this.randomBetween(800, 6000),
      intensity: this.randomBetween(0.55, 1),
      color: Math.random() > 0.82 ? 'rgba(255, 190, 220, 0.95)' : 'rgba(255, 240, 190, 0.95)',
    }));
  }

  private startAnimation(): void {
    if (this.animationFrameId !== 0) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const tick = (timestamp: number): void => {
      this.updateLights(timestamp);
      this.draw();

      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  private updateLights(timestamp: number): void {
    for (const light of this.lights) {
      if (timestamp < light.nextToggleAt) {
        continue;
      }

      if (Math.random() > 0.62) {
        light.active = !light.active;
      }

      light.nextToggleAt = timestamp + this.randomBetween(1200, 9000);

      light.intensity = this.randomBetween(0.55, 1.2);
    }
  }

  private draw(): void {
    const canvas = this.canvasRef.nativeElement;

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;

    const width = canvas.width / dpr;

    const height = canvas.height / dpr;

    context.clearRect(0, 0, width, height);

    for (const light of this.lights) {
      if (!light.active) {
        continue;
      }

      const x = light.x * width;

      const y = light.y * height;

      const glowSize = light.size * 3.5;

      context.save();

      context.globalAlpha = light.intensity;

      context.fillStyle = light.color;

      context.shadowBlur = glowSize * 2.2;

      context.shadowColor = light.color;

      context.fillRect(x, y, light.size, light.size + 1);

      context.restore();
    }
  }

  private randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }
}
