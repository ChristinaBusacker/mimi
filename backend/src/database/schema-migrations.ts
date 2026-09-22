import { Logger } from '@nestjs/common';
import type {
  DataSource,
  EntityManager,
} from 'typeorm';

interface SchemaMigration {
  name: string;
  run: (manager: EntityManager) => Promise<void>;
}

const logger = new Logger('SchemaMigrations');

const migrations: readonly SchemaMigration[] = [
  {
    name: '20260921-asset-image-pipeline',
    run: async (manager) => {
      await manager.query(`
        ALTER TABLE "assets"
        ADD COLUMN IF NOT EXISTS "contentHash" varchar(64)
      `);

      await manager.query(`
        ALTER TABLE "assets"
        ADD COLUMN IF NOT EXISTS "width" integer
      `);

      await manager.query(`
        ALTER TABLE "assets"
        ADD COLUMN IF NOT EXISTS "height" integer
      `);

      await manager.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "IDX_assets_contentHash_unique"
        ON "assets" ("contentHash")
        WHERE "contentHash" IS NOT NULL
      `);

      await manager.query(`
        CREATE TABLE IF NOT EXISTS "asset_variants" (
          "assetUuid" uuid NOT NULL,
          "name" varchar(20) NOT NULL,
          "format" varchar(20) NOT NULL,
          "mimeType" varchar(100) NOT NULL,
          "width" integer NOT NULL,
          "height" integer NOT NULL,
          "sizeBytes" integer NOT NULL,
          "storageKey" varchar(100) NOT NULL,
          CONSTRAINT "PK_asset_variants" PRIMARY KEY ("assetUuid", "name", "format"),
          CONSTRAINT "UQ_asset_variants_storageKey" UNIQUE ("storageKey"),
          CONSTRAINT "FK_asset_variants_asset"
            FOREIGN KEY ("assetUuid")
            REFERENCES "assets"("uuid")
            ON DELETE CASCADE
        )
      `);
    },
  },
  {
    name: '20260922-asset-usage-tracking',
    run: async (manager) => {
      await manager.query(`
        CREATE TABLE IF NOT EXISTS "asset_usages" (
          "assetUuid" uuid NOT NULL,
          "ownerType" varchar(50) NOT NULL,
          "ownerUuid" uuid NOT NULL,
          "scope" varchar(50) NOT NULL,
          CONSTRAINT "PK_asset_usages"
            PRIMARY KEY (
              "assetUuid",
              "ownerType",
              "ownerUuid",
              "scope"
            ),
          CONSTRAINT "FK_asset_usages_asset"
            FOREIGN KEY ("assetUuid")
            REFERENCES "assets"("uuid")
            ON DELETE RESTRICT
        )
      `);

      await manager.query(`
        CREATE INDEX IF NOT EXISTS "IDX_asset_usages_owner"
        ON "asset_usages" (
          "ownerType",
          "ownerUuid"
        )
      `);

      await manager.query(`
        INSERT INTO "asset_usages" (
          "assetUuid",
          "ownerType",
          "ownerUuid",
          "scope"
        )
        SELECT
          "coverAssetId",
          'musicAlbum',
          "uuid",
          'cover'
        FROM "music_albums"
        WHERE "coverAssetId" IS NOT NULL
        ON CONFLICT DO NOTHING
      `);

      await manager.query(`
        INSERT INTO "asset_usages" (
          "assetUuid",
          "ownerType",
          "ownerUuid",
          "scope"
        )
        SELECT
          "coverAssetId",
          'musicTrack',
          "uuid",
          'cover'
        FROM "music_tracks"
        WHERE "coverAssetId" IS NOT NULL
        ON CONFLICT DO NOTHING
      `);

      await manager.query(`
        INSERT INTO "asset_usages" (
          "assetUuid",
          "ownerType",
          "ownerUuid",
          "scope"
        )
        SELECT
          "previewAssetId",
          'musicTrack',
          "uuid",
          'preview'
        FROM "music_tracks"
        WHERE "previewAssetId" IS NOT NULL
        ON CONFLICT DO NOTHING
      `);

      await manager.query(`
        INSERT INTO "asset_usages" (
          "assetUuid",
          "ownerType",
          "ownerUuid",
          "scope"
        )
        SELECT DISTINCT
          asset."uuid",
          'musicAlbum',
          translation."albumUuid",
          'content:' || translation."locale"
        FROM "music_album_translations" translation
        CROSS JOIN LATERAL regexp_matches(
          translation."contentMarkdown",
          'asset:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})',
          'g'
        ) AS reference(match)
        INNER JOIN "assets" asset
          ON asset."uuid"::text =
            lower(reference.match[1])
        ON CONFLICT DO NOTHING
      `);

      await manager.query(`
        INSERT INTO "asset_usages" (
          "assetUuid",
          "ownerType",
          "ownerUuid",
          "scope"
        )
        SELECT DISTINCT
          asset."uuid",
          'musicTrack',
          translation."trackUuid",
          'content:' || translation."locale"
        FROM "music_track_translations" translation
        CROSS JOIN LATERAL regexp_matches(
          translation."contentMarkdown",
          'asset:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})',
          'g'
        ) AS reference(match)
        INNER JOIN "assets" asset
          ON asset."uuid"::text =
            lower(reference.match[1])
        ON CONFLICT DO NOTHING
      `);
    },
  },
  {
    name: '20260922-blog-foundation',
    run: async (manager) => {
      await manager.query(`
        CREATE TABLE IF NOT EXISTS "blog_author_profiles" (
          "userUuid" uuid NOT NULL,
          "slug" varchar(160) NOT NULL,
          "displayName" varchar(255) NOT NULL,
          "bio" text NOT NULL DEFAULT '',
          "avatarAssetId" uuid,
          "createdAt" timestamptz NOT NULL DEFAULT now(),
          "updatedAt" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_blog_author_profiles"
            PRIMARY KEY ("userUuid"),
          CONSTRAINT "UQ_blog_author_profiles_slug"
            UNIQUE ("slug"),
          CONSTRAINT "FK_blog_author_profiles_user"
            FOREIGN KEY ("userUuid")
            REFERENCES "users"("uuid")
            ON DELETE CASCADE,
          CONSTRAINT "FK_blog_author_profiles_avatar"
            FOREIGN KEY ("avatarAssetId")
            REFERENCES "assets"("uuid")
            ON DELETE SET NULL
        )
      `);

      await manager.query(`
        CREATE TABLE IF NOT EXISTS "blog_posts" (
          "uuid" uuid NOT NULL DEFAULT gen_random_uuid(),
          "slug" varchar(160) NOT NULL,
          "authorUuid" uuid NOT NULL,
          "coverAssetId" uuid,
          "status" varchar(20) NOT NULL DEFAULT 'draft',
          "publishedAt" timestamptz,
          "createdAt" timestamptz NOT NULL DEFAULT now(),
          "updatedAt" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_blog_posts"
            PRIMARY KEY ("uuid"),
          CONSTRAINT "UQ_blog_posts_slug"
            UNIQUE ("slug"),
          CONSTRAINT "FK_blog_posts_author"
            FOREIGN KEY ("authorUuid")
            REFERENCES "users"("uuid")
            ON DELETE RESTRICT,
          CONSTRAINT "FK_blog_posts_cover"
            FOREIGN KEY ("coverAssetId")
            REFERENCES "assets"("uuid")
            ON DELETE SET NULL
        )
      `);

      await manager.query(`
        CREATE INDEX IF NOT EXISTS "IDX_blog_posts_publication"
        ON "blog_posts" (
          "status",
          "publishedAt"
        )
      `);

      await manager.query(`
        CREATE INDEX IF NOT EXISTS "IDX_blog_posts_author"
        ON "blog_posts" ("authorUuid")
      `);

      await manager.query(`
        CREATE TABLE IF NOT EXISTS "blog_post_translations" (
          "uuid" uuid NOT NULL DEFAULT gen_random_uuid(),
          "postUuid" uuid NOT NULL,
          "locale" varchar(5) NOT NULL,
          "title" varchar(255) NOT NULL,
          "excerpt" text NOT NULL DEFAULT '',
          "contentMarkdown" text NOT NULL DEFAULT '',
          CONSTRAINT "PK_blog_post_translations"
            PRIMARY KEY ("uuid"),
          CONSTRAINT "UQ_blog_post_translations_locale"
            UNIQUE ("postUuid", "locale"),
          CONSTRAINT "FK_blog_post_translations_post"
            FOREIGN KEY ("postUuid")
            REFERENCES "blog_posts"("uuid")
            ON DELETE CASCADE
        )
      `);
    },
  },
];

export async function runSchemaMigrations(
  dataSource: DataSource,
): Promise<void> {
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "schema_migrations" (
      "name" varchar(255) PRIMARY KEY,
      "appliedAt" timestamptz NOT NULL DEFAULT now()
    )
  `);

  for (const migration of migrations) {
    const rows = (await dataSource.query(
      `SELECT "name" FROM "schema_migrations" WHERE "name" = $1`,
      [migration.name],
    )) as Array<{ name: string }>;

    if (rows.length > 0) {
      continue;
    }

    logger.log(`Applying schema migration "${migration.name}"...`);

    await dataSource.transaction(async (manager) => {
      await migration.run(manager);
      await manager.query(
        `INSERT INTO "schema_migrations" ("name") VALUES ($1)`,
        [migration.name],
      );
    });

    logger.log(`Schema migration "${migration.name}" applied.`);
  }
}
