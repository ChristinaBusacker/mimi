import type {
  Asset,
  AssetFolder,
  AssetType,
  AssetImageEdits,
  UpdateAssetDescriptions,
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

  getFolders(): Observable<AssetFolder[]> {
    return this.request.get<AssetFolder[]>('/admin/assets/folders', {
      deduplicateAcrossTabs: false,
      transferCache: false,
    });
  }

  createFolder(name: string, parentId: string | null): Observable<AssetFolder> {
    return this.request.post<AssetFolder, { name: string; parentId: string | null }>(
      '/admin/assets/folders', { name, parentId },
    );
  }

  deleteFolder(id: string): Observable<void> {
    return this.request.delete<void>(`/admin/assets/folders/${id}`);
  }

  moveAsset(id: string, folderId: string | null): Observable<Asset> {
    return this.request.patch<Asset, { folderId: string | null }>(
      `/admin/assets/${id}/folder`, { folderId },
    );
  }

  upload(file: File, folderId: string | null = null): Observable<Asset> {
    const body = new FormData();

    body.append('file', file);

    return this.request.post<Asset, FormData>(
      folderId ? `/admin/assets?folderId=${encodeURIComponent(folderId)}` : '/admin/assets',
      body,
    );
  }

  updateImageEdits(id: string, input: AssetImageEdits): Observable<Asset> {
    return this.request.patch<Asset, AssetImageEdits>(`/admin/assets/${id}/image-edits`, input);
  }

  updateDescriptions(
    id: string,
    input: UpdateAssetDescriptions,
  ): Observable<Asset> {
    return this.request.patch<
      Asset,
      UpdateAssetDescriptions
    >(
      `/admin/assets/${id}/descriptions`,
      input,
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
