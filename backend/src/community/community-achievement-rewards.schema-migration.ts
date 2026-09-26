import type { EntityManager } from 'typeorm';

export const communityAchievementRewardsMigration = {
  name:
    '20260926-community-achievement-rewards',
  run: async (
    manager: EntityManager,
  ): Promise<void> => {
    await manager.query(`
      ALTER TABLE "community_achievements"
      ADD COLUMN IF NOT EXISTS "unlockedProfileColor" varchar(7)
    `);
  },
};
