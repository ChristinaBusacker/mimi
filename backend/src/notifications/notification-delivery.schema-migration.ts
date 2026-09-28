import type {
  EntityManager,
} from 'typeorm';

export const notificationDeliveryMigration = {
  name:
    '20260928-notification-delivery-ledger',
  run: async (
    manager: EntityManager,
  ): Promise<void> => {
    await manager.query(`
      CREATE TABLE IF NOT EXISTS
        "notification_events" (
          "key" varchar(255) NOT NULL,
          "type" varchar(80) NOT NULL,
          "context" jsonb,
          "createdAt" timestamptz NOT NULL DEFAULT now(),
          "updatedAt" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT
            "PK_notification_events"
            PRIMARY KEY ("key")
        )
    `);

    await manager.query(`
      CREATE TABLE IF NOT EXISTS
        "notification_deliveries" (
          "uuid" uuid NOT NULL DEFAULT gen_random_uuid(),
          "eventKey" varchar(255) NOT NULL,
          "userUuid" uuid NOT NULL,
          "status" varchar(20) NOT NULL DEFAULT 'pending',
          "deliveredAt" timestamptz,
          "createdAt" timestamptz NOT NULL DEFAULT now(),
          "updatedAt" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT
            "PK_notification_deliveries"
            PRIMARY KEY ("uuid"),
          CONSTRAINT
            "UQ_notification_deliveries_event_user"
            UNIQUE ("eventKey", "userUuid"),
          CONSTRAINT
            "CHK_notification_deliveries_status"
            CHECK (
              "status" IN (
                'pending',
                'completed'
              )
            ),
          CONSTRAINT
            "FK_notification_deliveries_event"
            FOREIGN KEY ("eventKey")
            REFERENCES "notification_events"("key")
            ON DELETE CASCADE,
          CONSTRAINT
            "FK_notification_deliveries_user"
            FOREIGN KEY ("userUuid")
            REFERENCES "users"("uuid")
            ON DELETE CASCADE
        )
    `);

    await manager.query(`
      CREATE INDEX IF NOT EXISTS
        "IDX_notification_deliveries_user"
      ON "notification_deliveries" (
        "userUuid"
      )
    `);

    await manager.query(`
      CREATE INDEX IF NOT EXISTS
        "IDX_notification_deliveries_event_status"
      ON "notification_deliveries" (
        "eventKey",
        "status"
      )
    `);
  },
};
