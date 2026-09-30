import {
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AUTH_SESSION_COOKIE } from '../auth/session-cookie';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import {
  SaveSeoPageOverridesDto,
  SeoPageOverrideDto,
} from './dto/seo-page-override.dto';
import { SeoService } from './seo.service';

@ApiTags('Admin SEO')
@ApiCookieAuth(AUTH_SESSION_COOKIE)
@UseGuards(SessionAuthGuard, AdminGuard)
@Controller('admin/seo')
export class AdminSeoController {
  constructor(
    private readonly seoService:
      SeoService,
  ) {}

  @Get('pages')
  @ApiOperation({
    summary:
      'Get editable SEO overrides for static pages',
  })
  @ApiOkResponse({
    type: SeoPageOverrideDto,
    isArray: true,
  })
  getPages():
    Promise<SeoPageOverrideDto[]> {
    return this.seoService.getPages();
  }

  @Put('pages')
  @ApiOperation({
    summary:
      'Save SEO overrides for static pages',
  })
  @ApiOkResponse({
    type: SeoPageOverrideDto,
    isArray: true,
  })
  savePages(
    @Body() body: SaveSeoPageOverridesDto,
  ): Promise<SeoPageOverrideDto[]> {
    return this.seoService.savePages(
      body.pages,
    );
  }
}
