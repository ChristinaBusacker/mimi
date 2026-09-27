import type {
  EntityManager,
} from 'typeorm';

export const pushSubscriptionsMigration = {
  name:
    '20260928-push-subscriptions',
  run: async (
    manager: EntityManager,
  ): Promise<void> => {
    await manager.query(`
      CREATE TABLE IF NOT EXISTS
        "push_subscriptions" (
          "uuid" uuid NOT NULL
            DEFAULT gen_random_uuid(),
          "userUuid" uuid NOT NULL,
          "endpoint" varchar(2048) NOT NULL,
          "p256dh" varchar(512) NOT NULL,
          "auth" varchar(255) NOT NULL,
          "expiresAt" timestamptz,
          "createdAt" timestamptz NOT NULL
            DEFAULT now(),
          "updatedAt" timestamptz NOT NULL
            DEFAULT now(),
          CONSTRAINT
            "PK_push_subscriptions"
            PRIMARY KEY ("uuid"),
          CONSTRAINT
            "FK_push_subscriptions_user"
            FOREIGN KEY ("userUuid")
            REFERENCES "users"("uuid")
            ON DELETE CASCADE
        )
    `);

    await manager.query(`
      CREATE INDEX IF NOT EXISTS
        "IDX_push_subscriptions_user"
      ON "push_subscriptions" (
        "userUuid"
      )
    `);

    await manager.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
        "UQ_push_subscriptions_endpoint"
      ON "push_subscriptions" (
        "endpoint"
      )
    `);
  },
};
