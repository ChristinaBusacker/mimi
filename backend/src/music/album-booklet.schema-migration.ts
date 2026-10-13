import type { EntityManager } from 'typeorm';

export const albumBookletSchemaMigration = {
  name: '20261013-album-page-composer',
  run: async (manager: EntityManager): Promise<void> => {
    await manager.query(`
      ALTER TABLE "music_albums"
      ADD COLUMN IF NOT EXISTS "bookletDraft" jsonb
    `);
    await manager.query(`
      ALTER TABLE "music_albums"
      ADD COLUMN IF NOT EXISTS "bookletPublished" jsonb
    `);
  },
};
