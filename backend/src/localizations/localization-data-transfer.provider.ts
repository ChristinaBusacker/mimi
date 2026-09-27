import type {
  DataTransferPreview,
} from '@shared/data-transfer/data-transfer';
import type {
  LocalizationTransferData,
  LocalizationTransferEntry,
} from '@shared/localizations/localization-transfer';
import {
  BadRequestException,
  Injectable,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type {
  DataSource,
  EntityManager,
} from 'typeorm';

import type {
  DataTransferImportContext,
  DataTransferProvider,
} from '../data-transfer/data-transfer-provider';
import { DataTransferService } from '../data-transfer/data-transfer.service';
import { LocalizationEntry } from './entities/localization.entry';
import { LocalizationsService } from './localizations.service';

const LOCALIZATION_TRANSFER_TYPE =
  'localizations';
const LOCALIZATION_TRANSFER_SCHEMA_VERSION =
  1;
const MAX_LOCALIZATION_KEY_LENGTH = 255;

@Injectable()
export class LocalizationDataTransferProvider
  implements
    DataTransferProvider<LocalizationTransferData>,
    OnModuleInit
{
  readonly type =
    LOCALIZATION_TRANSFER_TYPE;
  readonly schemaVersion =
    LOCALIZATION_TRANSFER_SCHEMA_VERSION;

  constructor(
    private readonly dataTransfer:
      DataTransferService,
    private readonly localizations:
      LocalizationsService,
    @InjectDataSource()
    private readonly dataSource:
      DataSource,
  ) {}

  onModuleInit(): void {
    this.dataTransfer.register(this);
  }

  async exportData():
    Promise<LocalizationTransferData> {
    const entries =
      await this.localizations.getAll();

    return {
      entries: entries.map(
        ({ key, de, en }) => ({
          key,
          de,
          en,
        }),
      ),
    };
  }

  async validateImport(
    data: unknown,
  ): Promise<DataTransferPreview> {
    const parsed = this.parseData(data);
    const current =
      await this.localizations.getAll();

    return this.createPreview(
      parsed.entries,
      current,
    );
  }

  async importData(
    data: unknown,
    _context: DataTransferImportContext,
  ): Promise<DataTransferPreview> {
    const parsed = this.parseData(data);

    return this.dataSource.transaction(
      async (manager) =>
        this.importEntries(
          manager,
          parsed.entries,
        ),
    );
  }

  private async importEntries(
    manager: EntityManager,
    importedEntries:
      LocalizationTransferEntry[],
  ): Promise<DataTransferPreview> {
    const repository =
      manager.getRepository(
        LocalizationEntry,
      );
    const current =
      await repository.find({
        order: {
          key: 'ASC',
        },
      });
    const preview = this.createPreview(
      importedEntries,
      current,
    );
    const currentByKey = new Map(
      current.map((entry) => [
        entry.key,
        entry,
      ]),
    );
    const changed:
      LocalizationEntry[] = [];

    for (const imported of importedEntries) {
      const existing =
        currentByKey.get(imported.key);

      if (!existing) {
        changed.push(
          repository.create({
            key: imported.key,
            de: imported.de,
            en: imported.en,
          }),
        );
        continue;
      }

      if (
        existing.de === imported.de &&
        existing.en === imported.en
      ) {
        continue;
      }

      existing.de = imported.de;
      existing.en = imported.en;
      changed.push(existing);
    }

    if (changed.length > 0) {
      await repository.save(changed);
    }

    return preview;
  }

  private createPreview(
    importedEntries:
      LocalizationTransferEntry[],
    currentEntries:
      Pick<
        LocalizationEntry,
        'key' | 'de' | 'en'
      >[],
  ): DataTransferPreview {
    const currentByKey = new Map(
      currentEntries.map((entry) => [
        entry.key,
        entry,
      ]),
    );
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const imported of importedEntries) {
      const current =
        currentByKey.get(imported.key);

      if (!current) {
        created += 1;
        continue;
      }

      if (
        current.de === imported.de &&
        current.en === imported.en
      ) {
        unchanged += 1;
      } else {
        updated += 1;
      }
    }

    return {
      summary: {
        created,
        updated,
        unchanged,
        deleted: 0,
      },
      warnings: [],
    };
  }

  private parseData(
    data: unknown,
  ): LocalizationTransferData {
    if (
      !this.isRecord(data) ||
      !Array.isArray(data['entries'])
    ) {
      throw new BadRequestException(
        'Localization import data must contain an entries array.',
      );
    }

    const keys = new Set<string>();
    const entries:
      LocalizationTransferEntry[] = [];

    for (
      const [index, value]
      of data['entries'].entries()
    ) {
      if (!this.isRecord(value)) {
        throw new BadRequestException(
          `Localization entry ${index} must be an object.`,
        );
      }

      const key = value['key'];
      const de = value['de'];
      const en = value['en'];

      if (
        typeof key !== 'string' ||
        key.length === 0 ||
        key !== key.trim() ||
        key.length >
          MAX_LOCALIZATION_KEY_LENGTH
      ) {
        throw new BadRequestException(
          `Localization entry ${index} has an invalid key.`,
        );
      }

      if (
        typeof de !== 'string' ||
        typeof en !== 'string'
      ) {
        throw new BadRequestException(
          `Localization entry "${key}" must contain German and English strings.`,
        );
      }

      if (keys.has(key)) {
        throw new BadRequestException(
          `Localization import contains duplicate key "${key}".`,
        );
      }

      keys.add(key);
      entries.push({
        key,
        de,
        en,
      });
    }

    return {
      entries,
    };
  }

  private isRecord(
    value: unknown,
  ): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    );
  }
}
