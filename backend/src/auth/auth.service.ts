import type { AuthenticatedUser } from '@shared/auth/authenticated-user';

import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare } from 'bcryptjs';

import { UserEntry } from '../users/entities/user.entry';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthService.name);
  private readonly configuredAdminEmails: ReadonlySet<string>;

  constructor(
    private readonly usersService: UsersService,
    configService: ConfigService,
  ) {
    this.configuredAdminEmails = new Set(
      (configService.get<string>('AUTH_ADMIN_EMAILS') ?? '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    for (const email of this.configuredAdminEmails) {
      const user = await this.usersService.findByEmail(email);

      if (!user) {
        this.logger.warn(
          `Configured admin user "${email}" does not exist yet.`,
        );

        continue;
      }

      await this.ensureConfiguredAdmin(user);
    }
  }

  async validateLocalUser(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser> {
    const user = await this.usersService.findByEmailWithPassword(email);

    if (!user?.password) {
      throw new UnauthorizedException();
    }

    const passwordMatches = await compare(password, user.password);

    if (!passwordMatches) {
      throw new UnauthorizedException();
    }

    return this.toAuthenticatedUser(
      await this.ensureConfiguredAdmin(user),
    );
  }

  async validateDiscordUser(
    discordId: string,
    name: string,
    email: string,
  ): Promise<AuthenticatedUser> {
    const existingDiscordUser =
      await this.usersService.findByDiscordId(discordId);

    if (existingDiscordUser) {
      return this.toAuthenticatedUser(
        await this.ensureConfiguredAdmin(existingDiscordUser),
      );
    }

    const existingEmailUser = await this.usersService.findByEmail(email);

    if (existingEmailUser) {
      const connectedUser = await this.usersService.connectDiscord(
        existingEmailUser,
        discordId,
      );

      return this.toAuthenticatedUser(
        await this.ensureConfiguredAdmin(connectedUser),
      );
    }

    const user = await this.usersService.createDiscord(
      discordId,
      name,
      email,
    );

    return this.toAuthenticatedUser(
      await this.ensureConfiguredAdmin(user),
    );
  }

  toAuthenticatedUser(user: UserEntry): AuthenticatedUser {
    return {
      uuid: user.uuid,
      name: user.name,
      email: user.email,
      discordId: user.discordId,
      role: user.role,
    };
  }

  private async ensureConfiguredAdmin(
    user: UserEntry,
  ): Promise<UserEntry> {
    if (
      user.role === 'admin' ||
      !this.configuredAdminEmails.has(user.email.toLowerCase())
    ) {
      return user;
    }

    return this.usersService.setRole(user, 'admin');
  }
}
