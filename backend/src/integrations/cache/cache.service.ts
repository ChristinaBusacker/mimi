import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CacheEntry } from './entities/cache.entry';

export interface CachedValue<T> {
  value: T;
  refreshedAt: Date;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  private readonly inFlight = new Map<string, Promise<CachedValue<unknown>>>();

  constructor(
    @InjectRepository(CacheEntry)
    private readonly repository: Repository<CacheEntry>,
  ) {}

  async get<T>(key: string): Promise<CachedValue<T> | null> {
    const entry = await this.repository.findOneBy({
      key,
    });

    if (!entry) {
      return null;
    }

    return {
      value: entry.value as T,
      refreshedAt: entry.refreshedAt,
    };
  }

  async getOrRefresh<T>(
    key: string,
    ttlMs: number,
    loader: () => Promise<T>,
  ): Promise<CachedValue<T>> {
    const cached = await this.get<T>(key);

    if (!cached) {
      return this.refresh(key, loader);
    }

    const age = Date.now() - cached.refreshedAt.getTime();

    if (age <= ttlMs) {
      return cached;
    }

    // stale-while-revalidate:
    // returns old value,
    // fetches new state.
    void this.refresh(key, loader).catch((error: unknown) => {
      this.logger.warn(
        `Could not refresh cache "${key}": ${this.getErrorMessage(error)}`,
      );
    });

    return cached;
  }

  async refresh<T>(
    key: string,
    loader: () => Promise<T>,
  ): Promise<CachedValue<T>> {
    const existing = this.inFlight.get(key) as
      Promise<CachedValue<T>> | undefined;

    if (existing) {
      return existing;
    }

    const promise = this.loadAndStore(key, loader);

    this.inFlight.set(key, promise as Promise<CachedValue<unknown>>);

    try {
      return await promise;
    } finally {
      this.inFlight.delete(key);
    }
  }

  private async loadAndStore<T>(
    key: string,
    loader: () => Promise<T>,
  ): Promise<CachedValue<T>> {
    const value = await loader();
    const refreshedAt = new Date();

    const entry = this.repository.create({
      key,
      value,
      refreshedAt,
    });

    await this.repository.save(entry);

    return {
      value,
      refreshedAt,
    };
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
