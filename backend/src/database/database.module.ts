import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from 'pg';

async function ensureDatabaseExists(
  configService: ConfigService,
): Promise<void> {
  const database = configService.getOrThrow<string>('DB_DATABASE');

  const createIfMissing =
    configService.get<string>('DB_CREATE_IF_MISSING') === 'true';

  if (!createIfMissing) {
    return;
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(database)) {
    throw new Error(`Invalid database name: "${database}"`);
  }

  const client = new Client({
    host: configService.getOrThrow<string>('DB_HOST'),
    port: Number(configService.getOrThrow<string>('DB_PORT')),
    user: configService.getOrThrow<string>('DB_USERNAME'),
    password: configService.getOrThrow<string>('DB_PASSWORD'),

    database: 'postgres',
  });

  await client.connect();

  try {
    const result = await client.query(
      `
        SELECT 1
        FROM pg_database
        WHERE datname = $1
      `,
      [database],
    );

    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE "${database}"`);

      console.log(`Database "${database}" created successfully.`);
    }
  } finally {
    await client.end();
  }
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],

      useFactory: async (configService: ConfigService) => {
        await ensureDatabaseExists(configService);

        return {
          type: 'postgres' as const,
          host: configService.getOrThrow<string>('DB_HOST'),
          port: Number(configService.getOrThrow<string>('DB_PORT')),
          username: configService.getOrThrow<string>('DB_USERNAME'),
          password: configService.getOrThrow<string>('DB_PASSWORD'),
          database: configService.getOrThrow<string>('DB_DATABASE'),
          autoLoadEntities: true,
          synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
        };
      },
    }),
  ],
})
export class DatabaseModule {}
