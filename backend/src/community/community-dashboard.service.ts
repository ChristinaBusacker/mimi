import type {
  CommunityDashboard,
} from '@shared/community/community-dashboard';

import {
  Injectable,
} from '@nestjs/common';

import { CommunityProfileCustomizationService } from './community-profile-customization.service';
import { CommunityProgressionDefinitionService } from './community-progression-definition.service';
import { CommunityProgressionService } from './community-progression.service';
import { CommunityService } from './community.service';

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
  ) {}

  async getDashboard(
    userUuid: string,
  ): Promise<CommunityDashboard> {
    const profile =
      await this.community.getProfile(
        userUuid,
      );

    if (!profile) {
      return {
        membership: 'not-connected',
        discordDisplayName: null,
        memberSince: null,
        totalXp: 0,
        level: null,
        nextLevel: null,
        progressPercent: 0,
        achievements: [],
        titles: [],
        customization: null,
      };
    }

    const [
      snapshot,
      customization,
      levels,
      achievements,
      titles,
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
