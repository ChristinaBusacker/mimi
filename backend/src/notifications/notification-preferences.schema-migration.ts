import type {
  EntityManager,
} from 'typeorm';

export const notificationPreferencesMigration = {
  name:
    '20260928-notification-preferences',
  run: async (
    manager: EntityManager,
  ): Promise<void> => {
    await manager.query(`
      CREATE TABLE IF NOT EXISTS
        "notification_preferences" (
          "userUuid" uuid NOT NULL,
          "streams" boolean NOT NULL DEFAULT false,
          "music" boolean NOT NULL DEFAULT false,
          "blog" boolean NOT NULL DEFAULT false,
          "personal" boolean NOT NULL DEFAULT false,
          "locale" varchar(5) NOT NULL DEFAULT 'de',
          "createdAt" timestamptz NOT NULL DEFAULT now(),
          "updatedAt" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT
            "PK_notification_preferences"
            PRIMARY KEY ("userUuid"),
          CONSTRAINT
            "FK_notification_preferences_user"
            FOREIGN KEY ("userUuid")
            REFERENCES "users"("uuid")
            ON DELETE CASCADE,
          CONSTRAINT
            "CHK_notification_preferences_locale"
            CHECK ("locale" IN ('de', 'en'))
        )
    `);
  },
};
