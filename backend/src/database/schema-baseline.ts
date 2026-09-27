import type {
  EntityManager,
} from 'typeorm';

const BASELINE_TABLES = [
  'users',
  'auth_sessions',
  'assets',
  'localizations',
  'migrations',
  'cache',
  'music_albums',
  'music_album_translations',
  'music_tracks',
  'music_track_translations',
] as const;

const BASELINE_STATEMENTS = [
  `
    CREATE TABLE "users" (
      "uuid" uuid NOT NULL DEFAULT gen_random_uuid(),
      "name" varchar NOT NULL,
      "email" varchar NOT NULL,
      "password" varchar,
      "discordId" varchar,
      "role" varchar(20) NOT NULL DEFAULT 'user',
      CONSTRAINT "PK_users"
        PRIMARY KEY ("uuid"),
      CONSTRAINT "UQ_users_email"
        UNIQUE ("email"),
      CONSTRAINT "UQ_users_discord_id"
        UNIQUE ("discordId")
    )
  `,
  `
    CREATE TABLE "auth_sessions" (
      "tokenHash" varchar(64) NOT NULL,
      "userUuid" uuid NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "expiresAt" timestamptz NOT NULL,
      CONSTRAINT "PK_auth_sessions"
        PRIMARY KEY ("tokenHash")
    )
  `,
  `
    CREATE INDEX "IDX_auth_sessions_expires"
    ON "auth_sessions" ("expiresAt")
  `,
  `
    CREATE TABLE "assets" (
      "uuid" uuid NOT NULL DEFAULT gen_random_uuid(),
      "type" varchar(20) NOT NULL,
      "originalFilename" varchar(255) NOT NULL,
      "mimeType" varchar(100) NOT NULL,
      "sizeBytes" integer NOT NULL,
      "storageKey" varchar(100) NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_assets"
        PRIMARY KEY ("uuid"),
      CONSTRAINT "UQ_assets_storage_key"
        UNIQUE ("storageKey")
    )
  `,
  `
    CREATE TABLE "localizations" (
      "uuid" uuid NOT NULL DEFAULT gen_random_uuid(),
      "key" varchar(255) NOT NULL,
      "de" text NOT NULL,
      "en" text NOT NULL,
      CONSTRAINT "PK_localizations"
        PRIMARY KEY ("uuid"),
      CONSTRAINT "UQ_localizations_key"
        UNIQUE ("key")
    )
  `,
  `
    CREATE TABLE "migrations" (
      "uuid" uuid NOT NULL DEFAULT gen_random_uuid(),
      "name" varchar NOT NULL,
      "appliedAt" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "PK_migrations"
        PRIMARY KEY ("uuid"),
      CONSTRAINT "UQ_migrations_name"
        UNIQUE ("name")
    )
  `,
  `
    CREATE TABLE "cache" (
      "key" varchar(100) NOT NULL,
      "value" jsonb,
      "refreshedAt" timestamptz NOT NULL,
      CONSTRAINT "PK_cache"
        PRIMARY KEY ("key")
    )
  `,
  `
    CREATE TABLE "music_albums" (
      "uuid" uuid NOT NULL DEFAULT gen_random_uuid(),
      "slug" varchar(160) NOT NULL,
      "coverAssetId" uuid,
      "releasedAt" date,
      "status" varchar(20) NOT NULL DEFAULT 'draft',
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_music_albums"
        PRIMARY KEY ("uuid"),
      CONSTRAINT "UQ_music_albums_slug"
        UNIQUE ("slug"),
      CONSTRAINT "FK_music_albums_cover"
        FOREIGN KEY ("coverAssetId")
        REFERENCES "assets"("uuid")
        ON DELETE SET NULL
    )
  `,
  `
    CREATE TABLE "music_album_translations" (
      "uuid" uuid NOT NULL DEFAULT gen_random_uuid(),
      "albumUuid" uuid NOT NULL,
      "locale" varchar(5) NOT NULL,
      "title" varchar(255) NOT NULL,
      "contentMarkdown" text NOT NULL DEFAULT '',
      CONSTRAINT "PK_music_album_translations"
        PRIMARY KEY ("uuid"),
      CONSTRAINT "UQ_music_album_translations_locale"
        UNIQUE ("albumUuid", "locale"),
      CONSTRAINT "FK_music_album_translations_album"
        FOREIGN KEY ("albumUuid")
        REFERENCES "music_albums"("uuid")
        ON DELETE CASCADE
    )
  `,
  `
    CREATE TABLE "music_tracks" (
      "uuid" uuid NOT NULL DEFAULT gen_random_uuid(),
      "slug" varchar(160) NOT NULL,
      "albumUuid" uuid,
      "trackNumber" integer,
      "durationSeconds" integer NOT NULL DEFAULT 0,
      "previewDurationSeconds" integer NOT NULL DEFAULT 0,
      "previewAssetId" uuid,
      "coverAssetId" uuid,
      "spotifyUrl" text,
      "deezerUrl" text,
      "supportUrl" text,
      "status" varchar(20) NOT NULL DEFAULT 'draft',
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_music_tracks"
        PRIMARY KEY ("uuid"),
      CONSTRAINT "UQ_music_tracks_slug"
        UNIQUE ("slug"),
      CONSTRAINT "FK_music_tracks_album"
        FOREIGN KEY ("albumUuid")
        REFERENCES "music_albums"("uuid")
        ON DELETE SET NULL,
      CONSTRAINT "FK_music_tracks_preview"
        FOREIGN KEY ("previewAssetId")
        REFERENCES "assets"("uuid")
        ON DELETE SET NULL,
      CONSTRAINT "FK_music_tracks_cover"
        FOREIGN KEY ("coverAssetId")
        REFERENCES "assets"("uuid")
        ON DELETE SET NULL
    )
  `,
  `
    CREATE TABLE "music_track_translations" (
      "uuid" uuid NOT NULL DEFAULT gen_random_uuid(),
      "trackUuid" uuid NOT NULL,
      "locale" varchar(5) NOT NULL,
      "title" varchar(255) NOT NULL,
      "contentMarkdown" text NOT NULL DEFAULT '',
      CONSTRAINT "PK_music_track_translations"
        PRIMARY KEY ("uuid"),
      CONSTRAINT "UQ_music_track_translations_locale"
        UNIQUE ("trackUuid", "locale"),
      CONSTRAINT "FK_music_track_translations_track"
        FOREIGN KEY ("trackUuid")
        REFERENCES "music_tracks"("uuid")
        ON DELETE CASCADE
    )
  `,
] as const;

interface ExistingBaselineTable {
  name: string;
}

async function findExistingBaselineTables(
  manager: EntityManager,
): Promise<Set<string>> {
  const rows = await manager.query(
    `
      SELECT tablename AS "name"
      FROM pg_tables
      WHERE
        schemaname = current_schema() AND
        tablename = ANY($1::text[])
    `,
    [BASELINE_TABLES],
  ) as ExistingBaselineTable[];

  return new Set(
    rows.map((row) => row.name),
  );
}

export const schemaBaselineMigration = {
  name: '20260920-schema-baseline',
  run: async (
    manager: EntityManager,
  ): Promise<void> => {
    const existing =
      await findExistingBaselineTables(
        manager,
      );

    if (
      existing.size ===
      BASELINE_TABLES.length
    ) {
      return;
    }

    if (existing.size > 0) {
      const missing =
        BASELINE_TABLES.filter(
          (table) =>
            !existing.has(table),
        );

      throw new Error(
        [
          'Cannot apply the schema baseline to a partially initialized database.',
          `Missing baseline tables: ${missing.join(', ')}.`,
          'Use a clean database or restore the missing schema before starting the application.',
        ].join(' '),
      );
    }

    for (
      const statement
      of BASELINE_STATEMENTS
    ) {
      await manager.query(statement);
    }
  },
};
