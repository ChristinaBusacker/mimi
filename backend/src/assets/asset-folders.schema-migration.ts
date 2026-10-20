import type { EntityManager } from 'typeorm';

export const assetFoldersMigration = {
  name: '20261020-asset-folders-and-variant-presets',
  run: async (manager: EntityManager): Promise<void> => {
    await manager.query(`
      CREATE TABLE IF NOT EXISTS "asset_folders" (
        "uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "parentId" uuid,
        "name" varchar(120) NOT NULL,
        CONSTRAINT "FK_asset_folders_parent" FOREIGN KEY ("parentId")
          REFERENCES "asset_folders"("uuid") ON DELETE RESTRICT
      )
    `);
    await manager.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_asset_folders_siblings"
      ON "asset_folders" ("parentId", lower("name")) WHERE "parentId" IS NOT NULL
    `);
    await manager.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_asset_folders_root"
      ON "asset_folders" (lower("name")) WHERE "parentId" IS NULL
    `);
    await manager.query(`
      ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "folderId" uuid
    `);
    await manager.query(`
      ALTER TABLE "assets" ADD CONSTRAINT "FK_assets_folder"
      FOREIGN KEY ("folderId") REFERENCES "asset_folders"("uuid") ON DELETE RESTRICT
    `);
    await manager.query(`
      CREATE INDEX IF NOT EXISTS "IDX_assets_folder" ON "assets" ("folderId")
    `);
    await manager.query(`
      ALTER TABLE "asset_variants" ALTER COLUMN "name" TYPE varchar(64)
    `);
  },
};
