import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject, interval, map, merge } from 'rxjs';

import type {
  AppEventMap,
  AppEventType,
} from '@shared/events/app-event';

@Injectable()
export class EventsService {
  private readonly events = new Subject<MessageEvent>();

  stream(): Observable<MessageEvent> {
    const heartbeat = interval(25_000).pipe(
      map((): MessageEvent => ({
        type: 'heartbeat',
        data: {
          timestamp: new Date().toISOString(),
        } satisfies AppEventMap['heartbeat'],
      })),
    );

    return merge(this.events.asObservable(), heartbeat);
  }

  publish<TType extends AppEventType>(
    type: TType,
    data: AppEventMap[TType],
  ): void {
    this.events.next({
      type,
      data,
    });
  }
}
