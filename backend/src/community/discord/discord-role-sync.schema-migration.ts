import type {
  EntityManager,
} from 'typeorm';

export const discordRoleSyncMigration = {
  name:
    '20260927-community-discord-role-sync',
  run: async (
    manager: EntityManager,
  ): Promise<void> => {
    await manager.query(`
      CREATE TABLE IF NOT EXISTS
        "community_discord_assigned_roles" (
          "userUuid" uuid NOT NULL,
          "roleId" varchar(32) NOT NULL,
          "assignedAt" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT
            "PK_community_discord_assigned_roles"
            PRIMARY KEY (
              "userUuid",
              "roleId"
            ),
          CONSTRAINT
            "FK_community_discord_assigned_roles_user"
            FOREIGN KEY ("userUuid")
            REFERENCES "users"("uuid")
            ON DELETE CASCADE
        )
    `);

    await manager.query(`
      CREATE INDEX IF NOT EXISTS
        "IDX_community_discord_assigned_roles_role"
      ON "community_discord_assigned_roles" (
        "roleId"
      )
    `);
  },
};
