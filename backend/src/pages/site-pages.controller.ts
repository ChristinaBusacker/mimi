import type { SitePagePublic } from '@shared/content/site-page';
import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { SitePagesService } from './site-pages.service';

@ApiTags('Pages')
@Controller('pages')
export class SitePagesController {
  constructor(private readonly pages: SitePagesService) {}

  @Get(':slug')
  @ApiOperation({ summary: 'Read published page content only (never drafts)' })
  getPublished(@Param('slug') slug: string): Promise<SitePagePublic> {
    return this.pages.getPublished(slug);
  }
}
