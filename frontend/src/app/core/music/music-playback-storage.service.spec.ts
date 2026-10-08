import { TestBed } from '@angular/core/testing';

import { LocalStorageService } from '../storage/local-storage.service';
import { MusicPlaybackStorageService } from './music-playback-storage.service';

describe('MusicPlaybackStorageService', () => {
  let stored: unknown = null;
  let lastWritten: unknown = null;
  let service: MusicPlaybackStorageService;

  beforeEach(() => {
    stored = null;
    lastWritten = null;

    TestBed.configureTestingModule({
      providers: [
        {
          provide: LocalStorageService,
          useValue: {
            get: (key: string) => key === 'music.playback.v1' ? stored : null,
            set: (key: string, value: unknown) => {
              if (key === 'music.playback.v1') lastWritten = value;
            },
          },
        },
      ],
    });

    service = TestBed.inject(MusicPlaybackStorageService);
  });

  it('returns null for missing or corrupted playback states', () => {
    expect(service.read()).toBeNull();
    stored = { trackId: 'track-1', positionSeconds: -1, volume: 0.8 };
    expect(service.read()).toBeNull();
    stored = { trackId: 'track-1', positionSeconds: Number.NaN, volume: 0.8 };
    expect(service.read()).toBeNull();
    stored = { trackId: 'track-1', positionSeconds: 10, volume: 5 };
    expect(service.read()).toBeNull();
  });

  it('restores a valid position and volume', () => {
    stored = { trackId: 'track-1', positionSeconds: 83.5, volume: 0.65 };
    expect(service.read()).toEqual(stored);
  });

  it('saves the last selected track and its progress', () => {
    const value = { trackId: 'track-2', positionSeconds: 45, volume: 0.5 };
    service.save(value);
    expect(lastWritten).toEqual(value);
  });
});
