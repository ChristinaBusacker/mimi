import type {
  MusicAlbum,
  MusicAlbumReference,
  MusicAlbumSummary,
  MusicTrack,
  MusicTrackListItem,
  MusicTrackSummary,
} from '@shared/music/music';

import { ApiProperty } from '@nestjs/swagger';

export class MusicTrackSummaryDto implements MusicTrackSummary {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  title!: string;

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

  @ApiProperty()
  hasContent!: boolean;
}

export class MusicAlbumSummaryDto implements MusicAlbumSummary {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  title!: string;

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
}

export class MusicAlbumDto
  extends MusicAlbumSummaryDto
  implements MusicAlbum
{
  @ApiProperty()
  contentHtml!: string;

  @ApiProperty({
    type: MusicTrackSummaryDto,
    isArray: true,
  })
  tracks!: MusicTrackSummaryDto[];
}

export class MusicAlbumReferenceDto implements MusicAlbumReference {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    type: String,
  })
  coverAssetId!: string | null;
}

export class MusicTrackListItemDto
  extends MusicTrackSummaryDto
  implements MusicTrackListItem
{
  @ApiProperty({
    type: MusicAlbumReferenceDto,
    nullable: true,
  })
  album!: MusicAlbumReferenceDto | null;
}

export class MusicTrackDto
  extends MusicTrackListItemDto
  implements MusicTrack
{
  @ApiProperty()
  contentHtml!: string;
}
