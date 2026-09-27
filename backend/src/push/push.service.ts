import type {
  PushPublicKeyResponse,
  SavePushSubscription,
} from '@shared/push/push';

import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PushSubscriptionEntry } from './entities/push-subscription.entry';
import { PushTransportService } from './push-transport.service';
import type {
  PushDeliverySummary,
  PushNotification,
} from './push.types';

@Injectable()
export class PushService {
  private readonly logger =
    new Logger(PushService.name);

  constructor(
    @InjectRepository(
      PushSubscriptionEntry,
    )
    private readonly repository:
      Repository<PushSubscriptionEntry>,
    private readonly transport:
      PushTransportService,
  ) {}

  getPublicKey():
    PushPublicKeyResponse {
    return {
      enabled:
        this.transport.isEnabled(),
      publicKey:
        this.transport.getPublicKey(),
    };
  }

  async saveSubscription(
    userUuid: string,
    subscription:
      SavePushSubscription,
  ): Promise<void> {
    const existing =
      await this.repository.findOne({
        where: {
          endpoint:
            subscription.endpoint,
        },
      });

    const expiresAt =
      subscription.expirationTime === null
        ? null
        : new Date(
            subscription.expirationTime,
          );

    if (existing) {
      existing.userUuid = userUuid;
      existing.p256dh =
        subscription.keys.p256dh;
      existing.auth =
        subscription.keys.auth;
      existing.expiresAt = expiresAt;

      await this.repository.save(
        existing,
      );

      return;
    }

    await this.repository.save(
      this.repository.create({
        userUuid,
        endpoint:
          subscription.endpoint,
        p256dh:
          subscription.keys.p256dh,
        auth:
          subscription.keys.auth,
        expiresAt,
      }),
    );
  }

  async removeSubscription(
    userUuid: string,
    endpoint: string,
  ): Promise<void> {
    await this.repository.delete({
      userUuid,
      endpoint,
    });
  }

  async sendToUser(
    userUuid: string,
    notification:
      PushNotification,
  ): Promise<PushDeliverySummary> {
    const summary:
      PushDeliverySummary = {
        sent: 0,
        failed: 0,
        removed: 0,
      };

    if (!this.transport.isEnabled()) {
      return summary;
    }

    const subscriptions =
      await this.repository.find({
        where: {
          userUuid,
        },
      });

    const now = Date.now();

    for (
      const subscription
      of subscriptions
    ) {
      if (
        subscription.expiresAt &&
        subscription.expiresAt.getTime() <=
          now
      ) {
        await this.removeByUuid(
          subscription.uuid,
        );
        summary.removed += 1;

        continue;
      }

      try {
        await this.transport.send(
          {
            endpoint:
              subscription.endpoint,
            keys: {
              p256dh:
                subscription.p256dh,
              auth:
                subscription.auth,
            },
          },
          notification,
        );

        summary.sent += 1;
      } catch (error: unknown) {
        const statusCode =
          this.getStatusCode(error);

        if (
          statusCode === 404 ||
          statusCode === 410
        ) {
          await this.removeByUuid(
            subscription.uuid,
          );
          summary.removed += 1;

          continue;
        }

        summary.failed += 1;

        this.logger.warn(
          `Push delivery failed for subscription ${subscription.uuid}: ${this.getErrorMessage(error)}`,
        );
      }
    }

    return summary;
  }

  private async removeByUuid(
    uuid: string,
  ): Promise<void> {
    await this.repository.delete(uuid);
  }

  private getStatusCode(
    error: unknown,
  ): number | null {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('statusCode' in error)
    ) {
      return null;
    }

    const statusCode =
      (
        error as {
          statusCode?: unknown;
        }
      ).statusCode;

    return typeof statusCode ===
      'number'
      ? statusCode
      : null;
  }

  private getErrorMessage(
    error: unknown,
  ): string {
    return error instanceof Error
      ? error.message
      : String(error);
  }
}
