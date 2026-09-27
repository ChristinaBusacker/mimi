import type {
  EntityManager,
} from 'typeorm';

export const communityDiscordRoleModelMigration = {
  name:
    '20260927-community-discord-role-model',
  run: async (
    manager: EntityManager,
  ): Promise<void> => {
    await manager.query(`
      CREATE TABLE IF NOT EXISTS
        "community_discord_roles" (
          "uuid" uuid NOT NULL DEFAULT gen_random_uuid(),
          "key" varchar(120) NOT NULL,
          "kind" varchar(20) NOT NULL,
          "name" varchar(100) NOT NULL,
          "color" varchar(7),
          "enabled" boolean NOT NULL DEFAULT true,
          "discordRoleId" varchar(32),
          "achievementUuid" uuid,
          "minimumLevel" integer,
          "maximumLevel" integer,
          "sortOrder" integer NOT NULL DEFAULT 0,
          "updatedByUserId" uuid,
          "createdAt" timestamptz NOT NULL DEFAULT now(),
          "updatedAt" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT
            "PK_community_discord_roles"
            PRIMARY KEY ("uuid"),
          CONSTRAINT
            "UQ_community_discord_roles_key"
            UNIQUE ("key"),
          CONSTRAINT
            "FK_community_discord_roles_achievement"
            FOREIGN KEY ("achievementUuid")
            REFERENCES "community_achievements"("uuid")
            ON DELETE RESTRICT,
          CONSTRAINT
            "CHK_community_discord_roles_color"
            CHECK (
              "color" IS NULL OR
              "color" ~ '^#[0-9A-Fa-f]{6}$'
            ),
          CONSTRAINT
            "CHK_community_discord_roles_shape"
            CHECK (
              (
                "kind" = 'level-range' AND
                "achievementUuid" IS NULL AND
                "minimumLevel" IS NOT NULL AND
                "minimumLevel" >= 1 AND
                (
                  "maximumLevel" IS NULL OR
                  "maximumLevel" >= "minimumLevel"
                )
              ) OR
              (
                "kind" = 'showcase' AND
                "achievementUuid" IS NOT NULL AND
                "minimumLevel" IS NULL AND
                "maximumLevel" IS NULL
              ) OR
              (
                "kind" = 'special' AND
                "achievementUuid" IS NULL AND
                "minimumLevel" IS NULL AND
                "maximumLevel" IS NULL
              )
            )
        )
    `);

    await manager.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname =
            'FK_community_discord_roles_achievement'
        ) THEN
          ALTER TABLE "community_discord_roles"
          ADD CONSTRAINT
            "FK_community_discord_roles_achievement"
            FOREIGN KEY ("achievementUuid")
            REFERENCES "community_achievements"("uuid")
            ON DELETE RESTRICT;
        END IF;
      END
      $$
    `);

    await manager.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname =
            'CHK_community_discord_roles_color'
        ) THEN
          ALTER TABLE "community_discord_roles"
          ADD CONSTRAINT
            "CHK_community_discord_roles_color"
            CHECK (
              "color" IS NULL OR
              "color" ~ '^#[0-9A-Fa-f]{6}$'
            );
        END IF;
      END
      $$
    `);

    await manager.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname =
            'CHK_community_discord_roles_shape'
        ) THEN
          ALTER TABLE "community_discord_roles"
          ADD CONSTRAINT
            "CHK_community_discord_roles_shape"
            CHECK (
              (
                "kind" = 'level-range' AND
                "achievementUuid" IS NULL AND
                "minimumLevel" IS NOT NULL AND
                "minimumLevel" >= 1 AND
                (
                  "maximumLevel" IS NULL OR
                  "maximumLevel" >= "minimumLevel"
                )
              ) OR
              (
                "kind" = 'showcase' AND
                "achievementUuid" IS NOT NULL AND
                "minimumLevel" IS NULL AND
                "maximumLevel" IS NULL
              ) OR
              (
                "kind" = 'special' AND
                "achievementUuid" IS NULL AND
                "minimumLevel" IS NULL AND
                "maximumLevel" IS NULL
              )
            );
        END IF;
      END
      $$
    `);

    await manager.query(`
      CREATE INDEX IF NOT EXISTS
        "IDX_community_discord_roles_kind"
      ON "community_discord_roles" (
        "kind",
        "sortOrder"
      )
    `);

    await manager.query(`
      CREATE INDEX IF NOT EXISTS
        "IDX_community_discord_roles_achievement"
      ON "community_discord_roles" (
        "achievementUuid"
      )
      WHERE "achievementUuid" IS NOT NULL
    `);

    await manager.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
        "UQ_community_discord_roles_discord_role"
      ON "community_discord_roles" (
        "discordRoleId"
      )
      WHERE "discordRoleId" IS NOT NULL
    `);

    await manager.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
        "UQ_community_discord_roles_showcase_achievement"
      ON "community_discord_roles" (
        "achievementUuid"
      )
      WHERE
        "kind" = 'showcase' AND
        "achievementUuid" IS NOT NULL
    `);

    await manager.query(`
      INSERT INTO "community_discord_roles" (
        "key",
        "kind",
        "name",
        "enabled",
        "discordRoleId",
        "achievementUuid",
        "sortOrder",
        "updatedByUserId",
        "createdAt",
        "updatedAt"
      )
      SELECT DISTINCT ON (
        achievement."discordRoleId"
      )
        'achievement.' || achievement."key",
        'showcase',
        left(achievement."nameDe", 100),
        achievement."enabled",
        achievement."discordRoleId",
        achievement."uuid",
        achievement."sortOrder",
        achievement."updatedByUserId",
        achievement."createdAt",
        achievement."updatedAt"
      FROM "community_achievements" achievement
      WHERE
        achievement."discordRoleId" IS NOT NULL
      ORDER BY
        achievement."discordRoleId",
        achievement."sortOrder",
        achievement."key"
      ON CONFLICT DO NOTHING
    `);

    await manager.query(`
      ALTER TABLE "community_profiles"
      ADD COLUMN IF NOT EXISTS
        "selectedDiscordShowcaseRoleUuid" uuid
    `);

    await manager.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname =
            'FK_community_profiles_discord_showcase_role'
        ) THEN
          ALTER TABLE "community_profiles"
          ADD CONSTRAINT
            "FK_community_profiles_discord_showcase_role"
            FOREIGN KEY (
              "selectedDiscordShowcaseRoleUuid"
            )
            REFERENCES "community_discord_roles"("uuid")
            ON DELETE SET NULL;
        END IF;
      END
      $$
    `);
  },
};
