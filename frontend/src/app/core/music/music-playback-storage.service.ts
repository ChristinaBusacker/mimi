import { Injectable, inject } from '@angular/core';

import { LocalStorageService } from '../storage/local-storage.service';

export interface SavedMusicPlayback {
  trackId: string;
  positionSeconds: number;
  volume: number;
  queueTrackIds?: string[];
  shuffleEnabled?: boolean;
  repeatMode?: 'off' | 'all' | 'one';
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

    const queue = item['queueTrackIds'];
    const queueTrackIds = Array.isArray(queue) && queue.length <= 1000 &&
      queue.every((id: unknown) => typeof id === 'string' && id.length > 0)
        ? queue as string[]
        : undefined;

    return {
      trackId: item['trackId'],
      positionSeconds: item['positionSeconds'],
      volume: item['volume'],
      ...(queueTrackIds ? { queueTrackIds } : {}),
      ...(typeof item['shuffleEnabled'] === 'boolean' ? { shuffleEnabled: item['shuffleEnabled'] } : {}),
      ...(['off', 'all', 'one'].includes(String(item['repeatMode']))
        ? { repeatMode: item['repeatMode'] as 'off' | 'all' | 'one' } : {}),
    };
  }

  save(value: SavedMusicPlayback): void {
    this.storage.set(STORAGE_KEY, value);
  }
}
