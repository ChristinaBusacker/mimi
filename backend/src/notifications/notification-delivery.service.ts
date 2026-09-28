import type {
  NotificationType,
} from '@shared/notifications/notifications';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  IsNull,
  Not,
  Repository,
} from 'typeorm';

import { NotificationDeliveryEntry } from './entities/notification-delivery.entry';
import { NotificationEventEntry } from './entities/notification-event.entry';

const STALE_CLAIM_MS =
  5 * 60 * 1000;

@Injectable()
export class NotificationDeliveryService {
  constructor(
    @InjectRepository(
      NotificationEventEntry,
    )
    private readonly events:
      Repository<NotificationEventEntry>,
    @InjectRepository(
      NotificationDeliveryEntry,
    )
    private readonly deliveries:
      Repository<NotificationDeliveryEntry>,
  ) {}

  async ensureEvent(
    key: string,
    type: NotificationType,
    context:
      Record<string, unknown> | null,
  ): Promise<NotificationEventEntry> {
    const existing =
      await this.events.findOneBy({
        key,
      });

    if (existing) {
      this.assertEventType(
        existing,
        type,
      );

      return existing;
    }

    const event =
      new NotificationEventEntry();

    event.key = key;
    event.type = type;
    event.context = context;

    try {
      return await this.events.save(
        event,
      );
    } catch (error: unknown) {
      const concurrent =
        await this.events.findOneBy({
          key,
        });

      if (!concurrent) {
        throw error;
      }

      this.assertEventType(
        concurrent,
        type,
      );

      return concurrent;
    }
  }

  getEvent(
    key: string,
  ): Promise<NotificationEventEntry | null> {
    return this.events.findOneBy({
      key,
    });
  }

  listEventsByType(
    type: NotificationType,
  ): Promise<NotificationEventEntry[]> {
    return this.events.findBy({
      type,
    });
  }

  async updateEventContext(
    key: string,
    context: Record<string, unknown>,
  ): Promise<void> {
    const event =
      await this.events.findOneBy({
        key,
      });

    if (!event) {
      throw new Error(
        `Notification event "${key}" does not exist.`,
      );
    }

    event.context = context;

    await this.events.save(event);
  }

  async claim(
    eventKey: string,
    userUuid: string,
  ): Promise<boolean> {
    const insert =
      await this.deliveries
        .createQueryBuilder()
        .insert()
        .values({
          eventKey,
          userUuid,
          status: 'pending',
          deliveredAt: null,
        })
        .orIgnore()
        .execute();

    if (insert.identifiers.length > 0) {
      return true;
    }

    const staleBefore =
      new Date(
        Date.now() -
          STALE_CLAIM_MS,
      );
    const reclaimed =
      await this.deliveries
        .createQueryBuilder()
        .update()
        .set({
          updatedAt: new Date(),
        })
        .where(
          '"eventKey" = :eventKey',
          {
            eventKey,
          },
        )
        .andWhere(
          '"userUuid" = :userUuid',
          {
            userUuid,
          },
        )
        .andWhere(
          '"status" = :status',
          {
            status: 'pending',
          },
        )
        .andWhere(
          '"updatedAt" < :staleBefore',
          {
            staleBefore,
          },
        )
        .execute();

    return reclaimed.affected === 1;
  }

  async complete(
    eventKey: string,
    userUuid: string,
    delivered: boolean,
  ): Promise<void> {
    await this.deliveries.update(
      {
        eventKey,
        userUuid,
      },
      {
        status: 'completed',
        deliveredAt:
          delivered
            ? new Date()
            : null,
      },
    );
  }

  async release(
    eventKey: string,
    userUuid: string,
  ): Promise<void> {
    await this.deliveries.delete({
      eventKey,
      userUuid,
      status: 'pending',
    });
  }


  private assertEventType(
    event: NotificationEventEntry,
    expectedType: NotificationType,
  ): void {
    if (event.type === expectedType) {
      return;
    }

    throw new Error(
      `Notification event "${event.key}" already exists with type "${event.type}" instead of "${expectedType}".`,
    );
  }

  async listDeliveredUserUuids(
    eventKey: string,
  ): Promise<string[]> {
    const entries =
      await this.deliveries.find({
        where: {
          eventKey,
          status: 'completed',
          deliveredAt:
            Not(IsNull()),
        },
        select: {
          userUuid: true,
        },
      });

    return entries.map(
      (entry) => entry.userUuid,
    );
  }
}
