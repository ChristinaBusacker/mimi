import type {
  EntityManager,
} from 'typeorm';

export const musicPublicationTrackingMigration = {
  name:
    '20260928-music-publication-tracking',
  run: async (
    manager: EntityManager,
  ): Promise<void> => {
    await manager.query(`
      ALTER TABLE "music_albums"
      ADD COLUMN IF NOT EXISTS
        "publishedAt" timestamptz
    `);

    await manager.query(`
      ALTER TABLE "music_tracks"
      ADD COLUMN IF NOT EXISTS
        "publishedAt" timestamptz
    `);

    await manager.query(`
      UPDATE "music_albums"
      SET "publishedAt" = "createdAt"
      WHERE
        "status" = 'published' AND
        "publishedAt" IS NULL
    `);

    await manager.query(`
      UPDATE "music_tracks"
      SET "publishedAt" = "createdAt"
      WHERE
        "status" = 'published' AND
        "publishedAt" IS NULL
    `);
  },
};
