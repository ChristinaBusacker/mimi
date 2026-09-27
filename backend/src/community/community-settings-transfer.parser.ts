import type { CommunityDiscordRoleKind } from '@shared/community/community-discord';
import type { CommunityEventType } from '@shared/community/community-event';
import type {
  CommunityAchievementOperator,
  CommunityLocalizedText,
} from '@shared/community/community-progression';
import type {
  CommunityAchievementConditionTransferEntry,
  CommunityAchievementTransferEntry,
  CommunityDiscordRoleTransferEntry,
  CommunityEventRuleTransferEntry,
  CommunitySettingsTransferData,
  CommunityTitleTransferEntry,
} from '@shared/community/community-settings-transfer';
import { BadRequestException } from '@nestjs/common';

import {
  achievementMetricRequiresEventType,
  isCommunityAchievementMetric,
} from './community-achievement-metric';
import {
  isRewardRuleEventType,
  supportsContentLength,
} from './community-event-type';

const DEFINITION_KEY_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export function parseCommunitySettingsTransferData(data: unknown): CommunitySettingsTransferData {
  if (!isRecord(data)) {
    throw new BadRequestException('Community settings import data must be an object.');
  }

  const eventRules = requireArray(data, 'eventRules').map(parseEventRule);
  const levels = requireArray(data, 'levels').map(parseLevel);
  const titles = requireArray(data, 'titles').map(parseTitle);
  const achievements = requireArray(data, 'achievements').map(parseAchievement);
  const discordRoles = requireArray(data, 'discordRoles').map(parseDiscordRole);

  assertUnique(eventRules, (entry) => entry.eventType, 'event rule');
  validateLevels(levels);
  assertUnique(titles, (entry) => entry.key, 'title');
  assertUnique(achievements, (entry) => entry.key, 'achievement');
  assertUnique(discordRoles, (entry) => entry.key, 'Discord role');

  const titleKeys = new Set(titles.map((title) => title.key));
  const achievementKeys = new Set(achievements.map((achievement) => achievement.key));

  for (const achievement of achievements) {
    if (
      achievement.unlockedTitleKey !== null &&
      !titleKeys.has(achievement.unlockedTitleKey)
    ) {
      throw new BadRequestException(
        `Community achievement "${achievement.key}" references title "${achievement.unlockedTitleKey}", which is not part of the import.`,
      );
    }
  }

  for (const role of discordRoles) {
    if (role.achievementKey !== null && !achievementKeys.has(role.achievementKey)) {
      throw new BadRequestException(
        `Community Discord role "${role.key}" references achievement "${role.achievementKey}", which is not part of the import.`,
      );
    }
  }

  validateImportedRoles(discordRoles);

  return { eventRules, levels, titles, achievements, discordRoles };
}

function parseEventRule(value: unknown, index: number): CommunityEventRuleTransferEntry {
  const label = `Community event rule ${index}`;
  const entry = requireRecord(value, label);
  const eventType = requireString(entry, 'eventType', label);

  if (!isRewardRuleEventType(eventType)) {
    throw new BadRequestException(`${label} has an unsupported event type "${eventType}".`);
  }

  const minimumContentLength = readNullableInteger(
    entry,
    'minimumContentLength',
    0,
    `Community event rule "${eventType}"`,
  );

  if (minimumContentLength !== null && !supportsContentLength(eventType)) {
    throw new BadRequestException(
      `Community event rule "${eventType}" does not support minimumContentLength.`,
    );
  }

  return {
    eventType,
    enabled: requireBoolean(entry, 'enabled', label),
    xpAmount: requireInteger(entry, 'xpAmount', 0, label),
    dailyRewardLimit: readNullableInteger(entry, 'dailyRewardLimit', 1, label),
    contextRewardLimit: readNullableInteger(entry, 'contextRewardLimit', 1, label),
    cooldownSeconds: readNullableInteger(entry, 'cooldownSeconds', 0, label),
    minimumContentLength,
  };
}

function parseLevel(value: unknown, index: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new BadRequestException(
      `Community level ${index + 1} must contain a non-negative integer XP threshold.`,
    );
  }

  return value as number;
}

function validateLevels(levels: number[]): void {
  if (levels.length === 0) {
    throw new BadRequestException('Community settings need at least one level.');
  }

  if (levels[0] !== 0) {
    throw new BadRequestException('Community level 1 must start at 0 XP.');
  }

  for (let index = 1; index < levels.length; index += 1) {
    if (levels[index] <= levels[index - 1]) {
      throw new BadRequestException('Community level XP thresholds must increase strictly.');
    }
  }
}

function parseTitle(value: unknown, index: number): CommunityTitleTransferEntry {
  const label = `Community title ${index}`;
  const entry = requireRecord(value, label);
  const key = readDefinitionKey(entry, 'key', 80, label);

  return {
    key,
    enabled: requireBoolean(entry, 'enabled', label),
    name: readLocalizedText(entry['name'], `Community title "${key}" name`, true),
    description: readLocalizedText(
      entry['description'],
      `Community title "${key}" description`,
      false,
    ),
  };
}

function parseAchievement(value: unknown, index: number): CommunityAchievementTransferEntry {
  const label = `Community achievement ${index}`;
  const entry = requireRecord(value, label);
  const key = readDefinitionKey(entry, 'key', 80, label);
  const conditionMode = entry['conditionMode'];

  if (conditionMode !== 'all' && conditionMode !== 'any') {
    throw new BadRequestException(
      `Community achievement "${key}" has an invalid conditionMode.`,
    );
  }

  const conditions = requireArray(entry, 'conditions').map((condition, conditionIndex) =>
    parseAchievementCondition(condition, key, conditionIndex),
  );

  if (conditions.length === 0) {
    throw new BadRequestException(
      `Community achievement "${key}" needs at least one condition.`,
    );
  }

  return {
    key,
    enabled: requireBoolean(entry, 'enabled', label),
    name: readLocalizedText(entry['name'], `Community achievement "${key}" name`, true),
    description: readLocalizedText(
      entry['description'],
      `Community achievement "${key}" description`,
      false,
    ),
    conditionMode,
    conditions,
    xpReward: requireInteger(entry, 'xpReward', 0, label),
    unlockedTitleKey: readNullableDefinitionKey(entry, 'unlockedTitleKey', 80, label),
    unlockedProfileColor: readNullableColor(entry, 'unlockedProfileColor', label),
    sortOrder: requireInteger(entry, 'sortOrder', Number.MIN_SAFE_INTEGER, label),
  };
}

function parseAchievementCondition(
  value: unknown,
  achievementKey: string,
  index: number,
): CommunityAchievementConditionTransferEntry {
  const label = `Community achievement "${achievementKey}" condition ${index}`;
  const entry = requireRecord(value, label);
  const metric = requireString(entry, 'metric', label);

  if (!isCommunityAchievementMetric(metric)) {
    throw new BadRequestException(`${label} has an unknown metric "${metric}".`);
  }

  if (entry['operator'] !== 'gte') {
    throw new BadRequestException(`${label} has an unsupported operator.`);
  }

  const eventTypeValue = entry['eventType'];
  const requiresEventType = achievementMetricRequiresEventType(metric);
  let eventType: CommunityEventType | null;

  if (requiresEventType) {
    if (typeof eventTypeValue !== 'string' || !isRewardRuleEventType(eventTypeValue)) {
      throw new BadRequestException(
        `${label} needs a configurable eventType for metric "${metric}".`,
      );
    }
    eventType = eventTypeValue;
  } else {
    if (eventTypeValue !== null) {
      throw new BadRequestException(
        `${label} does not accept an eventType for metric "${metric}".`,
      );
    }
    eventType = null;
  }

  return {
    metric,
    operator: 'gte' as CommunityAchievementOperator,
    threshold: requireInteger(entry, 'threshold', 1, label),
    eventType,
  };
}

function parseDiscordRole(value: unknown, index: number): CommunityDiscordRoleTransferEntry {
  const label = `Community Discord role ${index}`;
  const entry = requireRecord(value, label);
  const key = readDefinitionKey(entry, 'key', 120, label);
  const kind = entry['kind'];

  if (!isRoleKind(kind)) {
    throw new BadRequestException(`Community Discord role "${key}" has an invalid kind.`);
  }

  const name = requireString(entry, 'name', label).trim();
  if (name.length === 0 || name.length > 100) {
    throw new BadRequestException(
      `Community Discord role "${key}" name must contain between 1 and 100 characters.`,
    );
  }

  const role: CommunityDiscordRoleTransferEntry = {
    key,
    kind,
    name,
    color: readNullableColor(entry, 'color', label),
    enabled: requireBoolean(entry, 'enabled', label),
    achievementKey: readNullableDefinitionKey(entry, 'achievementKey', 80, label),
    minimumLevel: readNullableInteger(entry, 'minimumLevel', 1, label),
    maximumLevel: readNullableInteger(entry, 'maximumLevel', 1, label),
    sortOrder: requireInteger(entry, 'sortOrder', Number.MIN_SAFE_INTEGER, label),
  };

  validateRoleShape(role);
  return role;
}

function validateRoleShape(role: CommunityDiscordRoleTransferEntry): void {
  if (role.kind === 'level-range') {
    if (
      role.achievementKey !== null ||
      role.minimumLevel === null ||
      (role.maximumLevel !== null && role.maximumLevel < role.minimumLevel)
    ) {
      throw new BadRequestException(
        `Community Discord level role "${role.key}" has an invalid range or achievement reference.`,
      );
    }
    return;
  }

  if (role.kind === 'showcase') {
    if (
      role.achievementKey === null ||
      role.minimumLevel !== null ||
      role.maximumLevel !== null
    ) {
      throw new BadRequestException(
        `Community Discord showcase role "${role.key}" must reference exactly one achievement and no level range.`,
      );
    }
    return;
  }

  if (
    role.achievementKey !== null ||
    role.minimumLevel !== null ||
    role.maximumLevel !== null
  ) {
    throw new BadRequestException(
      `Community Discord special role "${role.key}" cannot reference an achievement or level range.`,
    );
  }
}

function validateImportedRoles(roles: CommunityDiscordRoleTransferEntry[]): void {
  const showcases = new Map<string, string>();
  const levelRoles = roles.filter((role) => role.enabled && role.kind === 'level-range');

  for (const role of roles) {
    if (role.kind !== 'showcase' || role.achievementKey === null) continue;

    const existing = showcases.get(role.achievementKey);
    if (existing) {
      throw new BadRequestException(
        `Community Discord showcase roles "${existing}" and "${role.key}" reference the same achievement "${role.achievementKey}".`,
      );
    }
    showcases.set(role.achievementKey, role.key);
  }

  for (let index = 0; index < levelRoles.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < levelRoles.length; otherIndex += 1) {
      if (rangesOverlap(levelRoles[index], levelRoles[otherIndex])) {
        throw new BadRequestException(
          `Community Discord level roles "${levelRoles[index].key}" and "${levelRoles[otherIndex].key}" overlap.`,
        );
      }
    }
  }
}

export function communityDiscordRoleRangesOverlap(
  left: CommunityDiscordRoleTransferEntry,
  right: CommunityDiscordRoleTransferEntry,
): boolean {
  return rangesOverlap(left, right);
}

function rangesOverlap(
  left: CommunityDiscordRoleTransferEntry,
  right: CommunityDiscordRoleTransferEntry,
): boolean {
  const leftMaximum = left.maximumLevel ?? Number.POSITIVE_INFINITY;
  const rightMaximum = right.maximumLevel ?? Number.POSITIVE_INFINITY;
  return left.minimumLevel! <= rightMaximum && right.minimumLevel! <= leftMaximum;
}

function requireArray(record: Record<string, unknown>, field: string): unknown[] {
  const value = record[field];
  if (!Array.isArray(value)) {
    throw new BadRequestException(`Community settings field "${field}" must be an array.`);
  }
  return value;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new BadRequestException(`${label} must be an object.`);
  return value;
}

function requireString(record: Record<string, unknown>, field: string, label: string): string {
  const value = record[field];
  if (typeof value !== 'string') {
    throw new BadRequestException(`${label} field "${field}" must be a string.`);
  }
  return value;
}

function requireBoolean(record: Record<string, unknown>, field: string, label: string): boolean {
  const value = record[field];
  if (typeof value !== 'boolean') {
    throw new BadRequestException(`${label} field "${field}" must be a boolean.`);
  }
  return value;
}

function requireInteger(
  record: Record<string, unknown>,
  field: string,
  minimum: number,
  label: string,
): number {
  const value = record[field];
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new BadRequestException(
      `${label} field "${field}" must be an integer greater than or equal to ${minimum}.`,
    );
  }
  return value as number;
}

function readNullableInteger(
  record: Record<string, unknown>,
  field: string,
  minimum: number,
  label: string,
): number | null {
  return record[field] === null ? null : requireInteger(record, field, minimum, label);
}

function readDefinitionKey(
  record: Record<string, unknown>,
  field: string,
  maximumLength: number,
  label: string,
): string {
  const normalized = requireString(record, field, label).trim().toLowerCase();
  if (
    normalized.length === 0 ||
    normalized.length > maximumLength ||
    !DEFINITION_KEY_PATTERN.test(normalized)
  ) {
    throw new BadRequestException(
      `${label} field "${field}" must use lowercase letters, numbers, dots or hyphens.`,
    );
  }
  return normalized;
}

function readNullableDefinitionKey(
  record: Record<string, unknown>,
  field: string,
  maximumLength: number,
  label: string,
): string | null {
  return record[field] === null
    ? null
    : readDefinitionKey(record, field, maximumLength, label);
}

function readLocalizedText(
  value: unknown,
  label: string,
  requireGermanName: boolean,
): CommunityLocalizedText {
  const record = requireRecord(value, label);
  const deValue = record['de'];
  const enValue = record['en'];

  if (typeof deValue !== 'string') {
    throw new BadRequestException(`${label} needs a German string.`);
  }
  if (enValue !== null && typeof enValue !== 'string') {
    throw new BadRequestException(`${label} English value must be a string or null.`);
  }

  const de = deValue.trim();
  const en = typeof enValue === 'string' ? enValue.trim() || null : null;

  if (requireGermanName && (de.length === 0 || de.length > 160)) {
    throw new BadRequestException(
      `${label} German value must contain between 1 and 160 characters.`,
    );
  }
  if (requireGermanName && en !== null && en.length > 160) {
    throw new BadRequestException(`${label} English value must not exceed 160 characters.`);
  }

  return { de, en };
}

function readNullableColor(
  record: Record<string, unknown>,
  field: string,
  label: string,
): string | null {
  const value = record[field];
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new BadRequestException(`${label} field "${field}" must be a string or null.`);
  }

  const normalized = value.trim();
  if (!HEX_COLOR_PATTERN.test(normalized)) {
    throw new BadRequestException(
      `${label} field "${field}" must be a hex color like #7c5cff.`,
    );
  }
  return normalized.toLowerCase();
}

function assertUnique<T>(
  entries: T[],
  keyOf: (entry: T) => string,
  label: string,
): void {
  const keys = new Set<string>();
  for (const entry of entries) {
    const key = keyOf(entry);
    if (keys.has(key)) {
      throw new BadRequestException(
        `Community settings import contains duplicate ${label} "${key}".`,
      );
    }
    keys.add(key);
  }
}

function isRoleKind(value: unknown): value is CommunityDiscordRoleKind {
  return value === 'level-range' || value === 'showcase' || value === 'special';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
