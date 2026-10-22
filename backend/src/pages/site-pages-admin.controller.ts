import type { SitePageAdmin, SitePageSummary } from '@shared/content/site-page';
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminGuard } from '../auth/guards/admin.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AUTH_SESSION_COOKIE } from '../auth/session-cookie';
import {
  CreateSitePageDto, SaveSitePageDraftDto, UpdateSitePageMetadataDto,
} from './dto/site-page.dto';
import { SitePagesService } from './site-pages.service';

@ApiTags('Admin Pages')
@ApiCookieAuth(AUTH_SESSION_COOKIE)
@UseGuards(SessionAuthGuard, AdminGuard)
@Controller('admin/pages')
export class SitePagesAdminController {
  constructor(private readonly pages: SitePagesService) {}

  @Get()
  @ApiOperation({ summary: 'List system and custom pages, including publication status' })
  list(): Promise<SitePageSummary[]> { return this.pages.list(); }

  @Get(':uuid')
  @ApiOperation({ summary: 'Read a page with draft and published snapshots' })
  get(@Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string): Promise<SitePageAdmin> {
    return this.pages.getAdmin(uuid);
  }

  @Post()
  @ApiOperation({ summary: 'Create a custom page with a stable key' })
  create(@Body() dto: CreateSitePageDto): Promise<SitePageAdmin> {
    return this.pages.create(dto);
  }

  @Patch(':uuid/metadata')
  @ApiOperation({ summary: 'Edit draft page metadata only' })
  updateMetadata(
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Body() dto: UpdateSitePageMetadataDto,
  ): Promise<SitePageAdmin> {
    return this.pages.updateMetadata(uuid, dto.metadata);
  }

  @Patch(':uuid/draft')
  @ApiOperation({ summary: 'Validate and store a standard PageDocument draft' })
  saveDraft(
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Body() dto: SaveSitePageDraftDto,
  ): Promise<SitePageAdmin> {
    return this.pages.saveDraft(uuid, dto.document);
  }

  @Post(':uuid/publish')
  @ApiOperation({ summary: 'Atomically publish draft document and metadata' })
  publish(@Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string): Promise<SitePageAdmin> {
    return this.pages.publish(uuid);
  }

  @Delete(':uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a custom page (system pages are protected)' })
  delete(@Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string): Promise<void> {
    return this.pages.delete(uuid);
  }
}
