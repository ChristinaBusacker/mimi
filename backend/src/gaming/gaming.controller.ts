import {
  BadRequestException,
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import type {
  GamingLocale,
  GamingNextStream,
} from '@shared/gaming/gaming';

import { GamingNextStreamDto } from './dto/gaming-response.dto';
import { GamingService } from './gaming.service';

const GAMING_LOCALES: readonly GamingLocale[] = [
  'de',
  'en',
];

@ApiTags('Gaming')
@Controller('gaming')
export class GamingController {
  constructor(
    private readonly gamingService: GamingService,
  ) {}

  @Get('next-stream')
  @ApiOperation({
    summary:
      'Get the next gaming stream enriched with Steam data',
  })
  @ApiQuery({
    name: 'locale',
    required: false,
    enum: GAMING_LOCALES,
  })
  @ApiOkResponse({
    type: GamingNextStreamDto,
  })
  @ApiBadRequestResponse({
    description: 'The requested locale is not supported.',
  })
  getNextStream(
    @Query('locale') locale?: string,
  ): Promise<GamingNextStream> {
    return this.gamingService.getNextStream(
      this.resolveLocale(locale),
    );
  }

  private resolveLocale(
    locale: string | undefined,
  ): GamingLocale {
    if (locale === undefined) {
      return 'de';
    }

    if (
      !GAMING_LOCALES.some(
        (candidate) => candidate === locale,
      )
    ) {
      throw new BadRequestException(
        `Unsupported gaming locale "${locale}".`,
      );
    }

    return locale as GamingLocale;
  }
}
