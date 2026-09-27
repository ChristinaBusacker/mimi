import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  DataTransferProvider,
} from './data-transfer-provider';
import { DataTransferService } from './data-transfer.service';

const preview = {
  summary: {
    created: 1,
    updated: 2,
    unchanged: 3,
    deleted: 0,
  },
  warnings: [],
};

function createProvider(
  type = 'example',
): DataTransferProvider {
  return {
    type,
    schemaVersion: 1,
    exportData: vi.fn(
      async () => ({
        value: 'exported',
      }),
    ),
    validateImport: vi.fn(
      async () => preview,
    ),
    importData: vi.fn(
      async () => preview,
    ),
  };
}

function createPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    format: 'mimi-export',
    version: 1,
    type: 'example',
    schemaVersion: 1,
    exportedAt:
      '2026-09-27T20:00:00.000Z',
    data: {
      value: 'imported',
    },
    ...overrides,
  };
}

describe(
  'DataTransferService',
  () => {
    it(
      'registers and lists providers',
      () => {
        const service =
          new DataTransferService();

        service.register(
          createProvider('second'),
        );
        service.register(
          createProvider('first'),
        );

        expect(
          service.listProviders(),
        ).toEqual([
          {
            type: 'first',
            schemaVersion: 1,
          },
          {
            type: 'second',
            schemaVersion: 1,
          },
        ]);
      },
    );

    it(
      'rejects duplicate provider types',
      () => {
        const service =
          new DataTransferService();

        service.register(
          createProvider(),
        );

        expect(() =>
          service.register(
            createProvider(),
          ),
        ).toThrow(
          'Data transfer provider "example" is already registered.',
        );
      },
    );

    it(
      'wraps exported provider data in a versioned envelope',
      async () => {
        const service =
          new DataTransferService();

        service.register(
          createProvider(),
        );

        const result =
          await service.export(
            'example',
          );

        expect(result).toMatchObject({
          format: 'mimi-export',
          version: 1,
          type: 'example',
          schemaVersion: 1,
          data: {
            value: 'exported',
          },
        });
        expect(
          Number.isNaN(
            Date.parse(
              result.exportedAt,
            ),
          ),
        ).toBe(false);
      },
    );

    it(
      'validates an import without writing data',
      async () => {
        const service =
          new DataTransferService();
        const provider =
          createProvider();

        service.register(provider);

        const result =
          await service.validateImport(
            'example',
            createPayload(),
          );

        expect(result).toEqual({
          provider: {
            type: 'example',
            schemaVersion: 1,
          },
          preview,
        });
        expect(
          provider.validateImport,
        ).toHaveBeenCalledWith({
          value: 'imported',
        });
        expect(
          provider.importData,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'validates again before importing and passes the admin context',
      async () => {
        const service =
          new DataTransferService();
        const provider =
          createProvider();

        service.register(provider);

        const result =
          await service.import(
            'example',
            createPayload(),
            {
              userUuid: 'user-1',
            },
          );

        expect(
          provider.validateImport,
        ).toHaveBeenCalledOnce();
        expect(
          provider.importData,
        ).toHaveBeenCalledWith(
          {
            value: 'imported',
          },
          {
            userUuid: 'user-1',
          },
        );
        expect(result).toMatchObject({
          provider: {
            type: 'example',
            schemaVersion: 1,
          },
          summary: preview.summary,
          warnings: [],
        });
      },
    );

    it.each([
      [
        'format',
        {
          format: 'something-else',
        },
      ],
      [
        'version',
        {
          version: 2,
        },
      ],
      [
        'type',
        {
          type: 'different',
        },
      ],
      [
        'schema version',
        {
          schemaVersion: 2,
        },
      ],
      [
        'timestamp',
        {
          exportedAt: 'not-a-date',
        },
      ],
    ])(
      'rejects an incompatible import %s',
      async (_label, overrides) => {
        const service =
          new DataTransferService();

        service.register(
          createProvider(),
        );

        await expect(
          service.validateImport(
            'example',
            createPayload(
              overrides,
            ),
          ),
        ).rejects.toBeInstanceOf(
          BadRequestException,
        );
      },
    );

    it(
      'rejects imports without a data property',
      async () => {
        const service =
          new DataTransferService();
        const payload =
          createPayload();

        delete payload['data'];
        service.register(
          createProvider(),
        );

        await expect(
          service.validateImport(
            'example',
            payload,
          ),
        ).rejects.toBeInstanceOf(
          BadRequestException,
        );
      },
    );

    it(
      'rejects unknown providers',
      async () => {
        const service =
          new DataTransferService();

        await expect(
          service.export('unknown'),
        ).rejects.toBeInstanceOf(
          NotFoundException,
        );
      },
    );
  },
);
