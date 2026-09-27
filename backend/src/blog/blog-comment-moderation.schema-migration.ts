import type {
  EntityManager,
} from 'typeorm';

export const blogCommentModerationMigration = {
  name:
    '20260927-blog-comment-moderation',
  run: async (
    manager: EntityManager,
  ): Promise<void> => {
    await manager.query(`
      ALTER TABLE "blog_comments"
      ADD COLUMN IF NOT EXISTS "hiddenAt" timestamptz,
      ADD COLUMN IF NOT EXISTS "hiddenByUserUuid" uuid,
      ADD COLUMN IF NOT EXISTS "featuredAt" timestamptz,
      ADD COLUMN IF NOT EXISTS "featuredByUserUuid" uuid
    `);

    await manager.query(`
      CREATE INDEX IF NOT EXISTS
        "IDX_blog_comments_public_post"
      ON "blog_comments" (
        "postUuid",
        "createdAt"
      )
      WHERE "hiddenAt" IS NULL
    `);
  },
};
