import type { EntityManager } from 'typeorm';

export const assetImageEditsMigration = {
  name: '20261020-asset-nondestructive-image-edits',
  run: async (manager: EntityManager): Promise<void> => {
    await manager.query(`
      ALTER TABLE "assets"
      ADD COLUMN IF NOT EXISTS "imageEdits" jsonb
    `);
  },
};
