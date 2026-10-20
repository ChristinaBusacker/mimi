import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

import { RequestService } from '../http/request.service';

interface ImagePreset {
  width: number;
  height?: number;
  fit: 'inside' | 'cover';
}

interface ResponsivePreset {
  name: string;
  width: number;
}

/** The backend JSON is the only source of responsive image widths and preset names. */
@Injectable({ providedIn: 'root' })
export class ResponsiveImageService {
  private readonly request = inject(RequestService);
  private readonly manifest = toSignal(
    this.request.get<Record<string, ImagePreset>>('/assets/image-presets', {
      deduplicateAcrossTabs: false,
    }).pipe(catchError(() => of({} as Record<string, ImagePreset>))),
    { initialValue: {} as Record<string, ImagePreset> },
  );

  private readonly candidates = computed<readonly ResponsivePreset[]>(() => {
    const widths = new Set<number>();
    return Object.entries(this.manifest())
      .filter(([, preset]) => preset.fit === 'inside' &&
        preset.height === undefined && Number.isInteger(preset.width) && preset.width > 0)
      .sort((left, right) => left[1].width - right[1].width)
      .flatMap(([name, preset]) => {
        if (widths.has(preset.width)) return [];
        widths.add(preset.width);
        return [{ name, width: preset.width }];
      });
  });

  /** Use the closest configured width, or the largest for lightbox display. */
  url(assetId: string, requestedWidth = 1440): string {
    const candidates = this.candidates();
    const preset = candidates.find((item) => item.width >= requestedWidth) ??
      candidates[candidates.length - 1];
    return this.variantUrl(assetId, preset?.name ?? 'large');
  }

  /** Returns null until the server manifest is available, retaining the fallback src. */
  srcset(assetId: string): string | null {
    const candidates = this.candidates();
    if (candidates.length === 0) return null;
    return candidates.map(({ name, width }) =>
      `${this.variantUrl(assetId, name)} ${width}w`,
    ).join(', ');
  }

  private variantUrl(assetId: string, preset: string): string {
    return `/api/assets/${encodeURIComponent(assetId)}/image/${encodeURIComponent(preset)}/webp`;
  }
}
