import type {
  EntityManager,
} from 'typeorm';

export const communityEventRewardsMigration = {
  name:
    '20260926-community-event-rewards',
  run: async (
    manager: EntityManager,
  ): Promise<void> => {
    await manager.query(`
      CREATE TABLE IF NOT EXISTS "community_event_rules" (
        "eventType" varchar(80) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT false,
        "xpAmount" integer NOT NULL DEFAULT 0,
        "dailyRewardLimit" integer,
        "contextRewardLimit" integer,
        "cooldownSeconds" integer,
        "minimumContentLength" integer,
        "updatedByUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_event_rules"
          PRIMARY KEY ("eventType"),
        CONSTRAINT "FK_community_event_rules_updated_by"
          FOREIGN KEY ("updatedByUserId")
          REFERENCES "users"("uuid")
          ON DELETE SET NULL,
        CONSTRAINT "CHK_community_event_rules_xp"
          CHECK ("xpAmount" >= 0),
        CONSTRAINT "CHK_community_event_rules_daily_limit"
          CHECK (
            "dailyRewardLimit" IS NULL OR
            "dailyRewardLimit" > 0
          ),
        CONSTRAINT "CHK_community_event_rules_context_limit"
          CHECK (
            "contextRewardLimit" IS NULL OR
            "contextRewardLimit" > 0
          ),
        CONSTRAINT "CHK_community_event_rules_cooldown"
          CHECK (
            "cooldownSeconds" IS NULL OR
            "cooldownSeconds" >= 0
          ),
        CONSTRAINT "CHK_community_event_rules_content_length"
          CHECK (
            "minimumContentLength" IS NULL OR
            "minimumContentLength" >= 0
          )
      )
    `);

    await manager.query(`
      CREATE TABLE IF NOT EXISTS "community_events" (
        "uuid" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userUuid" uuid NOT NULL,
        "type" varchar(80) NOT NULL,
        "source" varchar(20) NOT NULL,
        "sourceEventId" varchar(255),
        "contextId" varchar(255),
        "metadata" jsonb,
        "occurredAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_events"
          PRIMARY KEY ("uuid"),
        CONSTRAINT "FK_community_events_user"
          FOREIGN KEY ("userUuid")
          REFERENCES "users"("uuid")
          ON DELETE CASCADE
      )
    `);

    await manager.query(`
      CREATE INDEX IF NOT EXISTS "IDX_community_events_user_type_occurred"
      ON "community_events" (
        "userUuid",
        "type",
        "occurredAt"
      )
    `);

    await manager.query(`
      CREATE INDEX IF NOT EXISTS "IDX_community_events_type_occurred"
      ON "community_events" (
        "type",
        "occurredAt"
      )
    `);

    await manager.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_community_events_source_event"
      ON "community_events" (
        "source",
        "sourceEventId"
      )
      WHERE "sourceEventId" IS NOT NULL
    `);

    await manager.query(`
      CREATE TABLE IF NOT EXISTS "xp_transactions" (
        "uuid" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userUuid" uuid NOT NULL,
        "eventUuid" uuid NOT NULL,
        "eventType" varchar(80) NOT NULL,
        "amount" integer NOT NULL,
        "rewardDate" date NOT NULL,
        "contextId" varchar(255),
        "occurredAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_xp_transactions"
          PRIMARY KEY ("uuid"),
        CONSTRAINT "UQ_xp_transactions_event"
          UNIQUE ("eventUuid"),
        CONSTRAINT "FK_xp_transactions_user"
          FOREIGN KEY ("userUuid")
          REFERENCES "users"("uuid")
          ON DELETE CASCADE,
        CONSTRAINT "FK_xp_transactions_event"
          FOREIGN KEY ("eventUuid")
          REFERENCES "community_events"("uuid")
          ON DELETE CASCADE,
        CONSTRAINT "CHK_xp_transactions_amount"
          CHECK ("amount" > 0)
      )
    `);

    await manager.query(`
      CREATE INDEX IF NOT EXISTS "IDX_xp_transactions_user_type_day"
      ON "xp_transactions" (
        "userUuid",
        "eventType",
        "rewardDate"
      )
    `);

    await manager.query(`
      CREATE INDEX IF NOT EXISTS "IDX_xp_transactions_user_type_context"
      ON "xp_transactions" (
        "userUuid",
        "eventType",
        "contextId"
      )
    `);

    await manager.query(`
      CREATE INDEX IF NOT EXISTS "IDX_xp_transactions_user_type_occurred"
      ON "xp_transactions" (
        "userUuid",
        "eventType",
        "occurredAt"
      )
    `);
  },
};
