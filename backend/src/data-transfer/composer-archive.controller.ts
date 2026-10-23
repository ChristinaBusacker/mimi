import { Controller, Get, Post, Query, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiProduces, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { Response } from 'express';

import { AdminGuard } from '../auth/guards/admin.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AUTH_SESSION_COOKIE } from '../auth/session-cookie';
import { ComposerArchiveService, type ComposerArchiveScope } from './composer-archive.service';
import { ComposerArchiveImportService } from './composer-archive-import.service';

@ApiTags('Composer archive')
@ApiCookieAuth(AUTH_SESSION_COOKIE)
@UseGuards(SessionAuthGuard, AdminGuard)
@Controller('admin/composer-archive')
export class ComposerArchiveController {
  constructor(
    private readonly archive: ComposerArchiveService,
    private readonly importer: ComposerArchiveImportService,
  ) {}

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

  @Post('preview')
  @UseInterceptors(FileInterceptor('file', {
    dest: tmpdir(),
    limits: { fileSize: 528 * 1024 * 1024, files: 1 },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Verify a Composer ZIP archive and preview changes without importing' })
  async preview(@UploadedFile() file?: { path: string }, @Query('overwrite') overwrite?: string) {
    if (!file?.path) throw new BadRequestException('A ZIP file is required.');
    try { return await this.importer.preview(file.path, overwrite === '1'); }
    finally { await unlink(file.path).catch(() => undefined); }
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file', {
    dest: tmpdir(),
    limits: { fileSize: 528 * 1024 * 1024, files: 1 },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Import Composer ZIP into drafts; never publish implicitly' })
  async importArchive(@UploadedFile() file?: { path: string }, @Query('overwrite') overwrite?: string) {
    if (!file?.path) throw new BadRequestException('A ZIP file is required.');
    try { return await this.importer.import(file.path, overwrite === '1'); }
    finally { await unlink(file.path).catch(() => undefined); }
  }
}
