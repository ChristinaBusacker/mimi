import type {
  MusicAdminAlbum,
  MusicAdminTrack,
  MusicAdminTranslation,
  MusicAdminTranslations,
} from '@shared/music/music-admin';
import type { MusicPublicationStatus } from '@shared/music/music';

import { ApiProperty } from '@nestjs/swagger';

export class MusicAdminTranslationDto
  implements MusicAdminTranslation
{
  @ApiProperty()
  title!: string;

  @ApiProperty()
  contentMarkdown!: string;
}

export class MusicAdminTranslationsDto
  implements MusicAdminTranslations
{
  @ApiProperty({
    type: MusicAdminTranslationDto,
  })
  de!: MusicAdminTranslationDto;

  @ApiProperty({
    type: MusicAdminTranslationDto,
    nullable: true,
  })
  en!: MusicAdminTranslationDto | null;
}

export class MusicAdminAlbumDto implements MusicAdminAlbum {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    type: String,
  })
  coverAssetId!: string | null;

  @ApiProperty({
    format: 'date',
    nullable: true,
    type: String,
  })
  releasedAt!: string | null;

  @ApiProperty({
    enum: ['draft', 'published'],
  })
  status!: MusicPublicationStatus;

  @ApiProperty({
    type: MusicAdminTranslationsDto,
  })
  translations!: MusicAdminTranslationsDto;

  @ApiProperty({
    format: 'date-time',
  })
  createdAt!: string;

  @ApiProperty({
    format: 'date-time',
  })
  updatedAt!: string;
}

export class MusicAdminTrackDto implements MusicAdminTrack {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    type: String,
  })
  albumId!: string | null;

  @ApiProperty({
    nullable: true,
    type: Number,
  })
  trackNumber!: number | null;

  @ApiProperty()
  durationSeconds!: number;

  @ApiProperty()
  previewDurationSeconds!: number;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    type: String,
  })
  previewAssetId!: string | null;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    type: String,
  })
  coverAssetId!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
  })
  spotifyUrl!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
  })
  deezerUrl!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
  })
  supportUrl!: string | null;

  @ApiProperty({
    enum: ['draft', 'published'],
  })
  status!: MusicPublicationStatus;

  @ApiProperty({
    type: MusicAdminTranslationsDto,
  })
  translations!: MusicAdminTranslationsDto;

  @ApiProperty({
    format: 'date-time',
  })
  createdAt!: string;

  @ApiProperty({
    format: 'date-time',
  })
  updatedAt!: string;
}
