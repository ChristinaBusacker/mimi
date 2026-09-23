import type {
  AccountSecurity,
  ChangePasswordInput,
} from '@shared/auth/account-security';
import type { AuthenticatedUser } from '@shared/auth/authenticated-user';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { compare } from 'bcryptjs';

import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { AuthSessionService } from './auth-session.service';
import type { DiscordIdentity } from './types/discord-identity';

const BCRYPT_MAX_PASSWORD_BYTES = 72;

@Injectable()
export class AccountSecurityService {
  private readonly logger =
    new Logger(
      AccountSecurityService.name,
    );

  constructor(
    private readonly users:
      UsersService,
    private readonly sessions:
      AuthSessionService,
    private readonly mail:
      MailService,
  ) {}

  async get(
    actor: AuthenticatedUser,
  ): Promise<AccountSecurity> {
    const user =
      await this.users
        .findByUuidWithPassword(
          actor.uuid,
        );

    if (!user) {
      throw new NotFoundException();
    }

    return {
      email: user.email,
      hasPassword:
        Boolean(user.password),
      discordConnected:
        Boolean(user.discordId),
    };
  }

  async changePassword(
    actor: AuthenticatedUser,
    input: ChangePasswordInput,
  ): Promise<void> {
    if (
      Buffer.byteLength(
        input.password,
        'utf8',
      ) >
      BCRYPT_MAX_PASSWORD_BYTES
    ) {
      throw new BadRequestException(
        'Password is too long.',
      );
    }

    const user =
      await this.users
        .findByUuidWithPassword(
          actor.uuid,
        );

    if (!user) {
      throw new NotFoundException();
    }

    if (user.password) {
      const currentPassword =
        input.currentPassword;

      if (
        !currentPassword ||
        !await compare(
          currentPassword,
          user.password,
        )
      ) {
        throw new UnauthorizedException(
          'The current password is incorrect.',
        );
      }
    }

    await this.users.setPassword(
      user,
      input.password,
    );

    await this.sessions
      .revokeAllForUser(
        user.uuid,
      );

    try {
      await this.mail.send({
        type: 'password-changed',
        to: user.email,
        subject:
          'Dein Passwort wurde geändert',
        hello:
          `Hallo ${user.name},`,
        content:
          'das Passwort für dein Konto wurde geändert. Wenn du diese Änderung nicht vorgenommen hast, wende dich bitte an uns.',
        userUuid: user.uuid,
        context: {
          purpose:
            'account-password-change',
        },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Password changed mail for user ${user.uuid} could not be sent: ${this.getErrorMessage(error)}`,
      );
    }
  }

  async connectDiscord(
    actor: AuthenticatedUser,
    discord: DiscordIdentity,
  ): Promise<void> {
    const user =
      await this.users.findByUuid(
        actor.uuid,
      );

    if (!user) {
      throw new NotFoundException();
    }

    const existing =
      await this.users
        .findByDiscordId(
          discord.id,
        );

    if (
      existing &&
      existing.uuid !== user.uuid
    ) {
      throw new ConflictException(
        'This Discord account is already connected to another user.',
      );
    }

    if (
      user.discordId &&
      user.discordId !==
        discord.id
    ) {
      throw new ConflictException(
        'Disconnect the currently linked Discord account first.',
      );
    }

    if (
      user.discordId ===
      discord.id
    ) {
      return;
    }

    await this.users.connectDiscord(
      user,
      discord.id,
    );
  }

  async disconnectDiscord(
    actor: AuthenticatedUser,
  ): Promise<void> {
    const user =
      await this.users
        .findByUuidWithPassword(
          actor.uuid,
        );

    if (!user) {
      throw new NotFoundException();
    }

    if (!user.discordId) {
      return;
    }

    if (!user.password) {
      throw new ConflictException(
        'Set a password before disconnecting Discord.',
      );
    }

    await this.users
      .disconnectDiscord(user);
  }

  private getErrorMessage(
    error: unknown,
  ): string {
    return error instanceof Error
      ? error.message
      : String(error);
  }
}
