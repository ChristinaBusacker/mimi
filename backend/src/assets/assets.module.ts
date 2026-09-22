import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { getAssetMaxUploadBytes } from './asset.config';
import { AdminAssetsController } from './admin-assets.controller';
import { AssetsController } from './assets.controller';
import { AssetEntry } from './entities/asset.entry';
import { AssetVariantEntry } from './entities/asset-variant.entry';
import { AssetsService } from './assets.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      AssetEntry,
      AssetVariantEntry,
    ]),
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        limits: {
          fileSize: getAssetMaxUploadBytes(configService),
          files: 1,
        },
      }),
    }),
  ],
  controllers: [
    AssetsController,
    AdminAssetsController,
  ],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
