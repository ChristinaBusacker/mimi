import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';

import { AuthSessionEntry } from './entities/auth-session.entry';

const DEFAULT_SESSION_TTL_DAYS = 30;
const MAX_SESSION_TTL_DAYS = 365;

export interface CreatedAuthSession {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class AuthSessionService {
  private readonly sessionTtlMs: number;

  constructor(
    @InjectRepository(AuthSessionEntry)
    private readonly repository: Repository<AuthSessionEntry>,
    configService: ConfigService,
  ) {
    const configuredTtlDays = Number(
      configService.get<string>('AUTH_SESSION_TTL_DAYS') ??
        DEFAULT_SESSION_TTL_DAYS,
    );

    if (
      !Number.isInteger(configuredTtlDays) ||
      configuredTtlDays < 1 ||
      configuredTtlDays > MAX_SESSION_TTL_DAYS
    ) {
      throw new Error(
        `AUTH_SESSION_TTL_DAYS must be an integer between 1 and ${MAX_SESSION_TTL_DAYS}.`,
      );
    }

    this.sessionTtlMs = configuredTtlDays * 24 * 60 * 60 * 1000;
  }

  async create(userUuid: string): Promise<CreatedAuthSession> {
    const now = new Date();

    await this.repository.delete({
      expiresAt: LessThanOrEqual(now),
    });

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now.getTime() + this.sessionTtlMs);

    await this.repository.save(
      this.repository.create({
        tokenHash: this.hashToken(token),
        userUuid,
        expiresAt,
      }),
    );

    return {
      token,
      expiresAt,
    };
  }

  async resolveUserUuid(token: string): Promise<string | null> {
    const session = await this.repository.findOneBy({
      tokenHash: this.hashToken(token),
    });

    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.repository.delete({
        tokenHash: session.tokenHash,
      });

      return null;
    }

    return session.userUuid;
  }

  async revoke(token: string): Promise<void> {
    await this.repository.delete({
      tokenHash: this.hashToken(token),
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
