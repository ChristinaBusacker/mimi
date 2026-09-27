import type {
  EntityManager,
} from 'typeorm';

export const communityAchievementLevelMetricMigration = {
  name:
    '20260927-community-achievement-level-metric',
  run: async (
    manager: EntityManager,
  ): Promise<void> => {
    await manager.query(`
      ALTER TABLE
        "community_achievement_conditions"
      DROP CONSTRAINT IF EXISTS
        "CHK_community_achievement_conditions_metric"
    `);

    await manager.query(`
      ALTER TABLE
        "community_achievement_conditions"
      ADD CONSTRAINT
        "CHK_community_achievement_conditions_metric"
      CHECK (
        "metric" IN (
          'total-xp',
          'level-reached',
          'event-count',
          'distinct-event-days',
          'discord-membership-current-days',
          'discord-membership-total-days',
          'twitch-subscription-months',
          'twitch-watch-streak'
        )
      )
    `);
  },
};
