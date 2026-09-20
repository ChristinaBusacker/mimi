import { ConfigService } from '@nestjs/config';

const DEFAULT_ASSET_MAX_UPLOAD_MB = 25;
const MAX_ASSET_UPLOAD_MB = 100;

export function getAssetStoragePath(
  configService: ConfigService,
): string {
  return (
    configService.get<string>('ASSET_STORAGE_PATH')?.trim() ||
    'data/uploads'
  );
}

export function getAssetMaxUploadBytes(
  configService: ConfigService,
): number {
  const configuredValue = Number(
    configService.get<string>('ASSET_MAX_UPLOAD_MB') ??
      DEFAULT_ASSET_MAX_UPLOAD_MB,
  );

  if (
    !Number.isInteger(configuredValue) ||
    configuredValue < 1 ||
    configuredValue > MAX_ASSET_UPLOAD_MB
  ) {
    throw new Error(
      `ASSET_MAX_UPLOAD_MB must be an integer between 1 and ${MAX_ASSET_UPLOAD_MB}.`,
    );
  }

  return configuredValue * 1024 * 1024;
}
