// src/users/users.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hash } from 'bcryptjs';
import { UserEntry } from './entities/user.entry';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntry)
    private readonly usersRepository: Repository<UserEntry>,
  ) {}

  findByEmail(email: string): Promise<UserEntry | null> {
    return this.usersRepository.findOneBy({
      email: email.toLowerCase(),
    });
  }

  findByDiscordId(discordId: string): Promise<UserEntry | null> {
    return this.usersRepository.findOneBy({
      discordId,
    });
  }

  findByEmailWithPassword(email: string): Promise<UserEntry | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('LOWER(user.email) = LOWER(:email)', {
        email,
      })
      .getOne();
  }

  async createLocal(
    name: string,
    email: string,
    password: string,
  ): Promise<UserEntry> {
    const passwordHash = await hash(password, 12);

    const user = this.usersRepository.create({
      name,
      email: email.toLowerCase(),
      password: passwordHash,
    });

    return this.usersRepository.save(user);
  }

  async createDiscord(
    discordId: string,
    name: string,
    email: string,
  ): Promise<UserEntry> {
    const user = this.usersRepository.create({
      discordId,
      name,
      email: email.toLowerCase(),
      password: null,
    });

    return this.usersRepository.save(user);
  }

  async connectDiscord(user: UserEntry, discordId: string): Promise<UserEntry> {
    user.discordId = discordId;

    return this.usersRepository.save(user);
  }
}
