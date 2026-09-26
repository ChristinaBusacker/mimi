import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InjectDataSource,
  InjectRepository,
} from '@nestjs/typeorm';
import {
  DataSource,
  IsNull,
  Repository,
} from 'typeorm';

import { CommunityProfileEntry } from './entities/community-profile.entry';
import { DiscordMembershipPeriodEntry } from './entities/discord-membership-period.entry';

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(
      CommunityProfileEntry,
    )
    private readonly profiles:
      Repository<CommunityProfileEntry>,
    @InjectDataSource()
    private readonly dataSource:
      DataSource,
  ) {}

  getProfile(
    userUuid: string,
  ): Promise<CommunityProfileEntry | null> {
    return this.profiles.findOneBy({
      userUuid,
    });
  }

  async upsertDiscordIdentity(
    userUuid: string,
    discordDisplayName: string,
    discordAvatarHash?: string | null,
  ): Promise<CommunityProfileEntry> {
    const profile =
      await this.profiles.findOneBy({
        userUuid,
      });

    if (!profile) {
      return this.profiles.save(
        this.profiles.create({
          userUuid,
          discordDisplayName,
          discordAvatarHash:
            discordAvatarHash ?? null,
          isDiscordMember: false,
          firstKnownDiscordJoinAt:
            null,
          currentDiscordJoinAt:
            null,
        }),
      );
    }

    profile.discordDisplayName =
      discordDisplayName;

    if (
      discordAvatarHash !==
      undefined
    ) {
      profile.discordAvatarHash =
        discordAvatarHash;
    }

    return this.profiles.save(
      profile,
    );
  }

  async markDiscordJoined(
    userUuid: string,
    joinedAt: Date,
  ): Promise<void> {
    await this.dataSource.transaction(
      async (manager) => {
        const profileRepository =
          manager.getRepository(
            CommunityProfileEntry,
          );
        const periodRepository =
          manager.getRepository(
            DiscordMembershipPeriodEntry,
          );
        const profile =
          await profileRepository
            .findOneBy({
              userUuid,
            });

        if (!profile) {
          throw new NotFoundException(
            `Community profile for user "${userUuid}" not found.`,
          );
        }

        let period =
          await periodRepository
            .findOne({
              where: {
                userUuid,
                leftAt: IsNull(),
              },
              order: {
                joinedAt: 'ASC',
              },
            });

        if (!period) {
          period =
            await periodRepository.save(
              periodRepository.create({
                userUuid,
                joinedAt,
                leftAt: null,
              }),
            );
        } else if (
          joinedAt.getTime() <
          period.joinedAt.getTime()
        ) {
          period.joinedAt =
            joinedAt;

          period =
            await periodRepository.save(
              period,
            );
        }

        profile.isDiscordMember =
          true;
        profile.currentDiscordJoinAt =
          period.joinedAt;

        if (
          !profile.firstKnownDiscordJoinAt ||
          period.joinedAt.getTime() <
            profile.firstKnownDiscordJoinAt
              .getTime()
        ) {
          profile.firstKnownDiscordJoinAt =
            period.joinedAt;
        }

        await profileRepository.save(
          profile,
        );
      },
    );
  }

  async markDiscordLeft(
    userUuid: string,
    leftAt: Date,
  ): Promise<void> {
    await this.dataSource.transaction(
      async (manager) => {
        const profileRepository =
          manager.getRepository(
            CommunityProfileEntry,
          );
        const periodRepository =
          manager.getRepository(
            DiscordMembershipPeriodEntry,
          );
        const period =
          await periodRepository
            .findOne({
              where: {
                userUuid,
                leftAt: IsNull(),
              },
              order: {
                joinedAt: 'DESC',
              },
            });

        if (period) {
          if (
            leftAt.getTime() <
            period.joinedAt.getTime()
          ) {
            throw new Error(
              'Discord membership cannot end before it started.',
            );
          }

          period.leftAt =
            leftAt;

          await periodRepository.save(
            period,
          );
        }

        const profile =
          await profileRepository
            .findOneBy({
              userUuid,
            });

        if (!profile) {
          return;
        }

        profile.isDiscordMember =
          false;
        profile.currentDiscordJoinAt =
          null;

        await profileRepository.save(
          profile,
        );
      },
    );
  }
}
