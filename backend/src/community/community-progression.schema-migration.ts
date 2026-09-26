import type {
  EntityManager,
} from 'typeorm';

export const communityProgressionMigration = {
  name:
    '20260926-community-progression',
  run: async (
    manager: EntityManager,
  ): Promise<void> => {
    await manager.query(`
      CREATE TABLE IF NOT EXISTS "community_levels" (
        "level" integer NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "requiredXp" integer NOT NULL,
        "nameDe" varchar(160) NOT NULL,
        "nameEn" varchar(160),
        "displayColor" varchar(7),
        "discordRoleId" varchar(32),
        "badgeAssetId" uuid,
        "updatedByUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_levels"
          PRIMARY KEY ("level"),
        CONSTRAINT "UQ_community_levels_required_xp"
          UNIQUE ("requiredXp"),
        CONSTRAINT "FK_community_levels_badge"
          FOREIGN KEY ("badgeAssetId")
          REFERENCES "assets"("uuid")
          ON DELETE SET NULL,
        CONSTRAINT "FK_community_levels_updated_by"
          FOREIGN KEY ("updatedByUserId")
          REFERENCES "users"("uuid")
          ON DELETE SET NULL,
        CONSTRAINT "CHK_community_levels_level"
          CHECK ("level" > 0),
        CONSTRAINT "CHK_community_levels_required_xp"
          CHECK ("requiredXp" >= 0)
      )
    `);

    await manager.query(`
      CREATE TABLE IF NOT EXISTS "community_titles" (
        "uuid" uuid NOT NULL DEFAULT gen_random_uuid(),
        "key" varchar(80) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "nameDe" varchar(160) NOT NULL,
        "nameEn" varchar(160),
        "descriptionDe" text NOT NULL DEFAULT '',
        "descriptionEn" text,
        "updatedByUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_titles"
          PRIMARY KEY ("uuid"),
        CONSTRAINT "UQ_community_titles_key"
          UNIQUE ("key"),
        CONSTRAINT "FK_community_titles_updated_by"
          FOREIGN KEY ("updatedByUserId")
          REFERENCES "users"("uuid")
          ON DELETE SET NULL
      )
    `);

    await manager.query(`
      CREATE TABLE IF NOT EXISTS "community_achievements" (
        "uuid" uuid NOT NULL DEFAULT gen_random_uuid(),
        "key" varchar(80) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "nameDe" varchar(160) NOT NULL,
        "nameEn" varchar(160),
        "descriptionDe" text NOT NULL DEFAULT '',
        "descriptionEn" text,
        "badgeAssetId" uuid,
        "conditionMode" varchar(10) NOT NULL,
        "xpReward" integer NOT NULL DEFAULT 0,
        "unlockedTitleUuid" uuid,
        "discordRoleId" varchar(32),
        "sortOrder" integer NOT NULL DEFAULT 0,
        "updatedByUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_achievements"
          PRIMARY KEY ("uuid"),
        CONSTRAINT "UQ_community_achievements_key"
          UNIQUE ("key"),
        CONSTRAINT "FK_community_achievements_badge"
          FOREIGN KEY ("badgeAssetId")
          REFERENCES "assets"("uuid")
          ON DELETE SET NULL,
        CONSTRAINT "FK_community_achievements_title"
          FOREIGN KEY ("unlockedTitleUuid")
          REFERENCES "community_titles"("uuid")
          ON DELETE SET NULL,
        CONSTRAINT "FK_community_achievements_updated_by"
          FOREIGN KEY ("updatedByUserId")
          REFERENCES "users"("uuid")
          ON DELETE SET NULL,
        CONSTRAINT "CHK_community_achievements_mode"
          CHECK ("conditionMode" IN ('all', 'any')),
        CONSTRAINT "CHK_community_achievements_xp"
          CHECK ("xpReward" >= 0)
      )
    `);

    await manager.query(`
      CREATE TABLE IF NOT EXISTS "community_achievement_conditions" (
        "uuid" uuid NOT NULL DEFAULT gen_random_uuid(),
        "achievementUuid" uuid NOT NULL,
        "metric" varchar(50) NOT NULL,
        "operator" varchar(10) NOT NULL,
        "threshold" integer NOT NULL,
        "eventType" varchar(80),
        "sortOrder" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_community_achievement_conditions"
          PRIMARY KEY ("uuid"),
        CONSTRAINT "FK_community_achievement_conditions_achievement"
          FOREIGN KEY ("achievementUuid")
          REFERENCES "community_achievements"("uuid")
          ON DELETE CASCADE,
        CONSTRAINT "CHK_community_achievement_conditions_metric"
          CHECK (
            "metric" IN (
              'total-xp',
              'event-count',
              'distinct-event-days',
              'discord-membership-current-days',
              'discord-membership-total-days',
              'twitch-subscription-months',
              'twitch-watch-streak'
            )
          ),
        CONSTRAINT "CHK_community_achievement_conditions_operator"
          CHECK ("operator" = 'gte'),
        CONSTRAINT "CHK_community_achievement_conditions_threshold"
          CHECK ("threshold" > 0)
      )
    `);

    await manager.query(`
      CREATE INDEX IF NOT EXISTS "IDX_community_achievement_conditions_achievement"
      ON "community_achievement_conditions" (
        "achievementUuid",
        "sortOrder"
      )
    `);

    await manager.query(`
      CREATE TABLE IF NOT EXISTS "user_achievements" (
        "userUuid" uuid NOT NULL,
        "achievementUuid" uuid NOT NULL,
        "triggerEventUuid" uuid,
        "unlockedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_achievements"
          PRIMARY KEY (
            "userUuid",
            "achievementUuid"
          ),
        CONSTRAINT "FK_user_achievements_user"
          FOREIGN KEY ("userUuid")
          REFERENCES "users"("uuid")
          ON DELETE CASCADE,
        CONSTRAINT "FK_user_achievements_achievement"
          FOREIGN KEY ("achievementUuid")
          REFERENCES "community_achievements"("uuid")
          ON DELETE RESTRICT,
        CONSTRAINT "FK_user_achievements_trigger_event"
          FOREIGN KEY ("triggerEventUuid")
          REFERENCES "community_events"("uuid")
          ON DELETE SET NULL
      )
    `);

    await manager.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_achievements_achievement"
      ON "user_achievements" ("achievementUuid")
    `);

    await manager.query(`
      CREATE TABLE IF NOT EXISTS "user_titles" (
        "userUuid" uuid NOT NULL,
        "titleUuid" uuid NOT NULL,
        "sourceAchievementUuid" uuid,
        "unlockedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_titles"
          PRIMARY KEY (
            "userUuid",
            "titleUuid"
          ),
        CONSTRAINT "FK_user_titles_user"
          FOREIGN KEY ("userUuid")
          REFERENCES "users"("uuid")
          ON DELETE CASCADE,
        CONSTRAINT "FK_user_titles_title"
          FOREIGN KEY ("titleUuid")
          REFERENCES "community_titles"("uuid")
          ON DELETE RESTRICT,
        CONSTRAINT "FK_user_titles_source_achievement"
          FOREIGN KEY ("sourceAchievementUuid")
          REFERENCES "community_achievements"("uuid")
          ON DELETE SET NULL
      )
    `);

    await manager.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_titles_title"
      ON "user_titles" ("titleUuid")
    `);

    await manager.query(`
      ALTER TABLE "community_profiles"
      ADD COLUMN IF NOT EXISTS "selectedTitleUuid" uuid
    `);

    await manager.query(`
      ALTER TABLE "community_profiles"
      ADD CONSTRAINT "FK_community_profiles_selected_title"
      FOREIGN KEY ("selectedTitleUuid")
      REFERENCES "community_titles"("uuid")
      ON DELETE SET NULL
    `);
  },
};
