import type {
  EntityManager,
} from 'typeorm';

export const seoEditorialMetadataMigration = {
  name:
    '20260930-seo-editorial-metadata',
  run: async (
    manager: EntityManager,
  ): Promise<void> => {
    await manager.query(`
      ALTER TABLE "blog_post_translations"
      ADD COLUMN IF NOT EXISTS
        "seoTitle" varchar(255)
    `);

    await manager.query(`
      ALTER TABLE "blog_post_translations"
      ADD COLUMN IF NOT EXISTS
        "seoDescription" text
    `);

    await manager.query(`
      ALTER TABLE "blog_post_translations"
      ADD COLUMN IF NOT EXISTS
        "coverAltText" text
    `);

    await manager.query(`
      CREATE TABLE IF NOT EXISTS "seo_page_overrides" (
        "pageKey" varchar(50) NOT NULL,
        "locale" varchar(5) NOT NULL,
        "title" varchar(255),
        "description" text,
        "socialTitle" varchar(255),
        "socialDescription" text,
        "socialImageAssetId" uuid,
        "socialImageAlt" text,
        CONSTRAINT "PK_seo_page_overrides"
          PRIMARY KEY ("pageKey", "locale"),
        CONSTRAINT "FK_seo_page_overrides_social_image"
          FOREIGN KEY ("socialImageAssetId")
          REFERENCES "assets"("uuid")
          ON DELETE SET NULL
      )
    `);
  },
};
