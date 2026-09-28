import type { Repository } from 'typeorm';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { NotificationDeliveryEntry } from './entities/notification-delivery.entry';
import { NotificationEventEntry } from './entities/notification-event.entry';
import { NotificationDeliveryService } from './notification-delivery.service';

function createService(): {
  service: NotificationDeliveryService;
  findOneBy: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
} {
  const findOneBy = vi.fn();
  const save = vi.fn();
  const events = {
    findOneBy,
    save,
  } as unknown as Repository<NotificationEventEntry>;
  const deliveries =
    {} as unknown as Repository<NotificationDeliveryEntry>;

  return {
    service: new NotificationDeliveryService(
      events,
      deliveries,
    ),
    findOneBy,
    save,
  };
}

function createEvent(
  type: NotificationEventEntry['type'],
  context: Record<string, unknown> | null = null,
): NotificationEventEntry {
  const event = new NotificationEventEntry();

  event.key = 'event-1';
  event.type = type;
  event.context = context;

  return event;
}

describe(
  'NotificationDeliveryService quality gate',
  () => {
    it(
      'reuses an existing event with the same type without rewriting it',
      async () => {
        const {
          service,
          findOneBy,
          save,
        } = createService();
        const existing = createEvent(
          'stream.reminder',
          {
            segmentId: 'segment-1',
          },
        );

        findOneBy.mockResolvedValue(
          existing,
        );

        await expect(
          service.ensureEvent(
            existing.key,
            existing.type,
            {
              segmentId: 'changed',
            },
          ),
        ).resolves.toBe(existing);
        expect(save).not.toHaveBeenCalled();
        expect(existing.context).toEqual({
          segmentId: 'segment-1',
        });
      },
    );

    it(
      'rejects an event key that is reused for another notification type',
      async () => {
        const {
          service,
          findOneBy,
        } = createService();

        findOneBy.mockResolvedValue(
          createEvent('stream.live'),
        );

        await expect(
          service.ensureEvent(
            'event-1',
            'stream.reminder',
            null,
          ),
        ).rejects.toThrow(
          'already exists with type',
        );
      },
    );

    it(
      'recovers from a concurrent insert when another process created the same event first',
      async () => {
        const {
          service,
          findOneBy,
          save,
        } = createService();
        const concurrent = createEvent(
          'blog.published',
        );

        findOneBy
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(
            concurrent,
          );
        save.mockRejectedValue(
          new Error('duplicate key'),
        );

        await expect(
          service.ensureEvent(
            concurrent.key,
            concurrent.type,
            null,
          ),
        ).resolves.toBe(concurrent);
      },
    );

    it(
      'updates JSON event context through a loaded entity',
      async () => {
        const {
          service,
          findOneBy,
          save,
        } = createService();
        const existing = createEvent(
          'stream.reminder',
          {
            startsAt:
              '2026-09-28T18:30:00.000Z',
          },
        );
        const nextContext = {
          startsAt:
            '2026-09-28T19:00:00.000Z',
        };

        findOneBy.mockResolvedValue(
          existing,
        );
        save.mockResolvedValue(existing);

        await service.updateEventContext(
          existing.key,
          nextContext,
        );

        expect(existing.context).toEqual(
          nextContext,
        );
        expect(save).toHaveBeenCalledWith(
          existing,
        );
      },
    );
  },
);
