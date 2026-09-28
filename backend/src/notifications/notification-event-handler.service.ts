import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import {
  EMPTY,
  Subscription,
  catchError,
  concatMap,
  from,
} from 'rxjs';

import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationEventsService } from './notification-events.service';
import type {
  NotificationInternalEvent,
} from './notification-events.types';

@Injectable()
export class NotificationEventHandlerService
  implements
    OnApplicationBootstrap,
    OnApplicationShutdown
{
  private readonly logger =
    new Logger(
      NotificationEventHandlerService.name,
    );
  private subscription:
    Subscription | null = null;

  constructor(
    private readonly events:
      NotificationEventsService,
    private readonly notifications:
      NotificationDispatchService,
  ) {}

  onApplicationBootstrap(): void {
    this.subscription =
      this.events
        .stream()
        .pipe(
          concatMap(
            (event) =>
              from(
                this.handle(event),
              ).pipe(
                catchError(
                  (error: unknown) => {
                    this.logger.warn(
                      `Notification event "${event.type}" failed: ${this.errorMessage(error)}`,
                    );

                    return EMPTY;
                  },
                ),
              ),
          ),
        )
        .subscribe();
  }

  onApplicationShutdown(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
  }

  private async handle(
    event: NotificationInternalEvent,
  ): Promise<void> {
    switch (event.type) {
      case 'blog.published': {
        const post = event.data;

        await this.notifications
          .notifySubscribers({
            type: 'blog.published',
            eventKey:
              `blog.published:${post.postUuid}`,
            content: {
              de: {
                title:
                  'Neuer Blogartikel',
                body: post.titleDe,
              },
              en: {
                title: 'New blog post',
                body: post.titleEn,
              },
            },
            url:
              `/blog/${post.slug}`,
          });

        return;
      }

      case 'music.published': {
        const release = event.data;
        const album =
          release.kind === 'album';

        await this.notifications
          .notifySubscribers({
            type: 'music.published',
            eventKey:
              `music.published:${release.kind}:${release.uuid}`,
            content: {
              de: {
                title: album
                  ? 'Neues Album'
                  : 'Neue Musik',
                body: release.titleDe,
              },
              en: {
                title: album
                  ? 'New album'
                  : 'New music',
                body: release.titleEn,
              },
            },
            url: release.albumSlug
              ? `/music/albums/${release.albumSlug}`
              : release.kind === 'album'
                ? `/music/albums/${release.slug}`
                : '/music',
          });

        return;
      }

      case 'blog.comment.featured': {
        const comment = event.data;

        await this.notifications.notifyUser(
          comment.userUuid,
          {
            type:
              'blog.comment-featured',
            eventKey:
              `blog.comment.featured:${comment.commentUuid}`,
            content: {
              de: {
                title:
                  'Kommentar hervorgehoben',
                body:
                  'Dein Kommentar wurde von Mimi hervorgehoben.',
              },
              en: {
                title:
                  'Comment featured',
                body:
                  'Your comment was featured by Mimi.',
              },
            },
            url:
              `/blog/${comment.postSlug}`,
          },
        );

        return;
      }

      case 'community.progress.unlocked': {
        const progress = event.data;
        const count =
          progress.achievements.length;
        const first =
          progress.achievements[0];

        if (!first) {
          return;
        }

        const hasAdditionalRewards =
          progress.achievements.some(
            (achievement) =>
              achievement
                .hasAdditionalRewards,
          );

        await this.notifications.notifyUser(
          progress.userUuid,
          {
            type:
              'community.achievement-unlocked',
            eventKey:
              `community.progress:${progress.sourceEventUuid}`,
            content: {
              de: {
                title: count === 1
                  ? 'Achievement freigeschaltet'
                  : `${count} Achievements freigeschaltet`,
                body: count === 1
                  ? hasAdditionalRewards
                    ? `${first.nameDe} wurde freigeschaltet. Neue Belohnungen warten auf dich.`
                    : `${first.nameDe} wurde freigeschaltet.`
                  : 'Du hast mehrere neue Community-Belohnungen freigeschaltet.',
              },
              en: {
                title: count === 1
                  ? 'Achievement unlocked'
                  : `${count} achievements unlocked`,
                body: count === 1
                  ? hasAdditionalRewards
                    ? `${first.nameEn} was unlocked. New rewards are waiting for you.`
                    : `${first.nameEn} was unlocked.`
                  : 'You unlocked several new community rewards.',
              },
            },
            url: '/community/dashboard',
          },
        );
      }
    }
  }

  private errorMessage(
    error: unknown,
  ): string {
    return error instanceof Error
      ? error.message
      : String(error);
  }
}
