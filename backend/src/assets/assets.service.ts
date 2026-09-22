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
import {
  InjectDataSource,
  InjectRepository,
} from '@nestjs/typeorm';
import {
  createHash,
  randomUUID,
} from 'node:crypto';
import {
  mkdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import sharp, { type Metadata } from 'sharp';
import {
  DataSource,
  IsNull,
  Repository,
} from 'typeorm';

import {
  ASSET_IMAGE_VARIANT_WIDTHS,
  type AssetImageVariantFormat,
  type AssetImageVariantName,
} from './asset-image-variant';
import { AssetUsageService } from './asset-usage.service';
import {
  getAssetMaxUploadBytes,
  getAssetStoragePath,
} from './asset.config';
import {
  SUPPORTED_ASSET_MIME_TYPES,
  type UploadedAssetFile,
} from './asset-file';
import { AssetEntry } from './entities/asset.entry';
import { AssetVariantEntry } from './entities/asset-variant.entry';

export interface ResolvedAssetFile {
  absolutePath: string;
  mimeType: string;
  sizeBytes: number;
}

interface PreparedVariant {
  name: AssetImageVariantName;
  format: AssetImageVariantFormat;
  extension: string;
  mimeType: string;
  width: number;
  height: number;
  buffer: Buffer;
}

interface PreparedImage {
  mimeType: string;
  extension: string;
  width: number;
  height: number;
  variants: PreparedVariant[];
}

interface StoredFile {
  storageKey: string;
  absolutePath: string;
}

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);
  private readonly storagePath: string;
  private readonly maxUploadBytes: number;

  constructor(
    @InjectRepository(AssetEntry)
    private readonly repository: Repository<AssetEntry>,
    @InjectRepository(AssetVariantEntry)
    private readonly variantRepository: Repository<AssetVariantEntry>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly assetUsageService:
      AssetUsageService,
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

    const configuredMimeType =
      SUPPORTED_ASSET_MIME_TYPES[file.mimetype];

    if (!configuredMimeType) {
      throw new BadRequestException(
        `Unsupported asset type "${file.mimetype}".`,
      );
    }

    const contentHash = this.hash(file.buffer);
    const duplicate = await this.findDuplicate(
      contentHash,
      file.size,
    );

    if (duplicate) {
      return this.mapAsset(duplicate);
    }

    const preparedImage =
      configuredMimeType.type === 'image'
        ? await this.prepareImage(file.buffer)
        : null;
    const uuid = randomUUID();
    const mimeType = preparedImage?.mimeType ?? file.mimetype;
    const extension =
      preparedImage?.extension ?? configuredMimeType.extension;
    const storageKey = `${uuid}.${extension}`;
    const storedFiles: StoredFile[] = [];

    await mkdir(this.storagePath, {
      recursive: true,
    });

    try {
      storedFiles.push(
        await this.storeFile(storageKey, file.buffer),
      );

      const variantEntries = preparedImage
        ? await this.storePreparedVariants(
            uuid,
            preparedImage.variants,
            storedFiles,
          )
        : [];

      const asset = await this.dataSource.transaction(
        async (manager) => {
          const assetRepository =
            manager.getRepository(AssetEntry);
          const variantRepository =
            manager.getRepository(AssetVariantEntry);

          const savedAsset = await assetRepository.save(
            assetRepository.create({
              uuid,
              type: configuredMimeType.type,
              originalFilename: this.normalizeFilename(
                file.originalname,
              ),
              mimeType,
              sizeBytes: file.size,
              contentHash,
              width: preparedImage?.width ?? null,
              height: preparedImage?.height ?? null,
              storageKey,
            }),
          );

          if (variantEntries.length > 0) {
            await variantRepository.save(
              variantEntries,
            );
          }

          return savedAsset;
        },
      );

      return this.mapAsset(asset);
    } catch (error: unknown) {
      await this.removeStoredFiles(storedFiles);

      const concurrentDuplicate =
        await this.repository.findOneBy({
          contentHash,
        });

      if (concurrentDuplicate) {
        return this.mapAsset(concurrentDuplicate);
      }

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

  async getById(uuid: string): Promise<Asset> {
    const asset = await this.findAsset(uuid);

    return this.mapAsset(asset);
  }

  async resolveFile(uuid: string): Promise<ResolvedAssetFile> {
    const asset = await this.findAsset(uuid);

    return this.resolveStoredFile(
      asset.storageKey,
      asset.mimeType,
      `Asset "${uuid}"`,
    );
  }

  async resolveImageVariant(
    uuid: string,
    name: string,
    format: string,
  ): Promise<ResolvedAssetFile> {
    const variantName = this.parseVariantName(name);
    const variantFormat = this.parseVariantFormat(format);
    const asset = await this.findAsset(uuid);

    if (asset.type !== 'image') {
      throw new NotFoundException(
        `Image asset "${uuid}" not found.`,
      );
    }

    let variant = await this.variantRepository.findOneBy({
      assetUuid: uuid,
      name: variantName,
      format: variantFormat,
    });

    if (!variant) {
      await this.generateMissingImageVariants(asset);

      variant = await this.variantRepository.findOneBy({
        assetUuid: uuid,
        name: variantName,
        format: variantFormat,
      });
    }

    if (!variant) {
      throw new NotFoundException(
        `Image variant for asset "${uuid}" not found.`,
      );
    }

    return this.resolveStoredFile(
      variant.storageKey,
      variant.mimeType,
      `Image variant for asset "${uuid}"`,
    );
  }

  async delete(uuid: string): Promise<void> {
    const asset = await this.findAsset(uuid);

    await this.assetUsageService.assertUnused(
      uuid,
    );

    const variants = await this.variantRepository.findBy({
      assetUuid: uuid,
    });

    await this.repository.delete({
      uuid,
    });

    const storedFiles: StoredFile[] = [
      {
        storageKey: asset.storageKey,
        absolutePath: join(
          this.storagePath,
          asset.storageKey,
        ),
      },
      ...variants.map((variant) => ({
        storageKey: variant.storageKey,
        absolutePath: join(
          this.storagePath,
          variant.storageKey,
        ),
      })),
    ];

    await this.removeStoredFiles(storedFiles, true);
  }

  private async findDuplicate(
    contentHash: string,
    sizeBytes: number,
  ): Promise<AssetEntry | null> {
    const existing = await this.repository.findOneBy({
      contentHash,
    });

    if (existing) {
      return existing;
    }

    const legacyCandidates = await this.repository.find({
      where: {
        contentHash: IsNull(),
        sizeBytes,
      },
    });

    for (const candidate of legacyCandidates) {
      const absolutePath = join(
        this.storagePath,
        candidate.storageKey,
      );

      let candidateBuffer: Buffer;

      try {
        candidateBuffer = await readFile(absolutePath);
      } catch {
        continue;
      }

      const candidateHash = this.hash(candidateBuffer);

      if (candidateHash === contentHash) {
        await this.tryClaimLegacyHash(
          candidate,
          candidateHash,
        );

        return (
          (await this.repository.findOneBy({
            contentHash,
          })) ?? candidate
        );
      }

      await this.tryClaimLegacyHash(
        candidate,
        candidateHash,
      );
    }

    return null;
  }

  private async tryClaimLegacyHash(
    asset: AssetEntry,
    contentHash: string,
  ): Promise<void> {
    try {
      const result = await this.repository.update(
        {
          uuid: asset.uuid,
          contentHash: IsNull(),
        },
        {
          contentHash,
        },
      );

      if (result.affected === 1) {
        asset.contentHash = contentHash;
      }
    } catch {
      // An older duplicate may already own the unique hash.
    }
  }

  private async prepareImage(
    buffer: Buffer,
  ): Promise<PreparedImage> {
    let metadata: Metadata;

    try {
      metadata = await sharp(buffer, {
        failOn: 'error',
      }).metadata();
    } catch {
      throw new BadRequestException(
        'The uploaded image could not be decoded.',
      );
    }

    const source = this.resolveImageSource(metadata);
    const width = metadata.width;
    const height = metadata.height;

    if (!width || !height) {
      throw new BadRequestException(
        'The uploaded image has no valid dimensions.',
      );
    }

    const rotated =
      metadata.orientation !== undefined &&
      metadata.orientation >= 5 &&
      metadata.orientation <= 8;
    const displayWidth = rotated ? height : width;
    const displayHeight = rotated ? width : height;
    const variants: PreparedVariant[] = [];

    for (const [name, maxWidth] of Object.entries(
      ASSET_IMAGE_VARIANT_WIDTHS,
    ) as Array<[AssetImageVariantName, number]>) {
      const base = sharp(buffer, {
        failOn: 'error',
      })
        .rotate()
        .resize({
          width: maxWidth,
          fit: 'inside',
          withoutEnlargement: true,
        });

      const webp = await base
        .clone()
        .webp({
          quality: 82,
        })
        .toBuffer({
          resolveWithObject: true,
        });

      variants.push({
        name,
        format: 'webp',
        extension: 'webp',
        mimeType: 'image/webp',
        width: webp.info.width,
        height: webp.info.height,
        buffer: webp.data,
      });

      const fallback = metadata.hasAlpha
        ? await base
            .clone()
            .png({
              compressionLevel: 9,
            })
            .toBuffer({
              resolveWithObject: true,
            })
        : await base
            .clone()
            .jpeg({
              quality: 85,
              mozjpeg: true,
            })
            .toBuffer({
              resolveWithObject: true,
            });

      variants.push({
        name,
        format: 'fallback',
        extension: metadata.hasAlpha ? 'png' : 'jpg',
        mimeType: metadata.hasAlpha
          ? 'image/png'
          : 'image/jpeg',
        width: fallback.info.width,
        height: fallback.info.height,
        buffer: fallback.data,
      });
    }

    return {
      mimeType: source.mimeType,
      extension: source.extension,
      width: displayWidth,
      height: displayHeight,
      variants,
    };
  }

  private resolveImageSource(
    metadata: Metadata,
  ): {
    mimeType: string;
    extension: string;
  } {
    switch (metadata.mediaType) {
      case 'image/jpeg':
        return {
          mimeType: 'image/jpeg',
          extension: 'jpg',
        };
      case 'image/png':
        return {
          mimeType: 'image/png',
          extension: 'png',
        };
      case 'image/webp':
        return {
          mimeType: 'image/webp',
          extension: 'webp',
        };
      case 'image/avif':
        return {
          mimeType: 'image/avif',
          extension: 'avif',
        };
      default:
        throw new BadRequestException(
          `Unsupported image format "${metadata.mediaType ?? metadata.format ?? 'unknown'}".`,
        );
    }
  }

  private async storePreparedVariants(
    assetUuid: string,
    variants: PreparedVariant[],
    storedFiles: StoredFile[],
  ): Promise<AssetVariantEntry[]> {
    const entries: AssetVariantEntry[] = [];

    for (const variant of variants) {
      const storageKey =
        `${randomUUID()}.${variant.extension}`;

      storedFiles.push(
        await this.storeFile(
          storageKey,
          variant.buffer,
        ),
      );

      entries.push(
        this.variantRepository.create({
          assetUuid,
          name: variant.name,
          format: variant.format,
          mimeType: variant.mimeType,
          width: variant.width,
          height: variant.height,
          sizeBytes: variant.buffer.length,
          storageKey,
        }),
      );
    }

    return entries;
  }

  private async generateMissingImageVariants(
    asset: AssetEntry,
  ): Promise<void> {
    const absolutePath = join(
      this.storagePath,
      asset.storageKey,
    );
    const buffer = await readFile(absolutePath).catch(() => null);

    if (!buffer) {
      throw new NotFoundException(
        `Asset "${asset.uuid}" not found.`,
      );
    }

    const prepared = await this.prepareImage(buffer);
    const storedFiles: StoredFile[] = [];

    if (asset.contentHash === null) {
      await this.tryClaimLegacyHash(
        asset,
        this.hash(buffer),
      );
    }

    try {
      const entries = await this.storePreparedVariants(
        asset.uuid,
        prepared.variants,
        storedFiles,
      );

      await this.dataSource.transaction(async (manager) => {
        const assetRepository =
          manager.getRepository(AssetEntry);
        const variantRepository =
          manager.getRepository(AssetVariantEntry);

        if (
          asset.width === null ||
          asset.height === null
        ) {
          await assetRepository.update(
            {
              uuid: asset.uuid,
            },
            {
              width: prepared.width,
              height: prepared.height,
            },
          );
        }

        await variantRepository.save(entries);
      });
    } catch (error: unknown) {
      await this.removeStoredFiles(storedFiles);

      const existingVariantCount =
        await this.variantRepository.countBy({
          assetUuid: asset.uuid,
        });

      if (existingVariantCount > 0) {
        return;
      }

      throw error;
    }
  }

  private async resolveStoredFile(
    storageKey: string,
    mimeType: string,
    label: string,
  ): Promise<ResolvedAssetFile> {
    const absolutePath = join(
      this.storagePath,
      storageKey,
    );

    try {
      const fileStat = await stat(absolutePath);

      if (!fileStat.isFile()) {
        throw new Error('Asset path is not a file.');
      }

      return {
        absolutePath,
        mimeType,
        sizeBytes: fileStat.size,
      };
    } catch (error: unknown) {
      this.logger.error(
        `${label} exists in the database but its file is missing.`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new NotFoundException(`${label} not found.`);
    }
  }

  private async findAsset(
    uuid: string,
  ): Promise<AssetEntry> {
    const asset = await this.repository.findOneBy({
      uuid,
    });

    if (!asset) {
      throw new NotFoundException(`Asset "${uuid}" not found.`);
    }

    return asset;
  }

  private parseVariantName(
    value: string,
  ): AssetImageVariantName {
    if (
      value === 'thumbnail' ||
      value === 'medium' ||
      value === 'large'
    ) {
      return value;
    }

    throw new BadRequestException(
      `Unsupported image variant "${value}".`,
    );
  }

  private parseVariantFormat(
    value: string,
  ): AssetImageVariantFormat {
    if (
      value === 'webp' ||
      value === 'fallback'
    ) {
      return value;
    }

    throw new BadRequestException(
      `Unsupported image variant format "${value}".`,
    );
  }

  private async storeFile(
    storageKey: string,
    buffer: Buffer,
  ): Promise<StoredFile> {
    const absolutePath = join(
      this.storagePath,
      storageKey,
    );

    await writeFile(absolutePath, buffer, {
      flag: 'wx',
    });

    return {
      storageKey,
      absolutePath,
    };
  }

  private async removeStoredFiles(
    files: StoredFile[],
    warn = false,
  ): Promise<void> {
    for (const file of files) {
      try {
        await unlink(file.absolutePath);
      } catch (error: unknown) {
        if (warn) {
          this.logger.warn(
            `Could not remove stored asset file "${file.storageKey}": ${this.getErrorMessage(error)}`,
          );
        }
      }
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

  private hash(buffer: Buffer): string {
    return createHash('sha256')
      .update(buffer)
      .digest('hex');
  }

  private mapAsset(asset: AssetEntry): Asset {
    return {
      id: asset.uuid,
      type: asset.type,
      originalFilename: asset.originalFilename,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      width: asset.width,
      height: asset.height,
      url: `/api/assets/${asset.uuid}`,
      thumbnailUrl:
        asset.type === 'image'
          ? `/api/assets/${asset.uuid}/image/thumbnail/webp`
          : null,
      createdAt: asset.createdAt.toISOString(),
    };
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
