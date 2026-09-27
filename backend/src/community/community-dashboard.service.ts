import type {
  CommunityDashboard,
} from '@shared/community/community-dashboard';

import {
  Injectable,
} from '@nestjs/common';

import { CommunityDiscordRoleDefinitionService } from './community-discord-role-definition.service';
import { CommunityProfileCustomizationService } from './community-profile-customization.service';
import { CommunityProgressionDefinitionService } from './community-progression-definition.service';
import { CommunityProgressionService } from './community-progression.service';
import { CommunityService } from './community.service';
import { CommunityTwitchIdentityService } from './twitch/community-twitch-identity.service';

@Injectable()
export class CommunityDashboardService {
  constructor(
    private readonly community:
      CommunityService,
    private readonly progression:
      CommunityProgressionService,
    private readonly definitions:
      CommunityProgressionDefinitionService,
    private readonly customization:
      CommunityProfileCustomizationService,
    private readonly discordRoles:
      CommunityDiscordRoleDefinitionService,
    private readonly twitch:
      CommunityTwitchIdentityService,
  ) {}

  async getDashboard(
    userUuid: string,
  ): Promise<CommunityDashboard> {
    const [profile, twitch] =
      await Promise.all([
        this.community.getProfile(
          userUuid,
        ),
        this.twitch.getConnection(
          userUuid,
        ),
      ]);

    if (!profile) {
      return {
        membership: 'not-connected',
        discordDisplayName: null,
        memberSince: null,
        twitch,
        totalXp: 0,
        level: null,
        nextLevel: null,
        progressPercent: 0,
        achievements: [],
        titles: [],
        discordShowcaseRoles: [],
        selectedDiscordShowcaseRoleId: null,
        customization: null,
      };
    }

    const [
      snapshot,
      customization,
      levels,
      achievements,
      titles,
      discordRoles,
    ] = await Promise.all([
      this.progression.getSnapshot(
        userUuid,
      ),
      this.customization
        .getCustomization(userUuid),
      this.definitions.getLevels(),
      this.definitions
        .getAchievements(),
      this.definitions.getTitles(),
      this.discordRoles.getDefinitions(),
    ]);
    const currentLevel =
      snapshot.level;
    const nextLevel = levels
      .filter(
        (level) =>
          level.requiredXp >
          snapshot.totalXp,
      )
      .sort(
        (left, right) =>
          left.requiredXp -
          right.requiredXp,
      )[0] ?? null;
    const unlockedAchievements =
      new Set(
        snapshot.unlockedAchievementIds,
      );
    const pinnedAchievements =
      new Set(
        customization
          .pinnedAchievementIds,
      );
    const unlockedTitles =
      new Set(
        snapshot.unlockedTitleIds,
      );

    return {
      membership:
        profile.isDiscordMember
          ? 'member'
          : 'not-member',
      discordDisplayName:
        profile.discordDisplayName,
      memberSince:
        profile.currentDiscordJoinAt
          ?.toISOString() ?? null,
      twitch,
      totalXp: snapshot.totalXp,
      level: currentLevel
        ? {
            level:
              currentLevel.level,
            requiredXp:
              currentLevel.requiredXp,
          }
        : null,
      nextLevel: nextLevel
        ? {
            level: nextLevel.level,
            requiredXp:
              nextLevel.requiredXp,
          }
        : null,
      progressPercent:
        this.progressPercent(
          snapshot.totalXp,
          currentLevel
            ?.requiredXp ?? 0,
          nextLevel?.requiredXp ?? null,
        ),
      achievements:
        achievements.map(
          (achievement) => ({
            id: achievement.id,
            key: achievement.key,
            name: achievement.name,
            description:
              achievement.description,
            badgeAssetId:
              achievement.badgeAssetId,
            unlockedProfileColor:
              achievement
                .unlockedProfileColor,
            unlocked:
              unlockedAchievements.has(
                achievement.id,
              ),
            pinned:
              pinnedAchievements.has(
                achievement.id,
              ),
          }),
        ),
      titles: titles
        .filter((title) =>
          unlockedTitles.has(title.id),
        )
        .map((title) => ({
          id: title.id,
          name: title.name,
          description:
            title.description,
          selected:
            customization
              .selectedTitleId ===
            title.id,
        })),
      discordShowcaseRoles:
        discordRoles.flatMap((role) =>
          role.kind === 'showcase' &&
          role.enabled &&
          role.color !== null &&
          role.achievementId
            ? [
                {
                  id: role.id,
                  name: role.name,
                  color: role.color,
                  achievementId:
                    role.achievementId,
                  unlocked:
                    unlockedAchievements.has(
                      role.achievementId,
                    ),
                  selected:
                    profile
                      .selectedDiscordShowcaseRoleUuid ===
                    role.id,
                  availableOnDiscord:
                    role.provisionedByCommunity &&
                    role.discordRoleId !== null,
                },
              ]
            : [],
        ),
      selectedDiscordShowcaseRoleId:
        profile
          .selectedDiscordShowcaseRoleUuid,
      customization,
    };
  }

  private progressPercent(
    totalXp: number,
    currentRequiredXp: number,
    nextRequiredXp: number | null,
  ): number {
    if (nextRequiredXp === null) {
      return 100;
    }

    const range =
      nextRequiredXp -
      currentRequiredXp;

    if (range <= 0) {
      return 100;
    }

    return Math.max(
      0,
      Math.min(
        100,
        Math.round(
          ((totalXp -
            currentRequiredXp) /
            range) *
            100,
        ),
      ),
    );
  }
}
