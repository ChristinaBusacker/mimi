import { Controller, Get, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { AdminGuard } from '../auth/guards/admin.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AUTH_SESSION_COOKIE } from '../auth/session-cookie';
import { ComposerArchiveService, type ComposerArchiveScope } from './composer-archive.service';

@ApiTags('Composer archive')
@ApiCookieAuth(AUTH_SESSION_COOKIE)
@UseGuards(SessionAuthGuard, AdminGuard)
@Controller('admin/composer-archive')
export class ComposerArchiveController {
  constructor(private readonly archive: ComposerArchiveService) {}

  @Get('export')
  @ApiOperation({ summary: 'Download versioned Composer ZIP with page/booklet snapshots and referenced original assets' })
  @ApiProduces('application/zip')
  async export(
    @Query('scope') scope: ComposerArchiveScope = 'all',
    @Query('id') id?: string,
    @Res({ passthrough: true }) response?: Response,
  ): Promise<StreamableFile> {
    const stream = await this.archive.export(scope, id);
    const suffix = id ? `${scope}-${id}` : scope;
    response?.setHeader('Cache-Control', 'no-store');
    response?.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(stream, {
      type: 'application/zip',
      disposition: `attachment; filename="mimi-composer-${suffix}.zip"`,
    });
  }
}
