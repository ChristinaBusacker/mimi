import type {
  EntityManager,
} from 'typeorm';

export const communityDiscordRoleOwnershipMigration = {
  name:
    '20260927-community-discord-role-ownership',
  run: async (
    manager: EntityManager,
  ): Promise<void> => {
    await manager.query(`
      ALTER TABLE "community_discord_roles"
      ADD COLUMN IF NOT EXISTS
        "provisionedByCommunity" boolean
        NOT NULL DEFAULT false
    `);
  },
};
