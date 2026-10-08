import { Injectable, inject } from '@angular/core';

import { LocalStorageService } from '../storage/local-storage.service';

export interface SavedMusicPlayback {
  trackId: string;
  positionSeconds: number;
  volume: number;
}

const STORAGE_KEY = 'music.playback.v1';

@Injectable({ providedIn: 'root' })
export class MusicPlaybackStorageService {
  private readonly storage = inject(LocalStorageService);

  read(): SavedMusicPlayback | null {
    const value = this.storage.get<unknown>(STORAGE_KEY);

    if (typeof value !== 'object' || value === null) {
      return null;
    }

    const item = value as Record<string, unknown>;

    if (
      typeof item['trackId'] !== 'string' ||
      item['trackId'].length === 0 ||
      typeof item['positionSeconds'] !== 'number' ||
      !Number.isFinite(item['positionSeconds']) ||
      item['positionSeconds'] < 0 ||
      typeof item['volume'] !== 'number' ||
      !Number.isFinite(item['volume']) ||
      item['volume'] < 0 ||
      item['volume'] > 1
    ) {
      return null;
    }

    return {
      trackId: item['trackId'],
      positionSeconds: item['positionSeconds'],
      volume: item['volume'],
    };
  }

  save(value: SavedMusicPlayback): void {
    this.storage.set(STORAGE_KEY, value);
  }
}
