import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { AdminGuard } from '../auth/guards/admin.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AUTH_SESSION_COOKIE } from '../auth/session-cookie';
import { CreateLocalizationDto } from './dto/create-localization.dto';
import { LocalizationResponseDto } from './dto/localization-response.dto';
import { UpdateLocalizationDto } from './dto/update-localization.dto';
import {
  LOCALIZATION_LOCALES,
  type LocalizationLocale,
} from './localization-locale';
import { LocalizationsService } from './localizations.service';

@ApiTags('Localizations')
@Controller('localizations')
export class LocalizationsController {
  constructor(private readonly localizationsService: LocalizationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all localizations',
  })
  @ApiOkResponse({
    type: LocalizationResponseDto,
    isArray: true,
  })
  getAll(): Promise<LocalizationResponseDto[]> {
    return this.localizationsService.getAll();
  }

  @Get('locale/:locale')
  @ApiOperation({
    summary: 'Get all localization values for one locale',
  })
  @ApiParam({
    name: 'locale',
    enum: [...LOCALIZATION_LOCALES],
  })
  @ApiOkResponse({
    description: 'A key-value map for the requested locale.',
    schema: {
      type: 'object',
      additionalProperties: {
        type: 'string',
      },
      example: {
        'hero.subtitle': 'Live-Musik mit Mimi.',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'The requested locale is not supported.',
  })
  getForLocale(
    @Param('locale') locale: string,
  ): Promise<Record<string, string>> {
    if (!this.isSupportedLocale(locale)) {
      throw new BadRequestException(`Unsupported locale "${locale}".`);
    }

    return this.localizationsService.getForLocale(locale);
  }

  @Get(':uuid')
  @ApiOperation({
    summary: 'Get one localization',
  })
  @ApiParam({
    name: 'uuid',
    format: 'uuid',
  })
  @ApiOkResponse({
    type: LocalizationResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'The localization does not exist.',
  })
  getByUuid(@Param('uuid') uuid: string): Promise<LocalizationResponseDto> {
    return this.localizationsService.getByUuid(uuid);
  }

  @ApiCookieAuth(AUTH_SESSION_COOKIE)
  @UseGuards(SessionAuthGuard, AdminGuard)
  @Post()
  @ApiOperation({
    summary: 'Create a localization',
  })
  @ApiCreatedResponse({
    type: LocalizationResponseDto,
  })
  @ApiConflictResponse({
    description: 'The localization key already exists.',
  })
  create(
    @Body() dto: CreateLocalizationDto,
  ): Promise<LocalizationResponseDto> {
    return this.localizationsService.create(dto);
  }

  @ApiCookieAuth(AUTH_SESSION_COOKIE)
  @UseGuards(SessionAuthGuard, AdminGuard)
  @Patch(':uuid')
  @ApiOperation({
    summary: 'Update a localization',
  })
  @ApiParam({
    name: 'uuid',
    format: 'uuid',
  })
  @ApiOkResponse({
    type: LocalizationResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'The localization does not exist.',
  })
  @ApiConflictResponse({
    description: 'The localization key already exists.',
  })
  update(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateLocalizationDto,
  ): Promise<LocalizationResponseDto> {
    return this.localizationsService.update(uuid, dto);
  }

  @ApiCookieAuth(AUTH_SESSION_COOKIE)
  @UseGuards(SessionAuthGuard, AdminGuard)
  @Delete(':uuid')
  @ApiOperation({
    summary: 'Delete a localization',
  })
  @ApiParam({
    name: 'uuid',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'The localization was deleted.',
  })
  @ApiNotFoundResponse({
    description: 'The localization does not exist.',
  })
  delete(@Param('uuid') uuid: string): Promise<void> {
    return this.localizationsService.delete(uuid);
  }

  private isSupportedLocale(locale: string): locale is LocalizationLocale {
    return LOCALIZATION_LOCALES.some(
      (supportedLocale) => supportedLocale === locale,
    );
  }
}
