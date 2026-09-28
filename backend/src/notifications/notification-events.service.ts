import { Injectable } from '@nestjs/common';
import {
  Observable,
  Subject,
} from 'rxjs';

import type {
  NotificationInternalEvent,
  NotificationInternalEventMap,
  NotificationInternalEventType,
} from './notification-events.types';

@Injectable()
export class NotificationEventsService {
  private readonly events =
    new Subject<NotificationInternalEvent>();

  stream():
    Observable<NotificationInternalEvent> {
    return this.events.asObservable();
  }

  publish<
    TType extends
      NotificationInternalEventType,
  >(
    type: TType,
    data:
      NotificationInternalEventMap[TType],
  ): void {
    this.events.next({
      type,
      data,
    } as NotificationInternalEvent);
  }
}
