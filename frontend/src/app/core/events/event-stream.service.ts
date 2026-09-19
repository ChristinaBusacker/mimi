import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngxs/store';

import type { AppEvent, AppEventMap } from '@shared/events/app-event';

import { BroadcastChannelService } from '../communication/broadcast-channel.service';
import { API_BASE_URL } from '../http/api-base-url.token';
import { LoadTwitchStatus, SetTwitchStatus } from '../twitch/twitch.actions';
import { LoadYouTubeVideos, SetYouTubeVideos } from '../youtube/youtube.actions';

const EVENT_BROADCAST_TOPIC = 'sse:event';
const LEADER_RELEASED_TOPIC = 'sse:leader:released';
const LEADER_LOCK_NAME = 'mimi:sse-leader';
const LEADER_RETRY_MS = 5_000;

const REALTIME_EVENT_TYPES = ['twitch.status.updated', 'youtube.videos.updated'] as const;

type RealtimeEventType = (typeof REALTIME_EVENT_TYPES)[number];
type RealtimeAppEvent = AppEvent<RealtimeEventType>;

@Injectable({
  providedIn: 'root',
})
export class EventStreamService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(Store);
  private readonly broadcastChannel = inject(BroadcastChannelService);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  private started = false;
  private leader = false;
  private leadershipAttemptInProgress = false;

  private eventSource: EventSource | null = null;
  private releaseLeaderLock: (() => void) | null = null;
  private leadershipRetry: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stop();
    });
  }

  start(): void {
    if (!this.isBrowser || this.started) {
      return;
    }

    this.started = true;

    this.document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('pagehide', this.handlePageHide);

    this.broadcastChannel
      .messages<RealtimeAppEvent>(EVENT_BROADCAST_TOPIC)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.applyEvent(event);
      });

    this.broadcastChannel
      .messages<boolean>(LEADER_RELEASED_TOPIC)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.isVisible()) {
          this.scheduleLeadershipAttempt(0);
        }
      });

    if (this.isVisible()) {
      void this.tryBecomeLeader();
    }
  }

  private readonly handleVisibilityChange = (): void => {
    if (!this.isVisible()) {
      this.releaseLeadership();

      return;
    }

    this.resync();
    this.scheduleLeadershipAttempt(0);
  };

  private readonly handlePageHide = (): void => {
    this.releaseLeadership();
  };

  private async tryBecomeLeader(): Promise<void> {
    if (!this.started || !this.isVisible() || this.leader || this.leadershipAttemptInProgress) {
      return;
    }

    this.clearLeadershipRetry();

    if (!this.canCoordinateAcrossTabs()) {
      this.leader = true;
      this.openEventSource();

      return;
    }

    this.leadershipAttemptInProgress = true;

    try {
      await navigator.locks.request(
        LEADER_LOCK_NAME,
        {
          ifAvailable: true,
        },
        async (lock) => {
          this.leadershipAttemptInProgress = false;

          if (!lock || !this.isVisible()) {
            return;
          }

          this.leader = true;
          this.openEventSource();

          await new Promise<void>((resolve) => {
            this.releaseLeaderLock = resolve;
          });

          this.releaseLeaderLock = null;
          this.closeEventSource();
          this.leader = false;
        },
      );
    } finally {
      this.leadershipAttemptInProgress = false;

      if (this.started && this.isVisible() && !this.leader) {
        this.scheduleLeadershipAttempt();
      }
    }
  }

  private releaseLeadership(): void {
    this.clearLeadershipRetry();

    if (!this.leader && !this.releaseLeaderLock) {
      return;
    }

    this.closeEventSource();
    this.leader = false;

    const releaseLock = this.releaseLeaderLock;
    this.releaseLeaderLock = null;
    releaseLock?.();

    if (this.canCoordinateAcrossTabs()) {
      this.broadcastChannel.publish(LEADER_RELEASED_TOPIC, true);
    }
  }

  private openEventSource(): void {
    if (this.eventSource || !this.isVisible()) {
      return;
    }

    const baseUrl = this.apiBaseUrl.replace(/\/$/, '');
    const eventSource = new EventSource(`${baseUrl}/events`);

    for (const type of REALTIME_EVENT_TYPES) {
      eventSource.addEventListener(type, (event) => {
        this.handleServerEvent(type, event as MessageEvent<string>);
      });
    }

    this.eventSource = eventSource;
  }

  private closeEventSource(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }

  private handleServerEvent<TType extends RealtimeEventType>(
    type: TType,
    event: MessageEvent<string>,
  ): void {
    try {
      const appEvent = {
        type,
        data: JSON.parse(event.data) as AppEventMap[TType],
      } as AppEvent<TType>;

      this.applyEvent(appEvent);

      if (this.broadcastChannel.available) {
        this.broadcastChannel.publish(EVENT_BROADCAST_TOPIC, appEvent);
      }
    } catch {
      // Invalid server events are ignored. A later REST resync repairs state.
    }
  }

  private applyEvent(event: RealtimeAppEvent): void {
    switch (event.type) {
      case 'twitch.status.updated':
        this.store.dispatch(new SetTwitchStatus(event.data)).subscribe();
        break;

      case 'youtube.videos.updated':
        this.store.dispatch(new SetYouTubeVideos(event.data)).subscribe();
        break;
    }
  }

  private resync(): void {
    this.store.dispatch([new LoadTwitchStatus(), new LoadYouTubeVideos()]).subscribe();
  }

  private scheduleLeadershipAttempt(delay = LEADER_RETRY_MS): void {
    if (!this.started || !this.isVisible() || this.leader || this.leadershipRetry) {
      return;
    }

    this.leadershipRetry = setTimeout(() => {
      this.leadershipRetry = null;
      void this.tryBecomeLeader();
    }, delay);
  }

  private clearLeadershipRetry(): void {
    if (!this.leadershipRetry) {
      return;
    }

    clearTimeout(this.leadershipRetry);
    this.leadershipRetry = null;
  }

  private canCoordinateAcrossTabs(): boolean {
    return (
      this.broadcastChannel.available && typeof navigator !== 'undefined' && 'locks' in navigator
    );
  }

  private isVisible(): boolean {
    return this.document.visibilityState === 'visible';
  }

  private stop(): void {
    if (!this.started) {
      return;
    }

    this.started = false;

    this.document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('pagehide', this.handlePageHide);

    this.releaseLeadership();
    this.clearLeadershipRetry();
  }
}
