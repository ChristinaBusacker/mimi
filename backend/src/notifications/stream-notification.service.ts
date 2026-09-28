import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';

import {
  TwitchService,
  type TwitchScheduleNotificationSegment,
} from '../integrations/twitch/twitch.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationDispatchService } from './notification-dispatch.service';

const REMINDER_WINDOW_MS =
  15 * 60 * 1000;
const SCHEDULE_CHANGE_THRESHOLD_MS =
  5 * 60 * 1000;
const LIVE_SCHEDULE_MATCH_WINDOW_MS =
  2 * 60 * 60 * 1000;

interface StreamReminderContext
  extends Record<string, unknown>
{
  segmentId: string;
  title: string;
  startsAt: string;
}

@Injectable()
export class StreamNotificationService
  implements OnApplicationBootstrap
{
  private readonly logger =
    new Logger(
      StreamNotificationService.name,
    );
  private readonly timeZone: string;
  private running = false;

  constructor(
    private readonly twitch:
      TwitchService,
    private readonly notifications:
      NotificationDispatchService,
    private readonly deliveries:
      NotificationDeliveryService,
    config: ConfigService,
  ) {
    this.timeZone =
      config.get<string>(
        'TWITCH_TIME_ZONE',
      ) ?? 'Europe/Berlin';
  }

  async onApplicationBootstrap():
    Promise<void> {
    await this.poll();
  }

  @Interval(30_000)
  async poll(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      const now = Date.now();
      const schedule =
        this.twitch
          .getScheduleForNotifications();

      await this.notifyScheduleChanges(
        schedule,
        now,
      );
      await this.notifyReminders(
        schedule,
        now,
      );
      await this.notifyLive(schedule);
    } catch (error: unknown) {
      this.logger.warn(
        `Could not evaluate stream notifications: ${this.errorMessage(error)}`,
      );
    } finally {
      this.running = false;
    }
  }

  private async notifyReminders(
    schedule:
      readonly TwitchScheduleNotificationSegment[],
    now: number,
  ): Promise<void> {
    if (
      this.twitch.getStatus().state ===
      'live'
    ) {
      return;
    }

    for (const segment of schedule) {
      if (segment.cancelled) {
        continue;
      }

      const startsAt =
        Date.parse(segment.startsAt);
      const remaining =
        startsAt - now;

      if (
        !Number.isFinite(startsAt) ||
        remaining <= 0 ||
        remaining > REMINDER_WINDOW_MS
      ) {
        continue;
      }

      await this.notifications
        .notifySubscribers(
          {
            type: 'stream.reminder',
            eventKey:
              this.reminderEventKey(
                segment.id,
              ),
            eventContext:
              this.reminderContext(
                segment,
              ),
            content: {
              de: {
                title:
                  'Mimi ist gleich live',
                body:
                  `${segment.title} startet um ${this.formatTime(segment.startsAt, 'de')}.`,
              },
              en: {
                title:
                  'Mimi is going live soon',
                body:
                  `${segment.title} starts at ${this.formatTime(segment.startsAt, 'en')}.`,
              },
            },
            url: '/',
            tag:
              `stream:${segment.id}`,
          },
          {
            retryIfNotSent: true,
          },
        );
    }
  }

  private async notifyScheduleChanges(
    schedule:
      readonly TwitchScheduleNotificationSegment[],
    now: number,
  ): Promise<void> {
    const currentById =
      new Map(
        schedule.map(
          (segment) => [
            segment.id,
            segment,
          ] as const,
        ),
      );
    const reminderEvents =
      await this.deliveries
        .listEventsByType(
          'stream.reminder',
        );

    for (const event of reminderEvents) {
      const previous =
        this.readReminderContext(
          event.context,
        );

      if (!previous) {
        continue;
      }

      const current =
        currentById.get(
          previous.segmentId,
        );
      const previousStartsAt =
        Date.parse(previous.startsAt);

      if (
        !current ||
        current.cancelled
      ) {
        if (
          Number.isFinite(
            previousStartsAt,
          ) &&
          previousStartsAt > now
        ) {
          await this.notifyCancellation(
            previous,
          );
        }

        continue;
      }

      const currentStartsAt =
        Date.parse(current.startsAt);

      if (
        !Number.isFinite(
          previousStartsAt,
        ) ||
        !Number.isFinite(
          currentStartsAt,
        ) ||
        currentStartsAt ===
          previousStartsAt
      ) {
        continue;
      }

      const difference =
        Math.abs(
          currentStartsAt -
            previousStartsAt,
        );

      if (
        difference >=
        SCHEDULE_CHANGE_THRESHOLD_MS
      ) {
        await this.notifyScheduleChange(
          previous,
          current,
        );
      }

      await this.deliveries
        .updateEventContext(
          event.key,
          this.reminderContext(
            current,
          ),
        );
    }
  }

  private async notifyScheduleChange(
    previous: StreamReminderContext,
    current:
      TwitchScheduleNotificationSegment,
  ): Promise<void> {
    const users =
      await this.deliveries
        .listDeliveredUserUuids(
          this.reminderEventKey(
            previous.segmentId,
          ),
        );

    for (const userUuid of users) {
      await this.notifications.notifyUser(
        userUuid,
        {
          type:
            'stream.schedule-changed',
          eventKey:
            `stream.schedule-changed:${current.id}:${current.startsAt}`,
          content: {
            de: {
              title:
                'Streamzeit geändert',
              body:
                `${current.title} beginnt jetzt um ${this.formatTime(current.startsAt, 'de')}.`,
            },
            en: {
              title:
                'Stream time changed',
              body:
                `${current.title} now starts at ${this.formatTime(current.startsAt, 'en')}.`,
            },
          },
          url: '/',
          tag:
            `stream:${current.id}`,
        },
      );
    }
  }

  private async notifyCancellation(
    previous: StreamReminderContext,
  ): Promise<void> {
    const users =
      await this.deliveries
        .listDeliveredUserUuids(
          this.reminderEventKey(
            previous.segmentId,
          ),
        );

    for (const userUuid of users) {
      await this.notifications.notifyUser(
        userUuid,
        {
          type: 'stream.cancelled',
          eventKey:
            `stream.cancelled:${previous.segmentId}:${previous.startsAt}`,
          content: {
            de: {
              title:
                'Stream abgesagt',
              body:
                `${previous.title} findet zum angekündigten Termin nicht statt.`,
            },
            en: {
              title:
                'Stream cancelled',
              body:
                `${previous.title} will not take place at the announced time.`,
            },
          },
          url: '/',
          tag:
            `stream:${previous.segmentId}`,
        },
      );
    }
  }

  private async notifyLive(
    schedule:
      readonly TwitchScheduleNotificationSegment[],
  ): Promise<void> {
    const status =
      this.twitch.getStatus();

    if (status.state !== 'live') {
      return;
    }

    const startedAt =
      Date.parse(status.startedAt);
    const matchingSegment =
      schedule
        .filter(
          (segment) =>
            !segment.cancelled,
        )
        .map((segment) => ({
          segment,
          distance:
            Math.abs(
              Date.parse(
                segment.startsAt,
              ) - startedAt,
            ),
        }))
        .filter(
          ({ distance }) =>
            Number.isFinite(distance) &&
            distance <=
              LIVE_SCHEDULE_MATCH_WINDOW_MS,
        )
        .sort(
          (left, right) =>
            left.distance -
            right.distance,
        )[0]?.segment ?? null;
    const remindedUsers =
      matchingSegment
        ? new Set(
            await this.deliveries
              .listDeliveredUserUuids(
                this.reminderEventKey(
                  matchingSegment.id,
                ),
              ),
          )
        : new Set<string>();

    await this.notifications
      .notifySubscribers(
        {
          type: 'stream.live',
          eventKey:
            `stream.live:${status.startedAt}`,
          content: {
            de: {
              title: 'Mimi ist live',
              body: status.title,
            },
            en: {
              title: 'Mimi is live',
              body: status.title,
            },
          },
          url: '/',
          tag: matchingSegment
            ? `stream:${matchingSegment.id}`
            : `stream-live:${status.startedAt}`,
        },
        {
          excludeUserUuids:
            remindedUsers,
          retryIfNotSent: true,
        },
      );
  }

  private reminderEventKey(
    segmentId: string,
  ): string {
    return `stream.reminder:${segmentId}`;
  }

  private reminderContext(
    segment:
      TwitchScheduleNotificationSegment,
  ): StreamReminderContext {
    return {
      segmentId: segment.id,
      title: segment.title,
      startsAt: segment.startsAt,
    };
  }

  private readReminderContext(
    context:
      Record<string, unknown> | null,
  ): StreamReminderContext | null {
    if (!context) {
      return null;
    }

    const segmentId =
      context['segmentId'];
    const title = context['title'];
    const startsAt =
      context['startsAt'];

    if (
      typeof segmentId !== 'string' ||
      typeof title !== 'string' ||
      typeof startsAt !== 'string'
    ) {
      return null;
    }

    return {
      segmentId,
      title,
      startsAt,
    };
  }

  private formatTime(
    value: string,
    locale: 'de' | 'en',
  ): string {
    return new Intl.DateTimeFormat(
      locale === 'de'
        ? 'de-DE'
        : 'en-GB',
      {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: this.timeZone,
      },
    ).format(new Date(value));
  }

  private errorMessage(
    error: unknown,
  ): string {
    return error instanceof Error
      ? error.message
      : String(error);
  }
}
