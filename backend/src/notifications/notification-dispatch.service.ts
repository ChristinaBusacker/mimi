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
}

export interface NotificationDispatchSummary
  extends PushDeliverySummary {
  recipients: number;
  skipped: number;
}

@Injectable()
export class NotificationDispatchService {
  constructor(
    private readonly preferences:
      NotificationPreferencesService,
    private readonly push:
      PushService,
  ) {}

  async notifyUser(
    userUuid: string,
    input: NotificationDispatchInput,
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

    if (!recipient) {
      return {
        recipients: 0,
        skipped: 1,
        sent: 0,
        failed: 0,
        removed: 0,
      };
    }

    const delivery =
      await this.deliver(
        recipient,
        input,
      );

    return {
      recipients: 1,
      skipped: 0,
      ...delivery,
    };
  }

  async notifySubscribers(
    input: NotificationDispatchInput,
  ): Promise<NotificationDispatchSummary> {
    const group =
      notificationPreferenceGroupFor(
        input.type,
      );
    const recipients =
      await this.preferences
        .listRecipients(group);

    const summary:
      NotificationDispatchSummary = {
        recipients:
          recipients.length,
        skipped: 0,
        sent: 0,
        failed: 0,
        removed: 0,
      };

    for (
      const recipient
      of recipients
    ) {
      const delivery =
        await this.deliver(
          recipient,
          input,
        );

      summary.sent +=
        delivery.sent;
      summary.failed +=
        delivery.failed;
      summary.removed +=
        delivery.removed;
    }

    return summary;
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
