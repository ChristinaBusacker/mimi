import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AdminGuard } from '../auth/guards/admin.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AUTH_SESSION_COOKIE } from '../auth/session-cookie';
import {
  MusicAdminAlbumDto,
  MusicAdminTrackDto,
} from './dto/music-admin-response.dto';
import {
  SaveMusicAdminAlbumDto,
  SaveMusicAdminTrackDto,
} from './dto/save-music.dto';
import { MusicAdminService } from './music-admin.service';

@ApiTags('Admin Music')
@ApiCookieAuth(AUTH_SESSION_COOKIE)
@UseGuards(SessionAuthGuard, AdminGuard)
@Controller('admin/music')
export class MusicAdminController {
  constructor(
    private readonly musicAdminService: MusicAdminService,
  ) {}

  @Get('albums')
  @ApiOperation({
    summary: 'List all music albums for administration',
  })
  @ApiOkResponse({
    type: MusicAdminAlbumDto,
    isArray: true,
  })
  getAlbums(): Promise<MusicAdminAlbumDto[]> {
    return this.musicAdminService.getAlbums();
  }

  @Get('albums/:uuid')
  @ApiOperation({
    summary: 'Get one music album for administration',
  })
  @ApiOkResponse({
    type: MusicAdminAlbumDto,
  })
  @ApiNotFoundResponse({
    description: 'The album does not exist.',
  })
  getAlbum(
    @Param('uuid') uuid: string,
  ): Promise<MusicAdminAlbumDto> {
    return this.musicAdminService.getAlbum(uuid);
  }

  @Post('albums')
  @ApiOperation({
    summary: 'Create a music album',
  })
  @ApiCreatedResponse({
    type: MusicAdminAlbumDto,
  })
  @ApiConflictResponse({
    description: 'The album slug already exists.',
  })
  createAlbum(
    @Body() dto: SaveMusicAdminAlbumDto,
  ): Promise<MusicAdminAlbumDto> {
    return this.musicAdminService.createAlbum(dto);
  }

  @Patch('albums/:uuid')
  @ApiOperation({
    summary: 'Update a music album',
  })
  @ApiOkResponse({
    type: MusicAdminAlbumDto,
  })
  @ApiNotFoundResponse({
    description: 'The album does not exist.',
  })
  @ApiConflictResponse({
    description: 'The album slug already exists.',
  })
  updateAlbum(
    @Param('uuid') uuid: string,
    @Body() dto: SaveMusicAdminAlbumDto,
  ): Promise<MusicAdminAlbumDto> {
    return this.musicAdminService.updateAlbum(
      uuid,
      dto,
    );
  }

  @Delete('albums/:uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a music album',
  })
  @ApiNoContentResponse({
    description: 'The album was deleted.',
  })
  deleteAlbum(
    @Param('uuid') uuid: string,
  ): Promise<void> {
    return this.musicAdminService.deleteAlbum(uuid);
  }

  @Get('tracks')
  @ApiOperation({
    summary: 'List all music tracks for administration',
  })
  @ApiOkResponse({
    type: MusicAdminTrackDto,
    isArray: true,
  })
  getTracks(): Promise<MusicAdminTrackDto[]> {
    return this.musicAdminService.getTracks();
  }

  @Get('tracks/:uuid')
  @ApiOperation({
    summary: 'Get one music track for administration',
  })
  @ApiOkResponse({
    type: MusicAdminTrackDto,
  })
  @ApiNotFoundResponse({
    description: 'The track does not exist.',
  })
  getTrack(
    @Param('uuid') uuid: string,
  ): Promise<MusicAdminTrackDto> {
    return this.musicAdminService.getTrack(uuid);
  }

  @Post('tracks')
  @ApiOperation({
    summary: 'Create a music track',
  })
  @ApiCreatedResponse({
    type: MusicAdminTrackDto,
  })
  @ApiConflictResponse({
    description: 'The track slug already exists.',
  })
  createTrack(
    @Body() dto: SaveMusicAdminTrackDto,
  ): Promise<MusicAdminTrackDto> {
    return this.musicAdminService.createTrack(dto);
  }

  @Patch('tracks/:uuid')
  @ApiOperation({
    summary: 'Update a music track',
  })
  @ApiOkResponse({
    type: MusicAdminTrackDto,
  })
  @ApiNotFoundResponse({
    description: 'The track does not exist.',
  })
  @ApiConflictResponse({
    description: 'The track slug already exists.',
  })
  updateTrack(
    @Param('uuid') uuid: string,
    @Body() dto: SaveMusicAdminTrackDto,
  ): Promise<MusicAdminTrackDto> {
    return this.musicAdminService.updateTrack(
      uuid,
      dto,
    );
  }

  @Delete('tracks/:uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a music track',
  })
  @ApiNoContentResponse({
    description: 'The track was deleted.',
  })
  deleteTrack(
    @Param('uuid') uuid: string,
  ): Promise<void> {
    return this.musicAdminService.deleteTrack(uuid);
  }
}
