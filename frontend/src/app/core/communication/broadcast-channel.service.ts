import { isPlatformBrowser } from '@angular/common';
import {
  Injectable,
  OnDestroy,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { Observable, Subject, filter, map } from 'rxjs';

interface BroadcastEnvelope<T = unknown> {
  topic: string;
  payload: T;
}

const CHANNEL_NAME = 'mimi';

@Injectable({
  providedIn: 'root',
})
export class BroadcastChannelService implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly messagesSubject = new Subject<BroadcastEnvelope>();

  private readonly channel = this.createChannel();

  readonly available = this.channel !== null;

  publish<T>(topic: string, payload: T): void {
    this.channel?.postMessage({
      topic,
      payload,
    } satisfies BroadcastEnvelope<T>);
  }

  messages<T>(topic: string): Observable<T> {
    return this.messagesSubject.pipe(
      filter((message) => message.topic === topic),
      map((message) => message.payload as T),
    );
  }

  ngOnDestroy(): void {
    this.channel?.close();
    this.messagesSubject.complete();
  }

  private createChannel(): BroadcastChannel | null {
    if (!this.isBrowser || typeof BroadcastChannel === 'undefined') {
      return null;
    }

    const channel = new BroadcastChannel(CHANNEL_NAME);

    channel.addEventListener('message', (event: MessageEvent<BroadcastEnvelope>) => {
      if (!event.data || typeof event.data.topic !== 'string') {
        return;
      }

      this.messagesSubject.next(event.data);
    });

    return channel;
  }
}
