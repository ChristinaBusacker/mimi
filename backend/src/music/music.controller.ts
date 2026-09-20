import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import {
  MusicAlbumDto,
  MusicAlbumSummaryDto,
  MusicTrackDto,
} from './dto/music-response.dto';
import {
  DEFAULT_MUSIC_LOCALE,
  MUSIC_LOCALES,
  isMusicLocale,
  type MusicLocale,
} from './music-locale';
import { MusicService } from './music.service';

@ApiTags('Music')
@Controller('music')
export class MusicController {
  constructor(private readonly musicService: MusicService) {}

  @Get('albums')
  @ApiOperation({
    summary: 'List published music albums',
  })
  @ApiQuery({
    name: 'locale',
    required: false,
    enum: [...MUSIC_LOCALES],
  })
  @ApiOkResponse({
    type: MusicAlbumSummaryDto,
    isArray: true,
  })
  @ApiBadRequestResponse({
    description: 'The requested locale is not supported.',
  })
  getAlbums(
    @Query('locale') locale?: string,
  ): Promise<MusicAlbumSummaryDto[]> {
    return this.musicService.getAlbums(
      this.resolveLocale(locale),
    );
  }

  @Get('albums/:slug')
  @ApiOperation({
    summary: 'Get one published music album',
  })
  @ApiParam({
    name: 'slug',
  })
  @ApiQuery({
    name: 'locale',
    required: false,
    enum: [...MUSIC_LOCALES],
  })
  @ApiOkResponse({
    type: MusicAlbumDto,
  })
  @ApiBadRequestResponse({
    description: 'The requested locale is not supported.',
  })
  @ApiNotFoundResponse({
    description: 'The album does not exist or is not published.',
  })
  getAlbum(
    @Param('slug') slug: string,
    @Query('locale') locale?: string,
  ): Promise<MusicAlbumDto> {
    return this.musicService.getAlbumBySlug(
      slug,
      this.resolveLocale(locale),
    );
  }

  @Get('tracks/:slug')
  @ApiOperation({
    summary: 'Get one published music track',
  })
  @ApiParam({
    name: 'slug',
  })
  @ApiQuery({
    name: 'locale',
    required: false,
    enum: [...MUSIC_LOCALES],
  })
  @ApiOkResponse({
    type: MusicTrackDto,
  })
  @ApiBadRequestResponse({
    description: 'The requested locale is not supported.',
  })
  @ApiNotFoundResponse({
    description: 'The track does not exist or is not published.',
  })
  getTrack(
    @Param('slug') slug: string,
    @Query('locale') locale?: string,
  ): Promise<MusicTrackDto> {
    return this.musicService.getTrackBySlug(
      slug,
      this.resolveLocale(locale),
    );
  }

  private resolveLocale(locale: string | undefined): MusicLocale {
    if (locale === undefined) {
      return DEFAULT_MUSIC_LOCALE;
    }

    if (!isMusicLocale(locale)) {
      throw new BadRequestException(
        `Unsupported locale "${locale}".`,
      );
    }

    return locale;
  }
}
