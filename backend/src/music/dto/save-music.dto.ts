import type {
  MusicAdminTranslations,
  SaveMusicAdminAlbum,
  SaveMusicAdminTrack,
} from '@shared/music/music-admin';
import type { MusicPublicationStatus } from '@shared/music/music';

import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class MusicAdminTranslationInputDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  contentMarkdown!: string;
}

export class MusicAdminTranslationsInputDto
  implements MusicAdminTranslations
{
  @ValidateNested()
  @Type(() => MusicAdminTranslationInputDto)
  de!: MusicAdminTranslationInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MusicAdminTranslationInputDto)
  en!: MusicAdminTranslationInputDto | null;
}

export class SaveMusicAdminAlbumDto
  implements SaveMusicAdminAlbum
{
  @IsString()
  @Matches(SLUG_PATTERN)
  slug!: string;

  @IsOptional()
  @IsUUID()
  coverAssetId!: string | null;

  @IsOptional()
  @Matches(DATE_PATTERN)
  releasedAt!: string | null;

  @IsIn(['draft', 'published'])
  status!: MusicPublicationStatus;

  @ValidateNested()
  @Type(() => MusicAdminTranslationsInputDto)
  translations!: MusicAdminTranslationsInputDto;
}

export class SaveMusicAdminTrackDto
  implements SaveMusicAdminTrack
{
  @IsString()
  @Matches(SLUG_PATTERN)
  slug!: string;

  @IsOptional()
  @IsUUID()
  albumId!: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  trackNumber!: number | null;

  @IsInt()
  @Min(1)
  durationSeconds!: number;

  @IsInt()
  @Min(0)
  previewDurationSeconds!: number;

  @IsOptional()
  @IsUUID()
  previewAssetId!: string | null;

  @IsOptional()
  @IsUUID()
  coverAssetId!: string | null;

  @IsOptional()
  @IsUrl({
    require_protocol: true,
  })
  spotifyUrl!: string | null;

  @IsOptional()
  @IsUrl({
    require_protocol: true,
  })
  deezerUrl!: string | null;

  @IsOptional()
  @IsUrl({
    require_protocol: true,
  })
  supportUrl!: string | null;

  @IsIn(['draft', 'published'])
  status!: MusicPublicationStatus;

  @ValidateNested()
  @Type(() => MusicAdminTranslationsInputDto)
  translations!: MusicAdminTranslationsInputDto;
}
