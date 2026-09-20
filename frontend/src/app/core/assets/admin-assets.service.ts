import type {
  Asset,
  AssetType,
} from '@shared/assets/asset';

import {
  Injectable,
  inject,
} from '@angular/core';
import { Observable } from 'rxjs';

import { RequestService } from '../http/request.service';

@Injectable({
  providedIn: 'root',
})
export class AdminAssetsService {
  private readonly request = inject(RequestService);

  getAll(type: AssetType): Observable<Asset[]> {
    return this.request.get<Asset[]>(
      `/admin/assets?type=${type}`,
      {
        deduplicateAcrossTabs: false,
        transferCache: false,
      },
    );
  }

  upload(file: File): Observable<Asset> {
    const body = new FormData();

    body.append('file', file);

    return this.request.post<Asset, FormData>(
      '/admin/assets',
      body,
    );
  }

  delete(id: string): Observable<void> {
    return this.request.delete<void>(
      `/admin/assets/${id}`,
    );
  }

  readAudioDuration(asset: Asset): Promise<number> {
    if (asset.type !== 'audio') {
      return Promise.reject(
        new Error('Asset is not an audio file.'),
      );
    }

    return new Promise<number>((resolve, reject) => {
      const audio = document.createElement('audio');

      const cleanup = (): void => {
        audio.removeAttribute('src');
        audio.load();
      };

      audio.preload = 'metadata';

      audio.addEventListener(
        'loadedmetadata',
        () => {
          const duration = audio.duration;

          cleanup();

          if (
            !Number.isFinite(duration) ||
            duration <= 0
          ) {
            reject(
              new Error('Audio duration is unavailable.'),
            );

            return;
          }

          resolve(
            Math.max(1, Math.round(duration)),
          );
        },
        {
          once: true,
        },
      );

      audio.addEventListener(
        'error',
        () => {
          cleanup();
          reject(
            new Error('Audio metadata could not be loaded.'),
          );
        },
        {
          once: true,
        },
      );

      audio.src = asset.url;
      audio.load();
    });
  }
}
