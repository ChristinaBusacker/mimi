import { Logger } from '@nestjs/common';
import type {
  DataSource,
  EntityManager,
} from 'typeorm';

interface SchemaMigration {
  name: string;
  run: (manager: EntityManager) => Promise<void>;
}

const logger = new Logger('SchemaMigrations');

const migrations: readonly SchemaMigration[] = [
  {
    name: '20260921-asset-image-pipeline',
    run: async (manager) => {
      await manager.query(`
        ALTER TABLE "assets"
        ADD COLUMN IF NOT EXISTS "contentHash" varchar(64)
      `);

      await manager.query(`
        ALTER TABLE "assets"
        ADD COLUMN IF NOT EXISTS "width" integer
      `);

      await manager.query(`
        ALTER TABLE "assets"
        ADD COLUMN IF NOT EXISTS "height" integer
      `);

      await manager.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "IDX_assets_contentHash_unique"
        ON "assets" ("contentHash")
        WHERE "contentHash" IS NOT NULL
      `);

      await manager.query(`
        CREATE TABLE IF NOT EXISTS "asset_variants" (
          "assetUuid" uuid NOT NULL,
          "name" varchar(20) NOT NULL,
          "format" varchar(20) NOT NULL,
          "mimeType" varchar(100) NOT NULL,
          "width" integer NOT NULL,
          "height" integer NOT NULL,
          "sizeBytes" integer NOT NULL,
          "storageKey" varchar(100) NOT NULL,
          CONSTRAINT "PK_asset_variants" PRIMARY KEY ("assetUuid", "name", "format"),
          CONSTRAINT "UQ_asset_variants_storageKey" UNIQUE ("storageKey"),
          CONSTRAINT "FK_asset_variants_asset"
            FOREIGN KEY ("assetUuid")
            REFERENCES "assets"("uuid")
            ON DELETE CASCADE
        )
      `);
    },
  },
];

export async function runSchemaMigrations(
  dataSource: DataSource,
): Promise<void> {
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "schema_migrations" (
      "name" varchar(255) PRIMARY KEY,
      "appliedAt" timestamptz NOT NULL DEFAULT now()
    )
  `);

  for (const migration of migrations) {
    const rows = (await dataSource.query(
      `SELECT "name" FROM "schema_migrations" WHERE "name" = $1`,
      [migration.name],
    )) as Array<{ name: string }>;

    if (rows.length > 0) {
      continue;
    }

    logger.log(`Applying schema migration "${migration.name}"...`);

    await dataSource.transaction(async (manager) => {
      await migration.run(manager);
      await manager.query(
        `INSERT INTO "schema_migrations" ("name") VALUES ($1)`,
        [migration.name],
      );
    });

    logger.log(`Schema migration "${migration.name}" applied.`);
  }
}
