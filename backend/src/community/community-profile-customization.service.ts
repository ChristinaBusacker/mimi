import type {
  CommunityProfileCustomization,
} from '@shared/community/community-progression';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
} from 'typeorm';

import { CommunityProgressionService } from './community-progression.service';
import { CommunityRewardSyncService } from './community-reward-sync.service';
import { CommunityAchievementEntry } from './entities/community-achievement.entry';
import { CommunityDiscordRoleEntry } from './entities/community-discord-role.entry';
import { CommunityPinnedAchievementEntry } from './entities/community-pinned-achievement.entry';
import { CommunityProfileEntry } from './entities/community-profile.entry';
import { UserAchievementEntry } from './entities/user-achievement.entry';

export const MAX_PINNED_ACHIEVEMENTS = 3;

@Injectable()
export class CommunityProfileCustomizationService {
  constructor(
    @InjectDataSource()
    private readonly dataSource:
      DataSource,
    private readonly progression:
      CommunityProgressionService,
    private readonly rewardSync:
      CommunityRewardSyncService,
  ) {}

  async getCustomization(
    userUuid: string,
  ): Promise<CommunityProfileCustomization> {
    return this.getCustomizationWithManager(
      this.dataSource.manager,
      userUuid,
    );
  }

  selectTitle(
    userUuid: string,
    titleUuid: string | null,
  ): Promise<void> {
    return this.progression.selectTitle(
      userUuid,
      titleUuid,
    );
  }

  async selectProfileColor(
    userUuid: string,
    achievementUuid: string | null,
  ): Promise<void> {
    await this.dataSource.transaction(
      async (manager) => {
        const profile =
          await this.getProfileForUpdate(
            manager,
            userUuid,
          );

        if (achievementUuid) {
          const [
            unlock,
            achievement,
          ] = await Promise.all([
            manager
              .getRepository(
                UserAchievementEntry,
              )
              .findOneBy({
                userUuid,
                achievementUuid,
              }),
            manager
              .getRepository(
                CommunityAchievementEntry,
              )
              .findOneBy({
                uuid: achievementUuid,
              }),
          ]);

          if (
            !unlock ||
            !achievement
              ?.unlockedProfileColor
          ) {
            throw new BadRequestException(
              'The selected profile color is not unlocked.',
            );
          }
        }

        profile
          .selectedProfileColorAchievementUuid =
          achievementUuid;

        await manager
          .getRepository(
            CommunityProfileEntry,
          )
          .save(profile);
      },
    );
  }

  async selectDiscordShowcaseRole(
    userUuid: string,
    roleUuid: string | null,
  ): Promise<void> {
    await this.dataSource.transaction(
      async (manager) => {
        const profile =
          await this.getProfileForUpdate(
            manager,
            userUuid,
          );
        let selectedAchievementUuid:
          string | null = null;

        if (roleUuid) {
          const role =
            await manager
              .getRepository(
                CommunityDiscordRoleEntry,
              )
              .findOneBy({
                uuid: roleUuid,
              });

          if (
            !role ||
            !role.enabled ||
            role.kind !== 'showcase' ||
            !role.achievementUuid ||
            !role.color ||
            !role.provisionedByCommunity ||
            !role.discordRoleId
          ) {
            throw new BadRequestException(
              'The selected Discord showcase role is not available.',
            );
          }

          const unlock =
            await manager
              .getRepository(
                UserAchievementEntry,
              )
              .findOneBy({
                userUuid,
                achievementUuid:
                  role.achievementUuid,
              });

          if (!unlock) {
            throw new BadRequestException(
              'The selected Discord showcase role is not unlocked.',
            );
          }

          selectedAchievementUuid =
            role.achievementUuid;
        }

        profile
          .selectedDiscordShowcaseRoleUuid =
          roleUuid;
        profile
          .selectedProfileColorAchievementUuid =
          selectedAchievementUuid;

        await manager
          .getRepository(
            CommunityProfileEntry,
          )
          .save(profile);
      },
    );

    this.rewardSync.request(
      userUuid,
    );
  }

  async setPinnedAchievements(
    userUuid: string,
    achievementUuids: readonly string[],
  ): Promise<void> {
    const normalized =
      achievementUuids.map(
        (achievementUuid) =>
          achievementUuid.trim(),
      );

    if (
      normalized.length >
      MAX_PINNED_ACHIEVEMENTS
    ) {
      throw new BadRequestException(
        `At most ${MAX_PINNED_ACHIEVEMENTS} achievements can be pinned.`,
      );
    }

    if (
      normalized.some(
        (achievementUuid) =>
          achievementUuid.length === 0,
      ) ||
      new Set(normalized).size !==
        normalized.length
    ) {
      throw new BadRequestException(
        'Pinned achievements must be unique, non-empty IDs.',
      );
    }

    await this.dataSource.transaction(
      async (manager) => {
        await this.getProfileForUpdate(
          manager,
          userUuid,
        );

        if (normalized.length > 0) {
          const unlocked =
            await manager
              .getRepository(
                UserAchievementEntry,
              )
              .findBy({
                userUuid,
                achievementUuid:
                  In(normalized),
              });

          if (
            unlocked.length !==
            normalized.length
          ) {
            throw new BadRequestException(
              'Only unlocked achievements can be pinned.',
            );
          }
        }

        const repository =
          manager.getRepository(
            CommunityPinnedAchievementEntry,
          );

        await repository.delete({
          userUuid,
        });

        if (normalized.length === 0) {
          return;
        }

        await repository.save(
          normalized.map(
            (
              achievementUuid,
              position,
            ) =>
              repository.create({
                userUuid,
                achievementUuid,
                position,
              }),
          ),
        );
      },
    );
  }

  private async getCustomizationWithManager(
    manager: EntityManager,
    userUuid: string,
  ): Promise<CommunityProfileCustomization> {
    const profile =
      await manager
        .getRepository(
          CommunityProfileEntry,
        )
        .findOneBy({
          userUuid,
        });

    if (!profile) {
      throw new NotFoundException(
        `Community profile for user "${userUuid}" not found.`,
      );
    }

    const [
      pinned,
      unlocked,
    ] = await Promise.all([
      manager
        .getRepository(
          CommunityPinnedAchievementEntry,
        )
        .find({
          where: {
            userUuid,
          },
          order: {
            position: 'ASC',
          },
        }),
      manager
        .getRepository(
          UserAchievementEntry,
        )
        .findBy({
          userUuid,
        }),
    ]);

    const unlockedIds =
      unlocked.map(
        (entry) =>
          entry.achievementUuid,
      );
    const achievements =
      unlockedIds.length === 0
        ? []
        : await manager
            .getRepository(
              CommunityAchievementEntry,
            )
            .find({
              where: {
                uuid: In(
                  unlockedIds,
                ),
              },
              order: {
                sortOrder: 'ASC',
                key: 'ASC',
              },
            });
    const selectedShowcaseRole =
      profile.selectedDiscordShowcaseRoleUuid
        ? await manager
            .getRepository(
              CommunityDiscordRoleEntry,
            )
            .findOneBy({
              uuid: profile
                .selectedDiscordShowcaseRoleUuid,
              enabled: true,
            })
        : null;

    return {
      selectedTitleId:
        profile.selectedTitleUuid,
      selectedProfileColorAchievementId:
        selectedShowcaseRole
          ?.achievementUuid ?? null,
      selectedProfileColor:
        selectedShowcaseRole?.color ?? null,
      unlockedProfileColors:
        achievements
          .filter(
            (
              achievement,
            ): achievement is
              CommunityAchievementEntry & {
                unlockedProfileColor:
                  string;
              } =>
              achievement
                .unlockedProfileColor !==
              null,
          )
          .map((achievement) => ({
            achievementId:
              achievement.uuid,
            color:
              achievement
                .unlockedProfileColor,
          })),
      pinnedAchievementIds:
        pinned.map(
          (entry) =>
            entry.achievementUuid,
        ),
    };
  }

  private async getProfileForUpdate(
    manager: EntityManager,
    userUuid: string,
  ): Promise<CommunityProfileEntry> {
    const profile =
      await manager
        .getRepository(
          CommunityProfileEntry,
        )
        .findOne({
          where: {
            userUuid,
          },
          lock: {
            mode:
              'pessimistic_write',
          },
        });

    if (!profile) {
      throw new NotFoundException(
        `Community profile for user "${userUuid}" not found.`,
      );
    }

    return profile;
  }
}
