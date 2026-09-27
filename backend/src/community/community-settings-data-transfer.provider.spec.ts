import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { DataTransferService } from '../data-transfer/data-transfer.service';
import type { CommunityDiscordRoleDefinitionService } from './community-discord-role-definition.service';
import type { CommunityEventRuleService } from './community-event-rule.service';
import type { CommunityProgressionDefinitionService } from './community-progression-definition.service';
import { CommunitySettingsDataTransferProvider } from './community-settings-data-transfer.provider';

function createServices() {
  const dataTransfer = {
    register: vi.fn(),
  } as unknown as DataTransferService;
  const eventRules = {
    getRules: vi.fn(async () => [
      {
        eventType: 'discord.message.activity',
        enabled: true,
        xpAmount: 2,
        dailyRewardLimit: 10,
        contextRewardLimit: null,
        cooldownSeconds: 60,
        minimumContentLength: 20,
        updatedByUserId: null,
        createdAt: '2026-09-27T00:00:00.000Z',
        updatedAt: '2026-09-27T00:00:00.000Z',
      },
    ]),
    saveRule: vi.fn(async () => undefined),
  } as unknown as CommunityEventRuleService;
  const definitions = {
    getLevels: vi.fn(async () => [
      {
        level: 1,
        requiredXp: 0,
        updatedByUserId: null,
        createdAt: '2026-09-27T00:00:00.000Z',
        updatedAt: '2026-09-27T00:00:00.000Z',
      },
      {
        level: 2,
        requiredXp: 100,
        updatedByUserId: null,
        createdAt: '2026-09-27T00:00:00.000Z',
        updatedAt: '2026-09-27T00:00:00.000Z',
      },
    ]),
    getTitles: vi.fn(async () => [
      {
        id: 'title-id',
        key: 'veteran',
        enabled: true,
        name: { de: 'Veteran', en: 'Veteran' },
        description: { de: 'Dabei.', en: 'Around.' },
        updatedByUserId: null,
        createdAt: '2026-09-27T00:00:00.000Z',
        updatedAt: '2026-09-27T00:00:00.000Z',
      },
    ]),
    getAchievements: vi.fn(async () => [
      {
        id: 'achievement-id',
        key: 'one-year',
        enabled: true,
        name: { de: 'Ein Jahr', en: 'One year' },
        description: { de: 'Ein Jahr dabei.', en: 'One year around.' },
        badgeAssetId: 'badge-asset-id',
        conditionMode: 'all',
        conditions: [
          {
            id: 'condition-id',
            metric: 'total-xp',
            operator: 'gte',
            threshold: 100,
            eventType: null,
            sortOrder: 0,
          },
        ],
        xpReward: 50,
        unlockedTitleId: 'title-id',
        unlockedProfileColor: '#ff00aa',
        discordRoleId: '123456789',
        sortOrder: 1,
        updatedByUserId: null,
        createdAt: '2026-09-27T00:00:00.000Z',
        updatedAt: '2026-09-27T00:00:00.000Z',
      },
    ]),
    replaceLevels: vi.fn(async () => []),
    saveTitle: vi.fn(async () => undefined),
    saveAchievement: vi.fn(async (key: string) => ({
      id: 'achievement-id',
      key,
    })),
  } as unknown as CommunityProgressionDefinitionService;
  const discordRoles = {
    getDefinitions: vi.fn(async () => [
      {
        id: 'role-id',
        key: 'showcase.one-year',
        kind: 'showcase',
        name: 'One Year',
        color: '#ff00aa',
        enabled: true,
        discordRoleId: '987654321',
        provisionedByCommunity: true,
        achievementId: 'achievement-id',
        minimumLevel: null,
        maximumLevel: null,
        sortOrder: 1,
        updatedByUserId: null,
        createdAt: '2026-09-27T00:00:00.000Z',
        updatedAt: '2026-09-27T00:00:00.000Z',
      },
    ]),
    saveDefinition: vi.fn(async () => undefined),
  } as unknown as CommunityDiscordRoleDefinitionService;

  return { dataTransfer, eventRules, definitions, discordRoles };
}

function createProvider() {
  const services = createServices();
  return {
    provider: new CommunitySettingsDataTransferProvider(
      services.dataTransfer,
      services.eventRules,
      services.definitions,
      services.discordRoles,
    ),
    ...services,
  };
}

function validImport() {
  return {
    eventRules: [
      {
        eventType: 'discord.message.activity',
        enabled: true,
        xpAmount: 2,
        dailyRewardLimit: 10,
        contextRewardLimit: null,
        cooldownSeconds: 60,
        minimumContentLength: 20,
      },
    ],
    levels: [0, 100],
    titles: [
      {
        key: 'veteran',
        enabled: true,
        name: { de: 'Veteran', en: 'Veteran' },
        description: { de: 'Dabei.', en: 'Around.' },
      },
    ],
    achievements: [
      {
        key: 'one-year',
        enabled: true,
        name: { de: 'Ein Jahr', en: 'One year' },
        description: { de: 'Ein Jahr dabei.', en: 'One year around.' },
        conditionMode: 'all',
        conditions: [
          {
            metric: 'total-xp',
            operator: 'gte',
            threshold: 100,
            eventType: null,
          },
        ],
        xpReward: 50,
        unlockedTitleKey: 'veteran',
        unlockedProfileColor: '#ff00aa',
        sortOrder: 1,
      },
    ],
    discordRoles: [
      {
        key: 'showcase.one-year',
        kind: 'showcase',
        name: 'One Year',
        color: '#ff00aa',
        enabled: true,
        achievementKey: 'one-year',
        minimumLevel: null,
        maximumLevel: null,
        sortOrder: 1,
      },
    ],
  };
}

describe('CommunitySettingsDataTransferProvider', () => {
  it('registers itself as the community settings provider', () => {
    const { provider, dataTransfer } = createProvider();
    provider.onModuleInit();

    expect(dataTransfer.register).toHaveBeenCalledWith(provider);
    expect(provider.type).toBe('community-settings');
    expect(provider.schemaVersion).toBe(1);
  });

  it('exports stable keys instead of database identifiers', async () => {
    const { provider } = createProvider();

    await expect(provider.exportData()).resolves.toEqual(validImport());
  });

  it('rejects references to definitions that are not part of the import', async () => {
    const { provider } = createProvider();
    const data = validImport();
    data.titles = [];

    await expect(provider.validateImport(data)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reports retained definitions instead of deleting them', async () => {
    const { provider, definitions } = createProvider();
    vi.mocked(definitions.getTitles).mockResolvedValueOnce([
      ...(await definitions.getTitles()),
      {
        id: 'retained-title-id',
        key: 'retained',
        enabled: true,
        name: { de: 'Bleibt', en: 'Stays' },
        description: { de: '', en: null },
        updatedByUserId: null,
        createdAt: '2026-09-27T00:00:00.000Z',
        updatedAt: '2026-09-27T00:00:00.000Z',
      },
    ]);

    const preview = await provider.validateImport(validImport());

    expect(preview.summary.deleted).toBe(0);
    expect(preview.warnings).toContain(
      '1 existing community titles are not part of the import and will be kept.',
    );
  });

  it('imports changed settings through the existing domain services', async () => {
    const { provider, eventRules, definitions, discordRoles } = createProvider();
    const data = validImport();
    data.eventRules[0].xpAmount = 5;
    data.levels = [0, 200];
    data.titles[0].name.de = 'Veteranin';
    data.achievements[0].xpReward = 75;
    data.discordRoles[0].name = 'One Year Club';

    await provider.importData(data, { userUuid: 'admin-user' });

    expect(eventRules.saveRule).toHaveBeenCalledWith(
      'discord.message.activity',
      expect.objectContaining({ xpAmount: 5 }),
      'admin-user',
    );
    expect(definitions.replaceLevels).toHaveBeenCalledWith([0, 200], 'admin-user');
    expect(definitions.saveTitle).toHaveBeenCalledWith(
      'veteran',
      expect.objectContaining({ name: { de: 'Veteranin', en: 'Veteran' } }),
      'admin-user',
    );
    expect(definitions.saveAchievement).toHaveBeenCalledWith(
      'one-year',
      expect.objectContaining({
        badgeAssetId: 'badge-asset-id',
        unlockedTitleId: 'title-id',
        discordRoleId: '123456789',
        xpReward: 75,
      }),
      'admin-user',
    );
    expect(discordRoles.saveDefinition).toHaveBeenCalledWith(
      'showcase.one-year',
      expect.objectContaining({
        achievementId: 'achievement-id',
        name: 'One Year Club',
      }),
      'admin-user',
    );
  });
});
