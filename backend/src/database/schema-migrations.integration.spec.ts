import {
  randomUUID,
} from 'node:crypto';
import {
  existsSync,
} from 'node:fs';
import {
  resolve,
} from 'node:path';
import {
  loadEnvFile,
} from 'node:process';

import {
  Client,
} from 'pg';
import {
  DataSource,
} from 'typeorm';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import {
  achievementMetricRequiresEventType,
  getCommunityAchievementMetrics,
} from '../community/community-achievement-metric';
import {
  runSchemaMigrations,
} from './schema-migrations';

const EXPECTED_TABLES = [
  'asset_usages',
  'asset_variants',
  'assets',
  'auth_sessions',
  'blog_author_profiles',
  'blog_categories',
  'blog_category_translations',
  'blog_comments',
  'blog_post_categories',
  'blog_post_translations',
  'blog_posts',
  'cache',
  'community_achievement_conditions',
  'community_achievements',
  'community_discord_assigned_roles',
  'community_discord_roles',
  'community_event_rules',
  'community_events',
  'community_levels',
  'community_profile_pinned_achievements',
  'community_profiles',
  'community_titles',
  'community_twitch_identities',
  'community_twitch_link_states',
  'discord_membership_periods',
  'localizations',
  'mail_deliveries',
  'migrations',
  'music_album_translations',
  'music_albums',
  'music_track_translations',
  'music_tracks',
  'password_reset_tokens',
  'schema_migrations',
  'user_achievements',
  'user_titles',
  'users',
  'xp_transactions',
] as const;

interface DatabaseConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

interface TableRow {
  tableName: string;
}

interface MigrationRow {
  name: string;
}

interface AchievementRow {
  uuid: string;
}

interface MetricRow {
  metric: string;
}

function loadProjectEnvironment(): void {
  const envPath = resolve(
    process.cwd(),
    '.env',
  );

  if (existsSync(envPath)) {
    loadEnvFile(envPath);
  }
}

function requireEnvironment(
  name: string,
): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing ${name}. The migration integration test uses the PostgreSQL connection from the project .env file.`,
    );
  }

  return value;
}

function databaseClientConfig(
  database: string,
): DatabaseConnectionConfig {
  const port = Number(
    process.env.DB_PORT ?? '5432',
  );

  if (!Number.isInteger(port)) {
    throw new Error(
      `Invalid DB_PORT: "${process.env.DB_PORT}".`,
    );
  }

  return {
    host: requireEnvironment('DB_HOST'),
    port,
    user: requireEnvironment('DB_USERNAME'),
    password: requireEnvironment('DB_PASSWORD'),
    database,
  };
}

function quoteIdentifier(
  value: string,
): string {
  return `"${value.replaceAll('"', '""')}"`;
}

describe.sequential(
  'schema migrations',
  () => {
    let adminClient: Client;
    let dataSource: DataSource;
    let testDatabase: string;

    beforeAll(async () => {
      loadProjectEnvironment();

      testDatabase = [
        'mimi_migrations_test',
        randomUUID()
          .replaceAll('-', '')
          .slice(0, 16),
      ].join('_');

      adminClient = new Client(
        databaseClientConfig(
          process.env.DB_TEST_ADMIN_DATABASE ??
            'postgres',
        ),
      );

      await adminClient.connect();
      await adminClient.query(
        `CREATE DATABASE ${quoteIdentifier(testDatabase)}`,
      );

      const config =
        databaseClientConfig(testDatabase);

      dataSource = new DataSource({
        type: 'postgres',
        host: config.host,
        port: config.port,
        username: config.user,
        password: config.password,
        database: testDatabase,
        synchronize: false,
      });

      await dataSource.initialize();
    });

    afterAll(async () => {
      if (dataSource?.isInitialized) {
        await dataSource.destroy();
      }

      if (!adminClient) {
        return;
      }

      if (testDatabase) {
        await adminClient.query(
          `
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE
              datname = $1 AND
              pid <> pg_backend_pid()
          `,
          [testDatabase],
        );

        await adminClient.query(
          `DROP DATABASE IF EXISTS ${quoteIdentifier(testDatabase)}`,
        );
      }

      await adminClient.end();
    });

    it(
      'migrates an empty database to the current schema and remains idempotent',
      async () => {
        await runSchemaMigrations(
          dataSource,
        );

        const tables =
          await dataSource.query(
            `
              SELECT table_name AS "tableName"
              FROM information_schema.tables
              WHERE table_schema = current_schema()
              ORDER BY table_name
            `,
          ) as TableRow[];

        const tableNames = new Set(
          tables.map(
            (row) => row.tableName,
          ),
        );

        for (
          const expectedTable
          of EXPECTED_TABLES
        ) {
          expect(
            tableNames.has(expectedTable),
            `Expected migrated table "${expectedTable}" to exist.`,
          ).toBe(true);
        }

        const beforeSecondRun =
          await dataSource.query(
            `
              SELECT "name"
              FROM "schema_migrations"
              ORDER BY "name"
            `,
          ) as MigrationRow[];

        expect(
          beforeSecondRun.map(
            (row) => row.name,
          ),
        ).toEqual(
          expect.arrayContaining([
            '20260920-schema-baseline',
            '20260927-community-achievement-level-metric',
            '20260927-blog-comment-moderation',
          ]),
        );

        await runSchemaMigrations(
          dataSource,
        );

        const afterSecondRun =
          await dataSource.query(
            `
              SELECT "name"
              FROM "schema_migrations"
              ORDER BY "name"
            `,
          ) as MigrationRow[];

        expect(afterSecondRun)
          .toEqual(beforeSecondRun);
      },
    );

    it(
      'accepts every achievement metric registered by the application',
      async () => {
        const rows =
          await dataSource.query(
            `
              INSERT INTO "community_achievements" (
                "key",
                "nameDe",
                "conditionMode"
              )
              VALUES ($1, $2, $3)
              RETURNING "uuid"
            `,
            [
              `migration-test-${randomUUID()}`,
              'Migration test',
              'all',
            ],
          ) as AchievementRow[];

        const achievement = rows[0];

        if (!achievement) {
          throw new Error(
            'Could not create the migration test achievement.',
          );
        }

        const metrics =
          getCommunityAchievementMetrics();

        for (
          const [sortOrder, metric]
          of metrics.entries()
        ) {
          await dataSource.query(
            `
              INSERT INTO "community_achievement_conditions" (
                "achievementUuid",
                "metric",
                "operator",
                "threshold",
                "eventType",
                "sortOrder"
              )
              VALUES ($1, $2, 'gte', 1, $3, $4)
            `,
            [
              achievement.uuid,
              metric,
              achievementMetricRequiresEventType(
                metric,
              )
                ? 'discord.message.activity'
                : null,
              sortOrder,
            ],
          );
        }

        const stored =
          await dataSource.query(
            `
              SELECT "metric"
              FROM "community_achievement_conditions"
              WHERE "achievementUuid" = $1
              ORDER BY "sortOrder"
            `,
            [achievement.uuid],
          ) as MetricRow[];

        expect(
          stored.map(
            (row) => row.metric,
          ),
        ).toEqual(metrics);
      },
    );
  },
);
