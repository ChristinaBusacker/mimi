import type {
  SavePushSubscription,
} from '@shared/push/push';

import type {
  Repository,
} from 'typeorm';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { PushSubscriptionEntry } from './entities/push-subscription.entry';
import { PushService } from './push.service';
import { PushTransportService } from './push-transport.service';

describe(
  'PushService',
  () => {
    const repository = {
      create: vi.fn(),
      delete: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
      save: vi.fn(),
    };

    const transport = {
      getPublicKey: vi.fn(),
      isEnabled: vi.fn(),
      send: vi.fn(),
    };

    let service: PushService;

    beforeEach(() => {
      vi.resetAllMocks();

      service = new PushService(
        repository as unknown as
          Repository<PushSubscriptionEntry>,
        transport as unknown as
          PushTransportService,
      );
    });

    it(
      'reassigns an existing browser subscription to the current user',
      async () => {
        const existing = {
          uuid: 'subscription-1',
          userUuid: 'old-user',
          endpoint:
            'https://push.example/subscription',
          p256dh: 'old-p256dh',
          auth: 'old-auth',
          expiresAt: null,
        } as PushSubscriptionEntry;

        repository.findOne
          .mockResolvedValue(existing);
        repository.save
          .mockResolvedValue(existing);

        const input:
          SavePushSubscription = {
            endpoint:
              existing.endpoint,
            expirationTime:
              1_900_000_000_000,
            keys: {
              p256dh: 'new-p256dh',
              auth: 'new-auth',
            },
          };

        await service.saveSubscription(
          'new-user',
          input,
        );

        expect(existing.userUuid)
          .toBe('new-user');
        expect(existing.p256dh)
          .toBe('new-p256dh');
        expect(existing.auth)
          .toBe('new-auth');
        expect(
          existing.expiresAt?.getTime(),
        ).toBe(
          input.expirationTime,
        );
        expect(repository.save)
          .toHaveBeenCalledWith(existing);
      },
    );

    it(
      'removes a subscription only for the current user',
      async () => {
        repository.delete
          .mockResolvedValue({
            affected: 1,
          });

        await service.removeSubscription(
          'user-1',
          'https://push.example/subscription',
        );

        expect(repository.delete)
          .toHaveBeenCalledWith({
            userUuid: 'user-1',
            endpoint:
              'https://push.example/subscription',
          });
      },
    );

    it(
      'removes expired and provider-invalid subscriptions while sending valid ones',
      async () => {
        transport.isEnabled
          .mockReturnValue(true);

        repository.find
          .mockResolvedValue([
            {
              uuid: 'expired',
              endpoint:
                'https://push.example/expired',
              p256dh: 'p1',
              auth: 'a1',
              expiresAt:
                new Date(
                  Date.now() - 1_000,
                ),
            },
            {
              uuid: 'gone',
              endpoint:
                'https://push.example/gone',
              p256dh: 'p2',
              auth: 'a2',
              expiresAt: null,
            },
            {
              uuid: 'valid',
              endpoint:
                'https://push.example/valid',
              p256dh: 'p3',
              auth: 'a3',
              expiresAt: null,
            },
          ] as PushSubscriptionEntry[]);

        repository.delete
          .mockResolvedValue({
            affected: 1,
          });

        transport.send
          .mockRejectedValueOnce(
            Object.assign(
              new Error('Gone'),
              {
                statusCode: 410,
              },
            ),
          )
          .mockResolvedValueOnce(
            undefined,
          );

        const result =
          await service.sendToUser(
            'user-1',
            {
              title: 'Test',
              body: 'Test body',
            },
          );

        expect(result).toEqual({
          sent: 1,
          failed: 0,
          removed: 2,
        });

        expect(repository.delete)
          .toHaveBeenCalledWith(
            'expired',
          );
        expect(repository.delete)
          .toHaveBeenCalledWith(
            'gone',
          );
        expect(transport.send)
          .toHaveBeenCalledTimes(2);
      },
    );

    it(
      'counts non-terminal provider errors as failed deliveries',
      async () => {
        transport.isEnabled
          .mockReturnValue(true);

        repository.find
          .mockResolvedValue([
            {
              uuid: 'temporary-failure',
              endpoint:
                'https://push.example/failure',
              p256dh: 'p1',
              auth: 'a1',
              expiresAt: null,
            },
          ] as PushSubscriptionEntry[]);

        transport.send
          .mockRejectedValue(
            Object.assign(
              new Error(
                'Service unavailable',
              ),
              {
                statusCode: 503,
              },
            ),
          );

        const result =
          await service.sendToUser(
            'user-1',
            {
              title: 'Test',
              body: 'Test body',
            },
          );

        expect(result).toEqual({
          sent: 0,
          failed: 1,
          removed: 0,
        });
        expect(repository.delete)
          .not.toHaveBeenCalled();
      },
    );

    it(
      'does not query subscriptions when web push is disabled',
      async () => {
        transport.isEnabled
          .mockReturnValue(false);

        const result =
          await service.sendToUser(
            'user-1',
            {
              title: 'Test',
              body: 'Test body',
            },
          );

        expect(result).toEqual({
          sent: 0,
          failed: 0,
          removed: 0,
        });
        expect(repository.find)
          .not.toHaveBeenCalled();
      },
    );
  },
);
