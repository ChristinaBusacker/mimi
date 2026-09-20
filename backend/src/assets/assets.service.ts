import type {
  Asset,
  AssetType,
} from '@shared/assets/asset';

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import {
  mkdir,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { Repository } from 'typeorm';

import {
  getAssetMaxUploadBytes,
  getAssetStoragePath,
} from './asset.config';
import {
  SUPPORTED_ASSET_MIME_TYPES,
  type UploadedAssetFile,
} from './asset-file';
import { AssetEntry } from './entities/asset.entry';

export interface ResolvedAssetFile {
  asset: AssetEntry;
  absolutePath: string;
  sizeBytes: number;
}

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);
  private readonly storagePath: string;
  private readonly maxUploadBytes: number;

  constructor(
    @InjectRepository(AssetEntry)
    private readonly repository: Repository<AssetEntry>,
    configService: ConfigService,
  ) {
    const configuredStoragePath = getAssetStoragePath(configService);

    this.storagePath = isAbsolute(configuredStoragePath)
      ? configuredStoragePath
      : resolve(process.cwd(), configuredStoragePath);

    this.maxUploadBytes = getAssetMaxUploadBytes(configService);
  }

  async create(file: UploadedAssetFile): Promise<Asset> {
    this.validateUpload(file);

    const mimeType = SUPPORTED_ASSET_MIME_TYPES[file.mimetype];

    if (!mimeType) {
      throw new BadRequestException(
        `Unsupported asset type "${file.mimetype}".`,
      );
    }

    await mkdir(this.storagePath, {
      recursive: true,
    });

    const storageKey = `${randomUUID()}.${mimeType.extension}`;
    const absolutePath = join(this.storagePath, storageKey);

    await writeFile(absolutePath, file.buffer, {
      flag: 'wx',
    });

    try {
      const asset = await this.repository.save(
        this.repository.create({
          type: mimeType.type,
          originalFilename: this.normalizeFilename(
            file.originalname,
          ),
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storageKey,
        }),
      );

      return this.mapAsset(asset);
    } catch (error: unknown) {
      await unlink(absolutePath).catch(() => undefined);

      throw error;
    }
  }

  async getAll(type?: AssetType): Promise<Asset[]> {
    const assets = await this.repository.find({
      where: type
        ? {
            type,
          }
        : undefined,
      order: {
        createdAt: 'DESC',
      },
    });

    return assets.map((asset) => this.mapAsset(asset));
  }

  async resolveFile(uuid: string): Promise<ResolvedAssetFile> {
    const asset = await this.repository.findOneBy({
      uuid,
    });

    if (!asset) {
      throw new NotFoundException(`Asset "${uuid}" not found.`);
    }

    const absolutePath = join(
      this.storagePath,
      asset.storageKey,
    );

    try {
      const fileStat = await stat(absolutePath);

      if (!fileStat.isFile()) {
        throw new Error('Asset path is not a file.');
      }

      return {
        asset,
        absolutePath,
        sizeBytes: fileStat.size,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Asset "${uuid}" exists in the database but its file is missing.`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new NotFoundException(`Asset "${uuid}" not found.`);
    }
  }

  async delete(uuid: string): Promise<void> {
    const asset = await this.repository.findOneBy({
      uuid,
    });

    if (!asset) {
      throw new NotFoundException(`Asset "${uuid}" not found.`);
    }

    await this.repository.delete({
      uuid,
    });

    const absolutePath = join(
      this.storagePath,
      asset.storageKey,
    );

    try {
      await unlink(absolutePath);
    } catch (error: unknown) {
      this.logger.warn(
        `Could not remove file for deleted asset "${uuid}": ${this.getErrorMessage(error)}`,
      );
    }
  }

  private validateUpload(file: UploadedAssetFile): void {
    if (!file.buffer || file.size <= 0) {
      throw new BadRequestException('The uploaded file is empty.');
    }

    if (file.size > this.maxUploadBytes) {
      throw new BadRequestException(
        'The uploaded file exceeds the configured maximum size.',
      );
    }

    if (!SUPPORTED_ASSET_MIME_TYPES[file.mimetype]) {
      throw new BadRequestException(
        `Unsupported asset type "${file.mimetype}".`,
      );
    }
  }

  private normalizeFilename(filename: string): string {
    const normalized = filename
      .replace(/[\\/]/g, '_')
      .trim();

    return normalized.slice(0, 255) || 'asset';
  }

  private mapAsset(asset: AssetEntry): Asset {
    return {
      id: asset.uuid,
      type: asset.type,
      originalFilename: asset.originalFilename,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      url: `/api/assets/${asset.uuid}`,
      createdAt: asset.createdAt.toISOString(),
    };
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
