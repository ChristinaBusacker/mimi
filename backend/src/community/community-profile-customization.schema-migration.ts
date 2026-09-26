import type {
  EntityManager,
} from 'typeorm';

export const communityProfileCustomizationMigration = {
  name:
    '20260926-community-profile-customization',
  run: async (
    manager: EntityManager,
  ): Promise<void> => {
    await manager.query(`
      ALTER TABLE "community_profiles"
      ADD COLUMN IF NOT EXISTS
        "selectedProfileColorAchievementUuid" uuid
    `);

    await manager.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname =
            'FK_community_profiles_selected_profile_color_achievement'
        ) THEN
          ALTER TABLE "community_profiles"
          ADD CONSTRAINT
            "FK_community_profiles_selected_profile_color_achievement"
          FOREIGN KEY (
            "selectedProfileColorAchievementUuid"
          )
          REFERENCES "community_achievements"("uuid")
          ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    await manager.query(`
      CREATE TABLE IF NOT EXISTS
        "community_profile_pinned_achievements" (
          "userUuid" uuid NOT NULL,
          "achievementUuid" uuid NOT NULL,
          "position" smallint NOT NULL,
          CONSTRAINT
            "PK_community_profile_pinned_achievements"
            PRIMARY KEY (
              "userUuid",
              "achievementUuid"
            )
        )
    `);

    await manager.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
        "UQ_community_profile_pinned_achievements_position"
      ON "community_profile_pinned_achievements" (
        "userUuid",
        "position"
      )
    `);

    await manager.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname =
            'FK_community_profile_pinned_achievements_user'
        ) THEN
          ALTER TABLE
            "community_profile_pinned_achievements"
          ADD CONSTRAINT
            "FK_community_profile_pinned_achievements_user"
          FOREIGN KEY ("userUuid")
          REFERENCES "users"("uuid")
          ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname =
            'FK_community_profile_pinned_achievements_achievement'
        ) THEN
          ALTER TABLE
            "community_profile_pinned_achievements"
          ADD CONSTRAINT
            "FK_community_profile_pinned_achievements_achievement"
          FOREIGN KEY ("achievementUuid")
          REFERENCES "community_achievements"("uuid")
          ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname =
            'CHK_community_profile_pinned_achievements_position'
        ) THEN
          ALTER TABLE
            "community_profile_pinned_achievements"
          ADD CONSTRAINT
            "CHK_community_profile_pinned_achievements_position"
          CHECK (
            "position" >= 0 AND
            "position" < 3
          );
        END IF;
      END
      $$;
    `);
  },
};
