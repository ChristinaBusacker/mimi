import {
  createHash,
  randomBytes,
} from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  LessThanOrEqual,
  Repository,
} from 'typeorm';

import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { AuthSessionService } from './auth-session.service';
import { PasswordResetTokenEntry } from './entities/password-reset-token.entry';

const DEFAULT_RESET_TTL_MINUTES = 30;
const MIN_RESET_TTL_MINUTES = 5;
const MAX_RESET_TTL_MINUTES = 180;
const REQUEST_COOLDOWN_MS = 60_000;
const BCRYPT_MAX_PASSWORD_BYTES = 72;

@Injectable()
export class PasswordResetService {
  private readonly logger =
    new Logger(
      PasswordResetService.name,
    );

  private readonly resetTtlMs:
    number;

  constructor(
    @InjectRepository(
      PasswordResetTokenEntry,
    )
    private readonly repository:
      Repository<PasswordResetTokenEntry>,
    private readonly users:
      UsersService,
    private readonly sessions:
      AuthSessionService,
    private readonly mail:
      MailService,
    private readonly config:
      ConfigService,
  ) {
    const configuredTtl = Number(
      this.config.get<string>(
        'AUTH_PASSWORD_RESET_TTL_MINUTES',
      ) ??
        DEFAULT_RESET_TTL_MINUTES,
    );

    if (
      !Number.isInteger(
        configuredTtl,
      ) ||
      configuredTtl <
        MIN_RESET_TTL_MINUTES ||
      configuredTtl >
        MAX_RESET_TTL_MINUTES
    ) {
      throw new Error(
        `AUTH_PASSWORD_RESET_TTL_MINUTES must be an integer between ${MIN_RESET_TTL_MINUTES} and ${MAX_RESET_TTL_MINUTES}.`,
      );
    }

    this.resetTtlMs =
      configuredTtl *
      60 *
      1000;
  }

  async requestReset(
    email: string,
  ): Promise<void> {
    const now = new Date();

    await this.repository.delete({
      expiresAt:
        LessThanOrEqual(now),
    });

    const user =
      await this.users.findByEmail(
        email,
      );

    if (!user) {
      return;
    }

    const latest =
      await this.repository.findOne({
        where: {
          userUuid: user.uuid,
        },
        order: {
          createdAt: 'DESC',
        },
      });

    if (
      latest &&
      latest.expiresAt.getTime() >
        now.getTime() &&
      latest.createdAt.getTime() >
        now.getTime() -
          REQUEST_COOLDOWN_MS
    ) {
      return;
    }

    const token = randomBytes(32)
      .toString('base64url');
    const tokenHash =
      this.hashToken(token);
    const expiresAt = new Date(
      now.getTime() +
        this.resetTtlMs,
    );

    await this.repository.save(
      this.repository.create({
        tokenHash,
        userUuid: user.uuid,
        expiresAt,
      }),
    );

    try {
      await this.mail.send({
        type: 'password-reset',
        to: user.email,
        subject:
          'Passwort zurücksetzen',
        hello:
          `Hallo ${user.name},`,
        content:
          'für dein Konto wurde das Zurücksetzen des Passworts angefordert. Der Link ist nur für begrenzte Zeit gültig. Wenn du das nicht warst, kannst du diese E-Mail ignorieren.',
        cta: {
          label:
            'Passwort zurücksetzen',
          url:
            this.createResetUrl(
              token,
            ),
        },
        userUuid: user.uuid,
        context: {
          purpose:
            'password-reset',
        },
      });
    } catch (error: unknown) {
      await this.repository.delete({
        tokenHash,
      });

      this.logger.error(
        `Password reset mail for user ${user.uuid} could not be sent: ${this.getErrorMessage(error)}`,
      );
    }
  }

  async resetPassword(
    token: string,
    password: string,
  ): Promise<void> {
    if (
      Buffer.byteLength(
        password,
        'utf8',
      ) >
      BCRYPT_MAX_PASSWORD_BYTES
    ) {
      throw new BadRequestException(
        'Password is too long.',
      );
    }

    const tokenHash =
      this.hashToken(token);
    const reset =
      await this.repository.findOneBy({
        tokenHash,
      });

    if (
      !reset ||
      reset.expiresAt.getTime() <=
        Date.now()
    ) {
      if (reset) {
        await this.repository.delete({
          tokenHash,
        });
      }

      throw new BadRequestException(
        'The password reset link is invalid or expired.',
      );
    }

    const consumed =
      await this.repository.delete({
        tokenHash,
      });

    if (consumed.affected !== 1) {
      throw new BadRequestException(
        'The password reset link is invalid or expired.',
      );
    }

    const user =
      await this.users.findByUuid(
        reset.userUuid,
      );

    if (!user) {
      throw new BadRequestException(
        'The password reset link is invalid or expired.',
      );
    }

    await this.users.setPassword(
      user,
      password,
    );

    await Promise.all([
      this.repository.delete({
        userUuid: user.uuid,
      }),
      this.sessions.revokeAllForUser(
        user.uuid,
      ),
    ]);

    try {
      await this.mail.send({
        type: 'password-changed',
        to: user.email,
        subject:
          'Dein Passwort wurde geändert',
        hello:
          `Hallo ${user.name},`,
        content:
          'das Passwort für dein Konto wurde erfolgreich geändert. Wenn du diese Änderung nicht vorgenommen hast, wende dich bitte an uns.',
        userUuid: user.uuid,
        context: {
          purpose:
            'password-changed',
        },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Password changed mail for user ${user.uuid} could not be sent: ${this.getErrorMessage(error)}`,
      );
    }
  }

  private createResetUrl(
    token: string,
  ): string {
    const siteUrl = new URL(
      this.config.getOrThrow<string>(
        'PUBLIC_SITE_URL',
      ),
    );

    this.assertHttpUrl(
      siteUrl,
      'PUBLIC_SITE_URL',
    );

    const resetUrl = new URL(
      '/admin/password-reset',
      siteUrl,
    );

    resetUrl.searchParams.set(
      'token',
      token,
    );

    return resetUrl.toString();
  }

  private hashToken(
    token: string,
  ): string {
    return createHash('sha256')
      .update(token)
      .digest('hex');
  }

  private assertHttpUrl(
    url: URL,
    label: string,
  ): void {
    if (
      url.protocol !== 'http:' &&
      url.protocol !== 'https:'
    ) {
      throw new Error(
        `${label} must use HTTP or HTTPS.`,
      );
    }
  }

  private getErrorMessage(
    error: unknown,
  ): string {
    return error instanceof Error
      ? error.message
      : String(error);
  }
}
