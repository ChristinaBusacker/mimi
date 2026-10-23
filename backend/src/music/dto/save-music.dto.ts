import type {
  MusicAdminTranslations,
  ReorderMusicAdminTracks,
  SaveMusicAdminAlbum,
  SaveMusicAdminTrack,
} from '@shared/music/music-admin';
import type { MusicPublicationStatus } from '@shared/music/music';

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
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

/** Bound text fields; no free-form JSON passes into the album entity. */
export class MusicAlbumLocalizedTextInputDto {
  @IsString()
  @MaxLength(100)
  de!: string;

  @IsString()
  @MaxLength(100)
  en!: string;
}

export class MusicAlbumCreditInputDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/)
  name!: string;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => MusicAlbumLocalizedTextInputDto)
  role!: MusicAlbumLocalizedTextInputDto;
}

/** Tag limits match the album editor, independently for each language. */
export class MusicAlbumTagsInputDto {
  @IsArray()
  @ArrayMaxSize(16)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  @Matches(/\S/, { each: true })
  de!: string[];

  @IsArray()
  @ArrayMaxSize(16)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  @Matches(/\S/, { each: true })
  en!: string[];
}

export class MusicAlbumEditorialInputDto {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => MusicAlbumLocalizedTextInputDto)
  genre!: MusicAlbumLocalizedTextInputDto;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => MusicAlbumLocalizedTextInputDto)
  mood!: MusicAlbumLocalizedTextInputDto;

  @IsDefined()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => MusicAlbumCreditInputDto)
  credits!: MusicAlbumCreditInputDto[];

  @IsOptional()
  @IsUUID()
  heroAssetId?: string | null;

  @IsOptional()
  @MaxLength(500)
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  spotifyUrl?: string | null;

  @IsOptional()
  @MaxLength(500)
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  deezerUrl?: string | null;

  /** Support may link to the internal support page or to an HTTPS provider. */
  @IsOptional()
  @MaxLength(500)
  @Matches(/^(?:https:\/\/\S+|\/(?!\/)\S+)$/)
  supportUrl?: string | null;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MusicAlbumTagsInputDto)
  tags?: MusicAlbumTagsInputDto;
}

export class SaveAlbumBookletDto {
  @IsObject()
  document!: unknown;
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

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MusicAlbumEditorialInputDto)
  editorial?: MusicAlbumEditorialInputDto;

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

  @ValidateIf(
    (_object, value) =>
      value !== null &&
      value !== undefined &&
      value !== '',
  )
  @IsUrl({
    require_protocol: true,
    protocols: ['http', 'https'],
  })
  spotifyUrl!: string | null;

  @ValidateIf(
    (_object, value) =>
      value !== null &&
      value !== undefined &&
      value !== '',
  )
  @IsUrl({
    require_protocol: true,
    protocols: ['http', 'https'],
  })
  deezerUrl!: string | null;

  @ValidateIf(
    (_object, value) =>
      value !== null &&
      value !== undefined &&
      value !== '',
  )
  @IsUrl({
    require_protocol: true,
    protocols: ['http', 'https'],
  })
  supportUrl!: string | null;

  @IsIn(['draft', 'published'])
  status!: MusicPublicationStatus;

  @ValidateNested()
  @Type(() => MusicAdminTranslationsInputDto)
  translations!: MusicAdminTranslationsInputDto;
}

export class ReorderMusicAdminTracksDto
  implements ReorderMusicAdminTracks
{
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', {
    each: true,
  })
  trackIds!: string[];
}
