import type {
  DataTransferImportResult,
  DataTransferProviderInfo,
  DataTransferValidationResult,
  MimiExport,
} from '@shared/data-transfer/data-transfer';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  DataTransferImportContext,
  DataTransferProvider,
} from './data-transfer-provider';

const EXPORT_FORMAT = 'mimi-export';
const EXPORT_VERSION = 1;
const PROVIDER_TYPE_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

@Injectable()
export class DataTransferService {
  private readonly providers = new Map<
    string,
    DataTransferProvider
  >();

  register(
    provider: DataTransferProvider,
  ): void {
    const type = provider.type.trim();

    if (!PROVIDER_TYPE_PATTERN.test(type)) {
      throw new Error(
        `Invalid data transfer provider type "${provider.type}".`,
      );
    }

    if (
      !Number.isInteger(
        provider.schemaVersion,
      ) ||
      provider.schemaVersion < 1
    ) {
      throw new Error(
        `Invalid schema version for data transfer provider "${type}".`,
      );
    }

    if (this.providers.has(type)) {
      throw new Error(
        `Data transfer provider "${type}" is already registered.`,
      );
    }

    this.providers.set(type, provider);
  }

  listProviders():
    DataTransferProviderInfo[] {
    return Array.from(
      this.providers.values(),
      (provider) =>
        this.providerInfo(provider),
    ).sort((left, right) =>
      left.type.localeCompare(
        right.type,
      ),
    );
  }

  async export(
    type: string,
  ): Promise<MimiExport> {
    const provider =
      this.getProvider(type);

    return {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      type: provider.type,
      schemaVersion:
        provider.schemaVersion,
      exportedAt:
        new Date().toISOString(),
      data:
        await provider.exportData(),
    };
  }

  async validateImport(
    type: string,
    payload: unknown,
  ): Promise<DataTransferValidationResult> {
    const provider =
      this.getProvider(type);
    const data = this.importData(
      provider,
      payload,
    );

    return {
      provider:
        this.providerInfo(provider),
      preview:
        await provider.validateImport(
          data,
        ),
    };
  }

  async import(
    type: string,
    payload: unknown,
    context: DataTransferImportContext,
  ): Promise<DataTransferImportResult> {
    const provider =
      this.getProvider(type);
    const data = this.importData(
      provider,
      payload,
    );

    await provider.validateImport(data);

    const result =
      await provider.importData(
        data,
        context,
      );

    return {
      provider:
        this.providerInfo(provider),
      summary: result.summary,
      warnings: [...result.warnings],
      importedAt:
        new Date().toISOString(),
    };
  }

  private getProvider(
    type: string,
  ): DataTransferProvider {
    const normalizedType =
      type.trim();
    const provider =
      this.providers.get(
        normalizedType,
      );

    if (!provider) {
      throw new NotFoundException(
        `Data transfer provider "${normalizedType}" not found.`,
      );
    }

    return provider;
  }

  private importData(
    provider: DataTransferProvider,
    payload: unknown,
  ): unknown {
    if (!this.isRecord(payload)) {
      throw new BadRequestException(
        'The import payload must be a Mimi export object.',
      );
    }

    if (
      payload['format'] !==
      EXPORT_FORMAT
    ) {
      throw new BadRequestException(
        'The import payload has an unsupported format.',
      );
    }

    if (
      payload['version'] !==
      EXPORT_VERSION
    ) {
      throw new BadRequestException(
        'The import payload has an unsupported export version.',
      );
    }

    if (
      payload['type'] !== provider.type
    ) {
      throw new BadRequestException(
        `The import payload type must be "${provider.type}".`,
      );
    }

    if (
      payload['schemaVersion'] !==
      provider.schemaVersion
    ) {
      throw new BadRequestException(
        `The import payload schema version must be ${provider.schemaVersion}.`,
      );
    }

    if (
      typeof payload['exportedAt'] !==
        'string' ||
      Number.isNaN(
        Date.parse(
          payload['exportedAt'],
        ),
      )
    ) {
      throw new BadRequestException(
        'The import payload has an invalid export timestamp.',
      );
    }

    if (!('data' in payload)) {
      throw new BadRequestException(
        'The import payload does not contain data.',
      );
    }

    return payload['data'];
  }

  private providerInfo(
    provider: DataTransferProvider,
  ): DataTransferProviderInfo {
    return {
      type: provider.type,
      schemaVersion:
        provider.schemaVersion,
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
