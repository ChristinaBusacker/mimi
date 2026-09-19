import { isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  Injectable,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Observable,
  defer,
  finalize,
  firstValueFrom,
  from,
  shareReplay,
} from 'rxjs';

import { BroadcastChannelService } from './broadcast-channel.service';

interface CrossTabResponse {
  key: string;
  value: unknown;
}

interface RecentResult {
  receivedAt: number;
  value: unknown;
}

const RESPONSE_TOPIC = 'http:get:completed';
const RESULT_LIFETIME_MS = 5_000;

@Injectable({
  providedIn: 'root',
})
export class CrossTabRequestService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  private readonly broadcastChannel = inject(BroadcastChannelService);

  private readonly inFlight = new Map<string, Observable<unknown>>();
  private readonly recentResults = new Map<string, RecentResult>();

  constructor() {
    this.broadcastChannel
      .messages<CrossTabResponse>(RESPONSE_TOPIC)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ key, value }) => {
        const result: RecentResult = {
          receivedAt: Date.now(),
          value,
        };

        this.recentResults.set(key, result);

        setTimeout(() => {
          if (this.recentResults.get(key) === result) {
            this.recentResults.delete(key);
          }
        }, RESULT_LIFETIME_MS);
      });
  }

  execute<T>(key: string, requestFactory: () => Observable<T>): Observable<T> {
    const existing = this.inFlight.get(key) as Observable<T> | undefined;

    if (existing) {
      return existing;
    }

    const request$ = defer(() => {
      if (!this.canCoordinateAcrossTabs()) {
        return requestFactory();
      }

      return from(this.executeAcrossTabs(key, requestFactory));
    }).pipe(
      finalize(() => {
        this.inFlight.delete(key);
      }),
      shareReplay({
        bufferSize: 1,
        refCount: false,
      }),
    );

    this.inFlight.set(key, request$);

    return request$;
  }

  private async executeAcrossTabs<T>(
    key: string,
    requestFactory: () => Observable<T>,
  ): Promise<T> {
    const startedAt = Date.now();

    return navigator.locks.request(this.getLockName(key), async () => {
      const sharedResult = this.recentResults.get(key);

      if (sharedResult && sharedResult.receivedAt >= startedAt) {
        this.recentResults.delete(key);

        return sharedResult.value as T;
      }

      const value = await firstValueFrom(requestFactory());

      this.broadcastChannel.publish<CrossTabResponse>(RESPONSE_TOPIC, {
        key,
        value,
      });

      return value;
    });
  }

  private canCoordinateAcrossTabs(): boolean {
    return (
      this.isBrowser &&
      this.broadcastChannel.available &&
      typeof navigator !== 'undefined' &&
      'locks' in navigator
    );
  }

  private getLockName(key: string): string {
    return `mimi:http:${key}`;
  }
}
