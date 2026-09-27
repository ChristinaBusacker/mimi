import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CommunityDiscordRoleDefinitionService } from './community-discord-role-definition.service';
import { CommunityProgressionDefinitionService } from './community-progression-definition.service';
import { CommunityProgressionService } from './community-progression.service';
import { CommunityService } from './community.service';
import { UserAchievementEntry } from './entities/user-achievement.entry';

export interface CommunityDiscordUserRoleResolution {
  desiredRoleIds: ReadonlySet<string>;
  managedRoleIds: ReadonlySet<string>;
}

@Injectable()
export class CommunityDiscordUserRoleResolverService {
  private readonly logger = new Logger(
    CommunityDiscordUserRoleResolverService.name,
  );

  constructor(
    private readonly discordRoles:
      CommunityDiscordRoleDefinitionService,
    private readonly progression:
      CommunityProgressionService,
    private readonly progressionDefinitions:
      CommunityProgressionDefinitionService,
    private readonly community:
      CommunityService,
    @InjectRepository(
      UserAchievementEntry,
    )
    private readonly userAchievements:
      Repository<UserAchievementEntry>,
  ) {}

  async resolve(
    userUuid: string,
  ): Promise<CommunityDiscordUserRoleResolution> {
    const [
      definitions,
      totalXp,
      levels,
      profile,
      unlockedAchievements,
    ] = await Promise.all([
      this.discordRoles.getDefinitions(),
      this.progression.getTotalXp(
        userUuid,
      ),
      this.progressionDefinitions.getLevels(),
      this.community.getProfile(
        userUuid,
      ),
      this.userAchievements.findBy({
        userUuid,
      }),
    ]);
    const managedDefinitions =
      definitions.filter(
        (role) =>
          (role.kind === 'level-range' ||
            role.kind === 'showcase') &&
          role.provisionedByCommunity &&
          role.discordRoleId !== null,
      );
    const managedRoleIds = new Set(
      managedDefinitions.flatMap(
        (role) =>
          role.discordRoleId
            ? [role.discordRoleId]
            : [],
      ),
    );
    const desiredRoleIds =
      new Set<string>();
    const level = levels
      .filter(
        (definition) =>
          definition.requiredXp <= totalXp,
      )
      .reduce(
        (current, definition) =>
          definition.level > current
            ? definition.level
            : current,
        1,
      );
    const levelRoles =
      managedDefinitions.filter(
        (role) =>
          role.enabled &&
          role.kind === 'level-range' &&
          role.minimumLevel !== null &&
          role.minimumLevel <= level &&
          (
            role.maximumLevel === null ||
            role.maximumLevel >= level
          ),
      );

    if (levelRoles.length > 1) {
      this.logger.warn(
        `Multiple enabled Discord level roles match level ${level} for community user ${userUuid}.`,
      );
    }

    const levelRole = levelRoles[0];

    if (levelRole?.discordRoleId) {
      desiredRoleIds.add(
        levelRole.discordRoleId,
      );
    }

    const selectedShowcaseRoleId =
      profile
        ?.selectedDiscordShowcaseRoleUuid ??
      null;

    if (selectedShowcaseRoleId) {
      const unlockedAchievementIds =
        new Set(
          unlockedAchievements.map(
            (entry) =>
              entry.achievementUuid,
          ),
        );
      const selectedShowcase =
        managedDefinitions.find(
          (role) =>
            role.id ===
              selectedShowcaseRoleId &&
            role.enabled &&
            role.kind === 'showcase' &&
            role.achievementId !== null &&
            unlockedAchievementIds.has(
              role.achievementId,
            ),
        );

      if (selectedShowcase?.discordRoleId) {
        desiredRoleIds.add(
          selectedShowcase.discordRoleId,
        );
      }
    }

    return {
      desiredRoleIds,
      managedRoleIds,
    };
  }
}
