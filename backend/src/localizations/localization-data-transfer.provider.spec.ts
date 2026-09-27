import {
  BadRequestException,
} from '@nestjs/common';
import type {
  DataSource,
  EntityManager,
} from 'typeorm';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  DataTransferService,
} from '../data-transfer/data-transfer.service';
import { LocalizationEntry } from './entities/localization.entry';
import { LocalizationDataTransferProvider } from './localization-data-transfer.provider';
import type {
  LocalizationsService,
} from './localizations.service';

interface LocalizationValue {
  uuid: string;
  key: string;
  de: string;
  en: string;
}

function createLocalization(
  key: string,
  de: string,
  en: string,
): LocalizationValue {
  return {
    uuid: `${key}-uuid`,
    key,
    de,
    en,
  };
}

function createProvider(
  current: LocalizationValue[] = [],
) {
  const dataTransfer = {
    register: vi.fn(),
  } as unknown as DataTransferService;
  const localizations = {
    getAll: vi.fn(
      async () =>
        current.map((entry) => ({
          ...entry,
        })),
    ),
  } as unknown as LocalizationsService;
  const repository = {
    find: vi.fn(
      async () =>
        current.map((entry) => ({
          ...entry,
        })),
    ),
    create: vi.fn(
      (
        entry:
          Pick<
            LocalizationEntry,
            'key' | 'de' | 'en'
          >,
      ) => ({
        uuid: `new-${entry.key}`,
        ...entry,
      }),
    ),
    save: vi.fn(
      async (
        entries:
          LocalizationEntry[],
      ) => entries,
    ),
  };
  const manager = {
    getRepository: vi.fn(
      (entity: unknown) => {
        if (entity !== LocalizationEntry) {
          throw new Error(
            'Unexpected entity.',
          );
        }

        return repository;
      },
    ),
  } as unknown as EntityManager;
  const dataSource = {
    transaction: vi.fn(
      async (
        callback: (
          manager: EntityManager,
        ) => Promise<unknown>,
      ) => callback(manager),
    ),
  } as unknown as DataSource;
  const provider =
    new LocalizationDataTransferProvider(
      dataTransfer,
      localizations,
      dataSource,
    );

  return {
    provider,
    dataTransfer,
    localizations,
    repository,
    dataSource,
  };
}

describe(
  'LocalizationDataTransferProvider',
  () => {
    it(
      'registers itself as the localizations provider',
      () => {
        const {
          provider,
          dataTransfer,
        } = createProvider();

        provider.onModuleInit();

        expect(
          dataTransfer.register,
        ).toHaveBeenCalledWith(
          provider,
        );
        expect(provider.type).toBe(
          'localizations',
        );
        expect(
          provider.schemaVersion,
        ).toBe(1);
      },
    );

    it(
      'exports localization values without database identifiers',
      async () => {
        const { provider } =
          createProvider([
            createLocalization(
              'example.title',
              'Beispiel',
              'Example',
            ),
          ]);

        await expect(
          provider.exportData(),
        ).resolves.toEqual({
          entries: [
            {
              key: 'example.title',
              de: 'Beispiel',
              en: 'Example',
            },
          ],
        });
      },
    );

    it(
      'previews created, updated and unchanged localizations without deleting missing keys',
      async () => {
        const { provider } =
          createProvider([
            createLocalization(
              'unchanged',
              'Gleich',
              'Same',
            ),
            createLocalization(
              'updated',
              'Alt',
              'Old',
            ),
            createLocalization(
              'not-imported',
              'Bleibt',
              'Stays',
            ),
          ]);

        await expect(
          provider.validateImport({
            entries: [
              {
                key: 'unchanged',
                de: 'Gleich',
                en: 'Same',
              },
              {
                key: 'updated',
                de: 'Neu',
                en: 'New',
              },
              {
                key: 'created',
                de: 'Neu',
                en: 'New',
              },
            ],
          }),
        ).resolves.toEqual({
          summary: {
            created: 1,
            updated: 1,
            unchanged: 1,
            deleted: 0,
          },
          warnings: [],
        });
      },
    );

    it(
      'rejects duplicate localization keys',
      async () => {
        const { provider } =
          createProvider();

        await expect(
          provider.validateImport({
            entries: [
              {
                key: 'duplicate',
                de: 'Eins',
                en: 'One',
              },
              {
                key: 'duplicate',
                de: 'Zwei',
                en: 'Two',
              },
            ],
          }),
        ).rejects.toBeInstanceOf(
          BadRequestException,
        );
      },
    );

    it(
      'imports changed values in one transaction and keeps entries missing from the import',
      async () => {
        const {
          provider,
          repository,
          dataSource,
        } = createProvider([
          createLocalization(
            'updated',
            'Alt',
            'Old',
          ),
          createLocalization(
            'not-imported',
            'Bleibt',
            'Stays',
          ),
        ]);

        const result =
          await provider.importData(
            {
              entries: [
                {
                  key: 'updated',
                  de: 'Neu',
                  en: 'New',
                },
                {
                  key: 'created',
                  de: 'Angelegt',
                  en: 'Created',
                },
              ],
            },
            {
              userUuid: 'admin-user',
            },
          );

        expect(
          dataSource.transaction,
        ).toHaveBeenCalledOnce();
        expect(
          repository.save,
        ).toHaveBeenCalledOnce();
        expect(
          repository.save,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              key: 'updated',
              de: 'Neu',
              en: 'New',
            }),
            expect.objectContaining({
              key: 'created',
              de: 'Angelegt',
              en: 'Created',
            }),
          ]),
        );
        expect(result).toEqual({
          summary: {
            created: 1,
            updated: 1,
            unchanged: 0,
            deleted: 0,
          },
          warnings: [],
        });
      },
    );
  },
);
