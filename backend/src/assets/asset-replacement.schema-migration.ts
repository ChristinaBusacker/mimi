import type { EntityManager } from 'typeorm';

export const assetReplacementMigration = {
  name: '20261021-asset-replacement-revision',
  run: async (manager: EntityManager): Promise<void> => {
    await manager.query(`ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "replacementRevision" varchar(8)`);
  },
};
