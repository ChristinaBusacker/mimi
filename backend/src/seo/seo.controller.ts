import {
  Controller,
  Get,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { SeoPageOverrideDto } from './dto/seo-page-override.dto';
import { SeoService } from './seo.service';

@ApiTags('SEO')
@Controller('seo')
export class SeoController {
  constructor(
    private readonly seoService:
      SeoService,
  ) {}

  @Get('pages')
  @ApiOperation({
    summary:
      'Get editorial SEO overrides for static pages',
  })
  @ApiOkResponse({
    type: SeoPageOverrideDto,
    isArray: true,
  })
  getPages():
    Promise<SeoPageOverrideDto[]> {
    return this.seoService.getPages();
  }
}
