import type { Repository } from 'typeorm';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { NotificationPreferenceEntry } from './entities/notification-preference.entry';
import { NotificationPreferencesService } from './notification-preferences.service';

function createRepository(): {
  repository: Repository<NotificationPreferenceEntry>;
  findOneBy: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
} {
  const findOneBy = vi.fn();
  const create = vi.fn(
    (value: Partial<NotificationPreferenceEntry>) =>
      value as NotificationPreferenceEntry,
  );
  const save = vi.fn(
    async (
      value: NotificationPreferenceEntry,
    ) => value,
  );

  return {
    repository: {
      findOneBy,
      create,
      save,
    } as unknown as Repository<NotificationPreferenceEntry>,
    findOneBy,
    create,
    save,
  };
}

describe(
  'NotificationPreferencesService',
  () => {
    it(
      'keeps every notification category disabled when no preferences exist yet',
      async () => {
        const {
          repository,
          findOneBy,
        } = createRepository();

        findOneBy.mockResolvedValue(
          null,
        );

        const service =
          new NotificationPreferencesService(
            repository,
          );

        await expect(
          service.get('user-1'),
        ).resolves.toEqual({
          streams: false,
          music: false,
          blog: false,
          personal: false,
          locale: 'de',
        });
      },
    );

    it(
      'persists explicit choices without enabling unrelated categories',
      async () => {
        const {
          repository,
          findOneBy,
          save,
        } = createRepository();

        findOneBy.mockResolvedValue(
          null,
        );

        const service =
          new NotificationPreferencesService(
            repository,
          );

        const result =
          await service.update(
            'user-1',
            {
              streams: true,
              music: false,
              blog: true,
              personal: false,
              locale: 'en',
            },
          );

        expect(save)
          .toHaveBeenCalledWith(
            expect.objectContaining({
              userUuid: 'user-1',
              streams: true,
              music: false,
              blog: true,
              personal: false,
              locale: 'en',
            }),
          );
        expect(result).toEqual({
          streams: true,
          music: false,
          blog: true,
          personal: false,
          locale: 'en',
        });
      },
    );
  },
);
