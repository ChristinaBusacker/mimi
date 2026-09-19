// src/auth/auth.service.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { compare } from 'bcryptjs';

import { UserEntry } from '../users/entities/user.entry';
import { UsersService } from '../users/users.service';

export type AuthenticatedUser = Omit<UserEntry, 'password'>;

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

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

    return this.removePassword(user);
  }

  async validateDiscordUser(
    discordId: string,
    name: string,
    email: string,
  ): Promise<AuthenticatedUser> {
    const existingDiscordUser =
      await this.usersService.findByDiscordId(discordId);

    if (existingDiscordUser) {
      return this.removePassword(existingDiscordUser);
    }

    const existingEmailUser = await this.usersService.findByEmail(email);

    if (existingEmailUser) {
      const connectedUser = await this.usersService.connectDiscord(
        existingEmailUser,
        discordId,
      );

      return this.removePassword(connectedUser);
    }

    const user = await this.usersService.createDiscord(discordId, name, email);

    return this.removePassword(user);
  }

  private removePassword(user: UserEntry): AuthenticatedUser {
    const { password: _, ...authenticatedUser } = user;

    return authenticatedUser;
  }
}
