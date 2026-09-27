import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webPush from 'web-push';

import type {
  PushNotification,
  PushTransportSubscription,
} from './push.types';

const DEFAULT_NOTIFICATION_ICON =
  '/images/icons/pwa-192.png';

@Injectable()
export class PushTransportService {
  private readonly enabled: boolean;
  private readonly publicKey: string | null;

  constructor(
    config: ConfigService,
  ) {
    const publicKey =
      this.readConfig(
        config,
        'WEB_PUSH_VAPID_PUBLIC_KEY',
      );
    const privateKey =
      this.readConfig(
        config,
        'WEB_PUSH_VAPID_PRIVATE_KEY',
      );
    const subject =
      this.readConfig(
        config,
        'WEB_PUSH_VAPID_SUBJECT',
      );

    const configured = [
      publicKey,
      privateKey,
      subject,
    ].filter(
      (value) => value !== null,
    ).length;

    if (configured === 0) {
      this.enabled = false;
      this.publicKey = null;

      return;
    }

    if (
      publicKey === null ||
      privateKey === null ||
      subject === null
    ) {
      throw new Error(
        'Web push VAPID configuration is incomplete. Set WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY and WEB_PUSH_VAPID_SUBJECT together.',
      );
    }

    if (
      !subject.startsWith('mailto:') &&
      !subject.startsWith('https://')
    ) {
      throw new Error(
        'WEB_PUSH_VAPID_SUBJECT must start with "mailto:" or "https://".',
      );
    }

    webPush.setVapidDetails(
      subject,
      publicKey,
      privateKey,
    );

    this.enabled = true;
    this.publicKey = publicKey;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getPublicKey(): string | null {
    return this.publicKey;
  }

  async send(
    subscription: PushTransportSubscription,
    notification: PushNotification,
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const data =
      notification.url
        ? {
            onActionClick: {
              default: {
                operation:
                  'navigateLastFocusedOrOpen',
                url: notification.url,
              },
            },
          }
        : undefined;

    await webPush.sendNotification(
      subscription,
      JSON.stringify({
        notification: {
          title: notification.title,
          body: notification.body,
          icon: DEFAULT_NOTIFICATION_ICON,
          badge: DEFAULT_NOTIFICATION_ICON,
          tag: notification.tag,
          data,
        },
      }),
    );
  }

  private readConfig(
    config: ConfigService,
    key: string,
  ): string | null {
    const value =
      config.get<string>(key)?.trim();

    return value
      ? value
      : null;
  }
}
