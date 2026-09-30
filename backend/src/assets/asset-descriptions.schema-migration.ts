import type { EntityManager } from 'typeorm';

export const assetDescriptionsMigration = {
  name: '20260930-asset-descriptions',
  run: async (
    manager: EntityManager,
  ): Promise<void> => {
    await manager.query(`
      ALTER TABLE "assets"
      ADD COLUMN IF NOT EXISTS "descriptionDe" text
    `);

    await manager.query(`
      ALTER TABLE "assets"
      ADD COLUMN IF NOT EXISTS "descriptionEn" text
    `);

    await manager.query(`
      UPDATE "seo_page_overrides"
      SET "title" = COALESCE(
        NULLIF(btrim("title"), ''),
        NULLIF(btrim("socialTitle"), '')
      )
    `);

    await manager.query(`
      UPDATE "seo_page_overrides"
      SET "description" = COALESCE(
        NULLIF(btrim("description"), ''),
        NULLIF(btrim("socialDescription"), '')
      )
    `);

    await manager.query(`
      UPDATE "assets" asset
      SET "descriptionDe" = source."description"
      FROM (
        SELECT DISTINCT ON (post."coverAssetId")
          post."coverAssetId" AS "assetUuid",
          translation."coverAltText" AS "description"
        FROM "blog_posts" post
        INNER JOIN "blog_post_translations" translation
          ON translation."postUuid" = post."uuid"
        WHERE post."coverAssetId" IS NOT NULL
          AND translation."locale" = 'de'
          AND NULLIF(btrim(translation."coverAltText"), '') IS NOT NULL
        ORDER BY post."coverAssetId", post."updatedAt" DESC
      ) source
      WHERE asset."uuid" = source."assetUuid"
        AND NULLIF(btrim(asset."descriptionDe"), '') IS NULL
    `);

    await manager.query(`
      UPDATE "assets" asset
      SET "descriptionEn" = source."description"
      FROM (
        SELECT DISTINCT ON (post."coverAssetId")
          post."coverAssetId" AS "assetUuid",
          translation."coverAltText" AS "description"
        FROM "blog_posts" post
        INNER JOIN "blog_post_translations" translation
          ON translation."postUuid" = post."uuid"
        WHERE post."coverAssetId" IS NOT NULL
          AND translation."locale" = 'en'
          AND NULLIF(btrim(translation."coverAltText"), '') IS NOT NULL
        ORDER BY post."coverAssetId", post."updatedAt" DESC
      ) source
      WHERE asset."uuid" = source."assetUuid"
        AND NULLIF(btrim(asset."descriptionEn"), '') IS NULL
    `);

    await manager.query(`
      UPDATE "assets" asset
      SET "descriptionDe" = source."description"
      FROM (
        SELECT
          "socialImageAssetId" AS "assetUuid",
          MIN(NULLIF(btrim("socialImageAlt"), '')) AS "description"
        FROM "seo_page_overrides"
        WHERE "locale" = 'de'
          AND "socialImageAssetId" IS NOT NULL
        GROUP BY "socialImageAssetId"
      ) source
      WHERE asset."uuid" = source."assetUuid"
        AND source."description" IS NOT NULL
        AND NULLIF(btrim(asset."descriptionDe"), '') IS NULL
    `);

    await manager.query(`
      UPDATE "assets" asset
      SET "descriptionEn" = source."description"
      FROM (
        SELECT
          "socialImageAssetId" AS "assetUuid",
          MIN(NULLIF(btrim("socialImageAlt"), '')) AS "description"
        FROM "seo_page_overrides"
        WHERE "locale" = 'en'
          AND "socialImageAssetId" IS NOT NULL
        GROUP BY "socialImageAssetId"
      ) source
      WHERE asset."uuid" = source."assetUuid"
        AND source."description" IS NOT NULL
        AND NULLIF(btrim(asset."descriptionEn"), '') IS NULL
    `);
  },
};
