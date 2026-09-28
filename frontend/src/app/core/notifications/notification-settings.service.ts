import type {
  NotificationPreferenceSelection,
  NotificationPreferences,
  UpdateNotificationPreferences,
} from '@shared/notifications/notifications';
import type {
  PushPublicKeyResponse,
  RemovePushSubscription,
  SavePushSubscription,
} from '@shared/push/push';

import {
  isPlatformBrowser,
} from '@angular/common';
import {
  Injectable,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { Store } from '@ngxs/store';
import {
  Observable,
  firstValueFrom,
} from 'rxjs';

import { RequestService } from '../http/request.service';
import { I18nState } from '../i18n/i18n.state';

export type NotificationDeviceState =
  | 'active'
  | 'inactive'
  | 'blocked'
  | 'unavailable'
  | 'server-disabled';

export type PushSetupErrorCode =
  | 'blocked'
  | 'unavailable'
  | 'server-disabled'
  | 'invalid-subscription';

export class PushSetupError extends Error {
  constructor(
    readonly code: PushSetupErrorCode,
  ) {
    super(code);
  }
}

@Injectable({
  providedIn: 'root',
})
export class NotificationSettingsService {
  private readonly request =
    inject(RequestService);
  private readonly swPush =
    inject(SwPush);
  private readonly store =
    inject(Store);
  private readonly isBrowser =
    isPlatformBrowser(
      inject(PLATFORM_ID),
    );

  getPreferences():
    Observable<NotificationPreferences> {
    return this.request.get<NotificationPreferences>(
      '/notifications/preferences',
      {
        deduplicateAcrossTabs: false,
        transferCache: false,
      },
    );
  }

  updatePreferences(
    preferences:
      NotificationPreferenceSelection,
  ): Observable<NotificationPreferences> {
    const body:
      UpdateNotificationPreferences = {
        ...preferences,
        locale:
          this.store.selectSnapshot(
            I18nState.language,
          ),
      };

    return this.request.put<
      NotificationPreferences,
      UpdateNotificationPreferences
    >(
      '/notifications/preferences',
      body,
    );
  }

  async getDeviceState():
    Promise<NotificationDeviceState> {
    if (!this.isBrowser) {
      return 'unavailable';
    }

    const config =
      await this.getPushConfig();

    if (
      !config.enabled ||
      !config.publicKey
    ) {
      return 'server-disabled';
    }

    if (
      !this.swPush.isEnabled ||
      typeof Notification ===
        'undefined'
    ) {
      return 'unavailable';
    }

    if (
      Notification.permission ===
      'denied'
    ) {
      return 'blocked';
    }

    const subscription =
      await firstValueFrom(
        this.swPush.subscription,
      );

    return subscription
      ? 'active'
      : 'inactive';
  }

  async enablePush():
    Promise<void> {
    if (!this.isBrowser) {
      throw new PushSetupError(
        'unavailable',
      );
    }

    const config =
      await this.getPushConfig();

    if (
      !config.enabled ||
      !config.publicKey
    ) {
      throw new PushSetupError(
        'server-disabled',
      );
    }

    if (
      !this.swPush.isEnabled ||
      typeof Notification ===
        'undefined'
    ) {
      throw new PushSetupError(
        'unavailable',
      );
    }

    if (
      Notification.permission ===
      'denied'
    ) {
      throw new PushSetupError(
        'blocked',
      );
    }

    const subscription =
      await this.swPush
        .requestSubscription({
          serverPublicKey:
            config.publicKey,
        });

    let payload:
      SavePushSubscription;

    try {
      payload =
        this.serializeSubscription(
          subscription,
        );
    } catch (error: unknown) {
      await subscription.unsubscribe();
      throw error;
    }

    try {
      await firstValueFrom(
        this.request.post<
          void,
          SavePushSubscription
        >(
          '/push/subscriptions',
          payload,
        ),
      );
    } catch (error: unknown) {
      await subscription.unsubscribe();
      throw error;
    }
  }

  async disablePush():
    Promise<void> {
    if (
      !this.isBrowser ||
      !this.swPush.isEnabled
    ) {
      return;
    }

    const subscription =
      await firstValueFrom(
        this.swPush.subscription,
      );

    if (!subscription) {
      return;
    }

    const body:
      RemovePushSubscription = {
        endpoint:
          subscription.endpoint,
      };

    await firstValueFrom(
      this.request.delete<
        void,
        RemovePushSubscription
      >(
        '/push/subscriptions',
        body,
      ),
    );

    await this.swPush.unsubscribe();
  }

  private getPushConfig():
    Promise<PushPublicKeyResponse> {
    return firstValueFrom(
      this.request.get<PushPublicKeyResponse>(
        '/push/public-key',
        {
          deduplicateAcrossTabs: false,
          transferCache: false,
        },
      ),
    );
  }

  private serializeSubscription(
    subscription: PushSubscription,
  ): SavePushSubscription {
    const serialized =
      subscription.toJSON();
    const p256dh =
      serialized.keys?.[
        'p256dh'
      ];
    const auth =
      serialized.keys?.['auth'];

    if (!p256dh || !auth) {
      throw new PushSetupError(
        'invalid-subscription',
      );
    }

    return {
      endpoint:
        subscription.endpoint,
      expirationTime:
        subscription.expirationTime,
      keys: {
        p256dh,
        auth,
      },
    };
  }
}
