import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

import { LocalStorageService } from '../storage/local-storage.service';

const STORAGE_KEY = 'music.waveform.v1';
const BAR_COUNT = 96;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const MAX_CACHED_TRACKS = 32;

type WaveCache = Record<string, number[]>;

/** Real RMS peaks from the preview file. Never generates decorative/random bars. */
export function audioWaveform(buffer: AudioBuffer, count = BAR_COUNT): number[] {
  const channels = Math.min(buffer.numberOfChannels, 2);
  const samples = buffer.length;
  if (!channels || !samples) return [];
  const data = Array.from({ length: channels }, (_, i) => buffer.getChannelData(i));
  const values: number[] = [];
  for (let bar = 0; bar < count; bar++) {
    const from = Math.floor(bar * samples / count);
    const to = Math.min(samples, Math.max(from + 1, Math.floor((bar + 1) * samples / count)));
    const step = Math.max(1, Math.floor((to - from) / 600));
    let total = 0;
    let measured = 0;
    for (let i = from; i < to; i += step) {
      for (const channel of data) total += channel[i] * channel[i];
      measured += channels;
    }
    values.push(Math.sqrt(total / (measured || 1)));
  }
  const max = Math.max(...values);
  if (max === 0) return values.map(() => 0.06);
  return values.map((value) => Math.min(1, Math.max(0.06, Math.sqrt(value / max))));
}

@Injectable({ providedIn: 'root' })
export class MusicWaveformService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly storage = inject(LocalStorageService);
  private readonly pending = new Map<string, Promise<readonly number[] | null>>();
  private readonly cache: WaveCache = this.readCache();

  get(assetId: string): Promise<readonly number[] | null> {
    if (!this.browser || !/^[a-f\d-]{36}$/i.test(assetId)) return Promise.resolve(null);
    if (this.cache[assetId]) return Promise.resolve(this.cache[assetId]);
    const existing = this.pending.get(assetId);
    if (existing) return existing;
    const job = this.generate(assetId).finally(() => this.pending.delete(assetId));
    this.pending.set(assetId, job);
    return job;
  }

  private readCache(): WaveCache {
    if (!this.browser) return {};
    const stored = this.storage.get<unknown>(STORAGE_KEY);
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};
    const result: WaveCache = {};
    for (const [key, value] of Object.entries(stored).slice(-MAX_CACHED_TRACKS)) {
      if (/^[a-f\d-]{36}$/i.test(key) && Array.isArray(value) && value.length === BAR_COUNT &&
        value.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1)) {
        result[key] = value;
      }
    }
    return result;
  }

  private async generate(assetId: string): Promise<readonly number[] | null> {
    let context: AudioContext | null = null;
    try {
      const response = await fetch(`/api/assets/${assetId}`);
      if (!response.ok || Number(response.headers.get('content-length') ?? 0) > MAX_AUDIO_BYTES) return null;
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > MAX_AUDIO_BYTES) return null;
      context = new AudioContext();
      const decoded = await context.decodeAudioData(bytes);
      const peaks = audioWaveform(decoded);
      if (peaks.length !== BAR_COUNT) return null;
      // Quantize to keep storage small. The audio is never stored twice.
      this.cache[assetId] = peaks.map((peak) => Math.round(peak * 100) / 100);
      const entries = Object.entries(this.cache).slice(-MAX_CACHED_TRACKS);
      this.storage.set(STORAGE_KEY, Object.fromEntries(entries));
      return this.cache[assetId];
    } catch {
      // An unavailable/unsupported preview must not break playback or seeking.
      return null;
    } finally {
      if (context) void context.close().catch(() => undefined);
    }
  }
}
