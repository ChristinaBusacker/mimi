import type {
  EntityManager,
} from 'typeorm';

export const blogCommentsMigration = {
  name: '20260927-blog-comments',
  run: async (
    manager: EntityManager,
  ): Promise<void> => {
    await manager.query(`
      CREATE TABLE IF NOT EXISTS
        "blog_comments" (
          "uuid" uuid NOT NULL DEFAULT gen_random_uuid(),
          "postUuid" uuid NOT NULL,
          "userUuid" uuid NOT NULL,
          "content" text NOT NULL,
          "createdAt" timestamptz NOT NULL DEFAULT now(),
          "updatedAt" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT
            "PK_blog_comments"
            PRIMARY KEY ("uuid"),
          CONSTRAINT
            "FK_blog_comments_post"
            FOREIGN KEY ("postUuid")
            REFERENCES "blog_posts"("uuid")
            ON DELETE CASCADE,
          CONSTRAINT
            "FK_blog_comments_user"
            FOREIGN KEY ("userUuid")
            REFERENCES "users"("uuid")
            ON DELETE CASCADE
        )
    `);

    await manager.query(`
      CREATE INDEX IF NOT EXISTS
        "IDX_blog_comments_post_created"
      ON "blog_comments" (
        "postUuid",
        "createdAt"
      )
    `);

    await manager.query(`
      CREATE INDEX IF NOT EXISTS
        "IDX_blog_comments_user"
      ON "blog_comments" (
        "userUuid"
      )
    `);
  },
};
