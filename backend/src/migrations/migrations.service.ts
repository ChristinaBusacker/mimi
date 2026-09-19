import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { existsSync, promises as fs } from 'node:fs';
import { join } from 'node:path';

import { LocalizationEntry } from '../localizations/entities/localization.entry';
import { MigrationEntry } from './entities/migration.entry';
import type { MigrationPatch } from './types/migration-patch';

@Injectable()
export class MigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.run();
  }

  async run(): Promise<void> {
    const patchDirectory = this.resolvePatchDirectory();

    const files = (await fs.readdir(patchDirectory))
      .filter((file) => file.endsWith('.json'))
      .sort();

    for (const file of files) {
      await this.runPatch(patchDirectory, file);
    }
  }

  private async runPatch(patchDirectory: string, file: string): Promise<void> {
    const migrationName = file.replace(/\.json$/, '');

    const alreadyApplied = await this.dataSource.getRepository(MigrationEntry).exists({
      where: {
        name: migrationName,
      },
    });

    if (alreadyApplied) {
      return;
    }

    this.logger.log(`Applying migration "${migrationName}"...`);

    const path = join(patchDirectory, file);

    const content = await fs.readFile(path, 'utf8');

    const patch = JSON.parse(content) as MigrationPatch;

    await this.dataSource.transaction(async (manager) => {
      await this.applyLocalizations(manager, patch);

      const migrationRepository = manager.getRepository(MigrationEntry);

      await migrationRepository.save({
        name: migrationName,
      });
    });

    this.logger.log(`Migration "${migrationName}" applied.`);
  }

  private async applyLocalizations(manager: EntityManager, patch: MigrationPatch): Promise<void> {
    if (!patch.localizations?.length) {
      return;
    }

    const repository = manager.getRepository(LocalizationEntry);

    for (const localization of patch.localizations) {
      const existing = await repository.findOneBy({
        key: localization.key,
      });

      if (existing) {
        existing.de = localization.de;
        existing.en = localization.en;

        await repository.save(existing);

        continue;
      }

      await repository.save(
        repository.create({
          key: localization.key,
          de: localization.de,
          en: localization.en,
        }),
      );
    }
  }

  private resolvePatchDirectory(): string {
    const productionPath = join(__dirname, 'patches');

    if (existsSync(productionPath)) {
      return productionPath;
    }

    return join(process.cwd(), 'backend', 'src', 'migrations', 'patches');
  }
}
