import type {
  NotificationLocale,
  NotificationType,
} from '@shared/notifications/notifications';

import { Injectable } from '@nestjs/common';

import { PushService } from '../push/push.service';
import type {
  PushDeliverySummary,
  PushNotification,
} from '../push/push.types';
import { NotificationDeliveryService } from './notification-delivery.service';
import {
  defaultNotificationTagFor,
  notificationPreferenceGroupFor,
} from './notification-policy';
import {
  NotificationPreferencesService,
  type NotificationRecipient,
} from './notification-preferences.service';

export interface LocalizedNotificationText {
  title: string;
  body: string;
}

export interface NotificationDispatchInput {
  type: NotificationType;
  content: Record<
    NotificationLocale,
    LocalizedNotificationText
  >;
  url?: string;
  tag?: string;
  eventKey?: string;
  eventContext?: Record<string, unknown>;
}

export interface NotificationDispatchOptions {
  excludeUserUuids?: ReadonlySet<string>;
  retryIfNotSent?: boolean;
}

export interface NotificationDispatchSummary
  extends PushDeliverySummary {
  recipients: number;
  skipped: number;
}

const EMPTY_DELIVERY_SUMMARY:
  PushDeliverySummary = {
    sent: 0,
    failed: 0,
    removed: 0,
  };

@Injectable()
export class NotificationDispatchService {
  constructor(
    private readonly preferences:
      NotificationPreferencesService,
    private readonly push:
      PushService,
    private readonly deliveries:
      NotificationDeliveryService,
  ) {}

  async notifyUser(
    userUuid: string,
    input: NotificationDispatchInput,
    options: NotificationDispatchOptions = {},
  ): Promise<NotificationDispatchSummary> {
    const group =
      notificationPreferenceGroupFor(
        input.type,
      );
    const recipient =
      await this.preferences.getRecipient(
        userUuid,
        group,
      );

    if (
      !recipient ||
      options.excludeUserUuids?.has(
        userUuid,
      )
    ) {
      return {
        recipients: 0,
        skipped: 1,
        ...EMPTY_DELIVERY_SUMMARY,
      };
    }

    await this.ensureEvent(input);

    const delivery =
      await this.deliverRecipient(
        recipient,
        input,
        options,
      );

    return {
      recipients: 1,
      skipped: delivery.skipped,
      sent: delivery.sent,
      failed: delivery.failed,
      removed: delivery.removed,
    };
  }

  async notifySubscribers(
    input: NotificationDispatchInput,
    options: NotificationDispatchOptions = {},
  ): Promise<NotificationDispatchSummary> {
    const group =
      notificationPreferenceGroupFor(
        input.type,
      );
    const recipients =
      await this.preferences
        .listRecipients(group);
    const eligibleRecipients =
      recipients.filter(
        (recipient) =>
          !options.excludeUserUuids?.has(
            recipient.userUuid,
          ),
      );

    await this.ensureEvent(input);

    const summary:
      NotificationDispatchSummary = {
        recipients:
          eligibleRecipients.length,
        skipped:
          recipients.length -
          eligibleRecipients.length,
        sent: 0,
        failed: 0,
        removed: 0,
      };

    for (
      const recipient
      of eligibleRecipients
    ) {
      const delivery =
        await this.deliverRecipient(
          recipient,
          input,
          options,
        );

      summary.skipped +=
        delivery.skipped;
      summary.sent +=
        delivery.sent;
      summary.failed +=
        delivery.failed;
      summary.removed +=
        delivery.removed;
    }

    return summary;
  }

  private async ensureEvent(
    input: NotificationDispatchInput,
  ): Promise<void> {
    if (!input.eventKey) {
      return;
    }

    await this.deliveries.ensureEvent(
      input.eventKey,
      input.type,
      input.eventContext ?? null,
    );
  }

  private async deliverRecipient(
    recipient: NotificationRecipient,
    input: NotificationDispatchInput,
    options: NotificationDispatchOptions,
  ): Promise<
    PushDeliverySummary & {
      skipped: number;
    }
  > {
    const eventKey = input.eventKey;

    if (eventKey) {
      const claimed =
        await this.deliveries.claim(
          eventKey,
          recipient.userUuid,
        );

      if (!claimed) {
        return {
          skipped: 1,
          ...EMPTY_DELIVERY_SUMMARY,
        };
      }
    }

    try {
      const delivery =
        await this.deliver(
          recipient,
          input,
        );

      if (eventKey) {
        if (
          delivery.sent > 0 ||
          !options.retryIfNotSent
        ) {
          await this.deliveries.complete(
            eventKey,
            recipient.userUuid,
            delivery.sent > 0,
          );
        } else {
          await this.deliveries.release(
            eventKey,
            recipient.userUuid,
          );
        }
      }

      return {
        skipped: 0,
        ...delivery,
      };
    } catch (error: unknown) {
      if (eventKey) {
        await this.deliveries.release(
          eventKey,
          recipient.userUuid,
        );
      }

      throw error;
    }
  }

  private deliver(
    recipient: NotificationRecipient,
    input: NotificationDispatchInput,
  ): Promise<PushDeliverySummary> {
    const content =
      input.content[recipient.locale];

    const notification:
      PushNotification = {
        title: content.title,
        body: content.body,
        url: input.url,
        tag:
          input.tag ??
          defaultNotificationTagFor(
            input.type,
          ),
      };

    return this.push.sendToUser(
      recipient.userUuid,
      notification,
    );
  }
}
