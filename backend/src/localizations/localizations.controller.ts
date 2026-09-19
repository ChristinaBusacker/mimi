import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { CreateLocalizationDto } from './dto/create-localization.dto';
import { UpdateLocalizationDto } from './dto/update-localization.dto';
import { LocalizationEntry } from './entities/localization.entry';
import {
  LOCALIZATION_LOCALES,
  type LocalizationLocale,
} from './localization-locale';
import { LocalizationsService } from './localizations.service';

@Controller('localizations')
export class LocalizationsController {
  constructor(private readonly localizationsService: LocalizationsService) {}

  @Get()
  getAll(): Promise<LocalizationEntry[]> {
    return this.localizationsService.getAll();
  }

  @Get('locale/:locale')
  getForLocale(
    @Param('locale') locale: string,
  ): Promise<Record<string, string>> {
    if (!this.isSupportedLocale(locale)) {
      throw new BadRequestException(`Unsupported locale "${locale}".`);
    }

    return this.localizationsService.getForLocale(locale);
  }

  @Get(':uuid')
  getByUuid(@Param('uuid') uuid: string): Promise<LocalizationEntry> {
    return this.localizationsService.getByUuid(uuid);
  }

  @Post()
  create(@Body() dto: CreateLocalizationDto): Promise<LocalizationEntry> {
    return this.localizationsService.create(dto);
  }

  @Patch(':uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateLocalizationDto,
  ): Promise<LocalizationEntry> {
    return this.localizationsService.update(uuid, dto);
  }

  @Delete(':uuid')
  delete(@Param('uuid') uuid: string): Promise<void> {
    return this.localizationsService.delete(uuid);
  }

  private isSupportedLocale(locale: string): locale is LocalizationLocale {
    return LOCALIZATION_LOCALES.some(
      (supportedLocale) => supportedLocale === locale,
    );
  }
}
