import type {
  CommunityEventRule,
  CommunityEventType,
  SaveCommunityEventRule,
} from '@shared/community/community-event';

import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  COMMUNITY_EVENT_TYPES,
  isCommunityEventType,
  supportsContentLength,
} from './community-event-type';
import { CommunityEventRuleEntry } from './entities/community-event-rule.entry';

@Injectable()
export class CommunityEventRuleService {
  constructor(
    @InjectRepository(
      CommunityEventRuleEntry,
    )
    private readonly rules:
      Repository<CommunityEventRuleEntry>,
  ) {}

  getKnownEventTypes():
    readonly CommunityEventType[] {
    return COMMUNITY_EVENT_TYPES;
  }

  async getRules():
    Promise<CommunityEventRule[]> {
    const rules = await this.rules.find({
      order: {
        eventType: 'ASC',
      },
    });

    return rules.map((rule) =>
      this.mapRule(rule),
    );
  }

  async saveRule(
    eventType: string,
    input: SaveCommunityEventRule,
    updatedByUserId: string | null,
  ): Promise<CommunityEventRule> {
    if (
      !isCommunityEventType(
        eventType,
      )
    ) {
      throw new BadRequestException(
        `Unknown community event type "${eventType}".`,
      );
    }

    this.validateRule(
      eventType,
      input,
    );

    const existing =
      await this.rules.findOneBy({
        eventType,
      });
    const saved =
      await this.rules.save(
        existing
          ? {
              ...existing,
              ...input,
              updatedByUserId,
            }
          : this.rules.create({
              eventType,
              ...input,
              updatedByUserId,
            }),
      );

    return this.mapRule(saved);
  }

  private validateRule(
    eventType: CommunityEventType,
    input: SaveCommunityEventRule,
  ): void {
    this.assertInteger(
      input.xpAmount,
      'xpAmount',
      0,
    );
    this.assertOptionalInteger(
      input.dailyRewardLimit,
      'dailyRewardLimit',
      1,
    );
    this.assertOptionalInteger(
      input.contextRewardLimit,
      'contextRewardLimit',
      1,
    );
    this.assertOptionalInteger(
      input.cooldownSeconds,
      'cooldownSeconds',
      0,
    );
    this.assertOptionalInteger(
      input.minimumContentLength,
      'minimumContentLength',
      0,
    );

    if (
      input.minimumContentLength !==
        null &&
      !supportsContentLength(
        eventType,
      )
    ) {
      throw new BadRequestException(
        `Event type "${eventType}" does not support content-length qualification.`,
      );
    }
  }

  private assertOptionalInteger(
    value: number | null,
    field: string,
    minimum: number,
  ): void {
    if (value === null) {
      return;
    }

    this.assertInteger(
      value,
      field,
      minimum,
    );
  }

  private assertInteger(
    value: number,
    field: string,
    minimum: number,
  ): void {
    if (
      !Number.isSafeInteger(value) ||
      value < minimum
    ) {
      throw new BadRequestException(
        `${field} must be an integer greater than or equal to ${minimum}.`,
      );
    }
  }

  private mapRule(
    rule: CommunityEventRuleEntry,
  ): CommunityEventRule {
    return {
      eventType: rule.eventType,
      enabled: rule.enabled,
      xpAmount: rule.xpAmount,
      dailyRewardLimit:
        rule.dailyRewardLimit,
      contextRewardLimit:
        rule.contextRewardLimit,
      cooldownSeconds:
        rule.cooldownSeconds,
      minimumContentLength:
        rule.minimumContentLength,
      updatedByUserId:
        rule.updatedByUserId,
      createdAt:
        rule.createdAt.toISOString(),
      updatedAt:
        rule.updatedAt.toISOString(),
    };
  }
}
