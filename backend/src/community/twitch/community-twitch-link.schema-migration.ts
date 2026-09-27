import type {
  EntityManager,
} from 'typeorm';

export const communityTwitchLinkMigration = {
  name:
    '20260927-community-twitch-link',
  run: async (
    manager: EntityManager,
  ): Promise<void> => {
    await manager.query(`
      CREATE TABLE IF NOT EXISTS
        "community_twitch_identities" (
          "userUuid" uuid NOT NULL,
          "twitchUserId" varchar(64) NOT NULL,
          "login" varchar(255) NOT NULL,
          "displayName" varchar(255) NOT NULL,
          "profileImageUrl" text,
          "linkedAt" timestamptz NOT NULL DEFAULT now(),
          "updatedAt" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT
            "PK_community_twitch_identities"
            PRIMARY KEY ("userUuid"),
          CONSTRAINT
            "UQ_community_twitch_identities_twitch_user"
            UNIQUE ("twitchUserId"),
          CONSTRAINT
            "FK_community_twitch_identities_user"
            FOREIGN KEY ("userUuid")
            REFERENCES "users"("uuid")
            ON DELETE CASCADE
        )
    `);

    await manager.query(`
      CREATE TABLE IF NOT EXISTS
        "community_twitch_link_states" (
          "stateHash" varchar(64) NOT NULL,
          "userUuid" uuid NOT NULL,
          "expiresAt" timestamptz NOT NULL,
          "createdAt" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT
            "PK_community_twitch_link_states"
            PRIMARY KEY ("stateHash"),
          CONSTRAINT
            "FK_community_twitch_link_states_user"
            FOREIGN KEY ("userUuid")
            REFERENCES "users"("uuid")
            ON DELETE CASCADE
        )
    `);

    await manager.query(`
      CREATE INDEX IF NOT EXISTS
        "IDX_community_twitch_link_states_user"
      ON "community_twitch_link_states" (
        "userUuid"
      )
    `);

    await manager.query(`
      CREATE INDEX IF NOT EXISTS
        "IDX_community_twitch_link_states_expires"
      ON "community_twitch_link_states" (
        "expiresAt"
      )
    `);
  },
};
