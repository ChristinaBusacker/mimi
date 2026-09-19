import { Injectable, MessageEvent } from '@nestjs/common';
import { interval, map, merge, Observable, Subject } from 'rxjs';

@Injectable()
export class EventsService {
  private readonly events = new Subject<MessageEvent>();

  stream(): Observable<MessageEvent> {
    const heartbeat = interval(25_000).pipe(
      map((): MessageEvent => ({
        type: 'heartbeat',
        data: {
          timestamp: new Date().toISOString(),
        },
      })),
    );

    return merge(this.events.asObservable(), heartbeat);
  }

  publish(type: string, data?: string | object): void {
    this.events.next({
      type,
      data,
    });
  }
}
