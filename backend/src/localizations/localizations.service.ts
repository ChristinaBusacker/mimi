import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateLocalizationDto } from './dto/create-localization.dto';
import { UpdateLocalizationDto } from './dto/update-localization.dto';
import { LocalizationEntry } from './entities/localization.entry';
import type { LocalizationLocale } from './localization-locale';

@Injectable()
export class LocalizationsService {
  constructor(
    @InjectRepository(LocalizationEntry)
    private readonly localizationRepository: Repository<LocalizationEntry>,
  ) {}

  getAll(): Promise<LocalizationEntry[]> {
    return this.localizationRepository.find({
      order: {
        key: 'ASC',
      },
    });
  }

  async getByUuid(uuid: string): Promise<LocalizationEntry> {
    const localization = await this.localizationRepository.findOneBy({
      uuid,
    });

    if (!localization) {
      throw new NotFoundException(`Localization "${uuid}" not found.`);
    }

    return localization;
  }

  async create(dto: CreateLocalizationDto): Promise<LocalizationEntry> {
    const existing = await this.localizationRepository.findOneBy({
      key: dto.key,
    });

    if (existing) {
      throw new ConflictException(
        `Localization key "${dto.key}" already exists.`,
      );
    }

    const localization = this.localizationRepository.create({
      key: dto.key,
      de: dto.de,
      en: dto.en,
    });

    return this.localizationRepository.save(localization);
  }

  async update(
    uuid: string,
    dto: UpdateLocalizationDto,
  ): Promise<LocalizationEntry> {
    const localization = await this.getByUuid(uuid);

    if (dto.key !== undefined && dto.key !== localization.key) {
      const existing = await this.localizationRepository.findOneBy({
        key: dto.key,
      });

      if (existing) {
        throw new ConflictException(
          `Localization key "${dto.key}" already exists.`,
        );
      }

      localization.key = dto.key;
    }

    if (dto.de !== undefined) {
      localization.de = dto.de;
    }

    if (dto.en !== undefined) {
      localization.en = dto.en;
    }

    return this.localizationRepository.save(localization);
  }

  async delete(uuid: string): Promise<void> {
    const result = await this.localizationRepository.delete({
      uuid,
    });

    if (result.affected === 0) {
      throw new NotFoundException(`Localization "${uuid}" not found.`);
    }
  }

  async getForLocale(
    locale: LocalizationLocale,
  ): Promise<Record<string, string>> {
    const localizations = await this.localizationRepository.find({
      select: {
        key: true,
        de: true,
        en: true,
      },
      order: {
        key: 'ASC',
      },
    });

    return Object.fromEntries(
      localizations.map((localization) => [
        localization.key,
        localization[locale],
      ]),
    );
  }
}
