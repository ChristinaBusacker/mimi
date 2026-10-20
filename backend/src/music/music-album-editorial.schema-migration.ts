import type { EntityManager } from 'typeorm';

/** Existing albums receive empty editorial metadata without altering their booklets. */
export const musicAlbumEditorialSchemaMigration = {
  name: '20261014-music-album-editorial-metadata',
  run: async (manager: EntityManager): Promise<void> => {
    await manager.query(`
      ALTER TABLE "music_albums"
      ADD COLUMN IF NOT EXISTS "editorial" jsonb NOT NULL
        DEFAULT '{"genre":{"de":"","en":""},"mood":{"de":"","en":""},"credits":[]}'::jsonb
    `);
  },
};
