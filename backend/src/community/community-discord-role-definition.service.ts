import type {
  CommunityDiscordRoleDefinition,
  CommunityDiscordRoleKind,
  SaveCommunityDiscordRoleDefinition,
} from '@shared/community/community-discord';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CommunityAchievementEntry } from './entities/community-achievement.entry';
import { CommunityDiscordRoleEntry } from './entities/community-discord-role.entry';

const ROLE_KEY_PATTERN =
  /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const HEX_COLOR_PATTERN =
  /^#[0-9a-f]{6}$/i;
const DISCORD_ROLE_ID_PATTERN =
  /^\d{1,32}$/;

@Injectable()
export class CommunityDiscordRoleDefinitionService {
  constructor(
    @InjectRepository(
      CommunityDiscordRoleEntry,
    )
    private readonly roles:
      Repository<CommunityDiscordRoleEntry>,
    @InjectRepository(
      CommunityAchievementEntry,
    )
    private readonly achievements:
      Repository<CommunityAchievementEntry>,
  ) {}

  async getDefinitions():
    Promise<CommunityDiscordRoleDefinition[]> {
    const roles =
      await this.roles.find({
        order: {
          kind: 'ASC',
          sortOrder: 'ASC',
          key: 'ASC',
        },
      });

    return roles.map((role) =>
      this.mapDefinition(role),
    );
  }

  async getDefinition(
    roleUuid: string,
  ): Promise<CommunityDiscordRoleDefinition> {
    const role =
      await this.roles.findOneBy({
        uuid: roleUuid,
      });

    if (!role) {
      throw new NotFoundException(
        `Community Discord role "${roleUuid}" not found.`,
      );
    }

    return this.mapDefinition(role);
  }

  async saveDefinition(
    key: string,
    input: SaveCommunityDiscordRoleDefinition,
    updatedByUserId: string | null,
  ): Promise<CommunityDiscordRoleDefinition> {
    const normalizedKey =
      this.normalizeKey(key);
    const existing =
      await this.roles.findOneBy({
        key: normalizedKey,
      });

    await this.validateDefinition(
      input,
      existing?.uuid ?? null,
    );

    const saved =
      await this.roles.save(
        existing
          ? {
              ...existing,
              kind: input.kind,
              name: input.name.trim(),
              color:
                this.normalizeColor(
                  input.color,
                ),
              enabled: input.enabled,
              achievementUuid:
                input.achievementId,
              minimumLevel:
                input.minimumLevel,
              maximumLevel:
                input.maximumLevel,
              sortOrder:
                input.sortOrder,
              updatedByUserId,
            }
          : this.roles.create({
              key: normalizedKey,
              kind: input.kind,
              name: input.name.trim(),
              color:
                this.normalizeColor(
                  input.color,
                ),
              enabled: input.enabled,
              discordRoleId: null,
              provisionedByCommunity: false,
              achievementUuid:
                input.achievementId,
              minimumLevel:
                input.minimumLevel,
              maximumLevel:
                input.maximumLevel,
              sortOrder:
                input.sortOrder,
              updatedByUserId,
            }),
      );

    return this.mapDefinition(saved);
  }

  async setProvisionedDiscordRoleId(
    roleUuid: string,
    discordRoleId: string,
  ): Promise<CommunityDiscordRoleDefinition> {
    const role =
      await this.roles.findOneBy({
        uuid: roleUuid,
      });

    if (!role) {
      throw new NotFoundException(
        `Community Discord role "${roleUuid}" not found.`,
      );
    }

    const normalizedRoleId =
      discordRoleId.trim();

    if (
      !DISCORD_ROLE_ID_PATTERN.test(
        normalizedRoleId,
      )
    ) {
      throw new BadRequestException(
        'discordRoleId must be a Discord snowflake.',
      );
    }

    const assigned =
      await this.roles.findOneBy({
        discordRoleId:
          normalizedRoleId,
      });

    if (
      assigned &&
      assigned.uuid !== role.uuid
    ) {
      throw new ConflictException(
        `Discord role "${normalizedRoleId}" is already managed by another community role.`,
      );
    }

    role.discordRoleId =
      normalizedRoleId;
    role.provisionedByCommunity = true;

    return this.mapDefinition(
      await this.roles.save(role),
    );
  }

  private async validateDefinition(
    input: SaveCommunityDiscordRoleDefinition,
    currentRoleUuid: string | null,
  ): Promise<void> {
    if (
      !this.isRoleKind(input.kind)
    ) {
      throw new BadRequestException(
        `Unknown Discord role kind "${input.kind}".`,
      );
    }

    const name = input.name.trim();

    if (
      name.length === 0 ||
      name.length > 100
    ) {
      throw new BadRequestException(
        'name must contain between 1 and 100 characters.',
      );
    }

    this.normalizeColor(input.color);

    if (
      !Number.isSafeInteger(
        input.sortOrder,
      )
    ) {
      throw new BadRequestException(
        'sortOrder must be an integer.',
      );
    }

    switch (input.kind) {
      case 'level-range':
        await this.validateLevelRange(
          input,
          currentRoleUuid,
        );
        return;
      case 'showcase':
        await this.validateShowcase(
          input,
          currentRoleUuid,
        );
        return;
      case 'special':
        this.validateSpecial(input);
        return;
    }
  }

  private async validateLevelRange(
    input: SaveCommunityDiscordRoleDefinition,
    currentRoleUuid: string | null,
  ): Promise<void> {
    if (input.achievementId !== null) {
      throw new BadRequestException(
        'A level-range role cannot reference an achievement.',
      );
    }

    this.assertPositiveLevel(
      input.minimumLevel,
      'minimumLevel',
    );

    if (input.maximumLevel !== null) {
      this.assertPositiveLevel(
        input.maximumLevel,
        'maximumLevel',
      );

      if (
        input.maximumLevel <
        input.minimumLevel!
      ) {
        throw new BadRequestException(
          'maximumLevel must be greater than or equal to minimumLevel.',
        );
      }
    }

    if (!input.enabled) {
      return;
    }

    const enabledRanges =
      await this.roles.find({
        where: {
          kind: 'level-range',
          enabled: true,
        },
      });
    const inputMaximum =
      input.maximumLevel ??
      Number.POSITIVE_INFINITY;

    for (const range of enabledRanges) {
      if (
        range.uuid ===
        currentRoleUuid
      ) {
        continue;
      }

      const rangeMaximum =
        range.maximumLevel ??
        Number.POSITIVE_INFINITY;

      if (
        input.minimumLevel! <=
          rangeMaximum &&
        range.minimumLevel! <=
          inputMaximum
      ) {
        throw new ConflictException(
          `Level range overlaps with community Discord role "${range.key}".`,
        );
      }
    }
  }

  private async validateShowcase(
    input: SaveCommunityDiscordRoleDefinition,
    currentRoleUuid: string | null,
  ): Promise<void> {
    if (
      input.minimumLevel !== null ||
      input.maximumLevel !== null
    ) {
      throw new BadRequestException(
        'A showcase role cannot define a level range.',
      );
    }

    if (!input.achievementId) {
      throw new BadRequestException(
        'A showcase role requires an achievement.',
      );
    }

    const achievement =
      await this.achievements.findOneBy({
        uuid: input.achievementId,
      });

    if (!achievement) {
      throw new NotFoundException(
        `Community achievement "${input.achievementId}" not found.`,
      );
    }

    const assigned =
      await this.roles.findOneBy({
        achievementUuid:
          input.achievementId,
        kind: 'showcase',
      });

    if (
      assigned &&
      assigned.uuid !== currentRoleUuid
    ) {
      throw new ConflictException(
        `Achievement "${input.achievementId}" already unlocks another Discord showcase role.`,
      );
    }
  }

  private validateSpecial(
    input: SaveCommunityDiscordRoleDefinition,
  ): void {
    if (
      input.achievementId !== null ||
      input.minimumLevel !== null ||
      input.maximumLevel !== null
    ) {
      throw new BadRequestException(
        'A special role cannot reference an achievement or level range.',
      );
    }
  }

  private normalizeKey(
    key: string,
  ): string {
    const normalized =
      key.trim().toLowerCase();

    if (
      normalized.length === 0 ||
      normalized.length > 120 ||
      !ROLE_KEY_PATTERN.test(normalized)
    ) {
      throw new BadRequestException(
        'key must use lowercase letters, numbers, dots or hyphens.',
      );
    }

    return normalized;
  }

  private normalizeColor(
    color: string | null,
  ): string | null {
    const normalized =
      color?.trim() || null;

    if (
      normalized &&
      !HEX_COLOR_PATTERN.test(normalized)
    ) {
      throw new BadRequestException(
        'color must be a hex color like #7c5cff.',
      );
    }

    return normalized?.toLowerCase() ?? null;
  }

  private assertPositiveLevel(
    level: number | null,
    field: string,
  ): void {
    if (
      level === null ||
      !Number.isSafeInteger(level) ||
      level < 1
    ) {
      throw new BadRequestException(
        `${field} must be a positive integer.`,
      );
    }
  }

  private isRoleKind(
    value: string,
  ): value is CommunityDiscordRoleKind {
    return (
      value === 'level-range' ||
      value === 'showcase' ||
      value === 'special'
    );
  }

  private mapDefinition(
    role: CommunityDiscordRoleEntry,
  ): CommunityDiscordRoleDefinition {
    return {
      id: role.uuid,
      key: role.key,
      kind: role.kind,
      name: role.name,
      color: role.color,
      enabled: role.enabled,
      discordRoleId:
        role.discordRoleId,
      provisionedByCommunity:
        role.provisionedByCommunity,
      achievementId:
        role.achievementUuid,
      minimumLevel:
        role.minimumLevel,
      maximumLevel:
        role.maximumLevel,
      sortOrder: role.sortOrder,
      updatedByUserId:
        role.updatedByUserId,
      createdAt:
        role.createdAt.toISOString(),
      updatedAt:
        role.updatedAt.toISOString(),
    };
  }
}
