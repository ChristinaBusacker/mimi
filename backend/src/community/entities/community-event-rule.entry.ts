import type {
  CommunityEventType,
} from '@shared/community/community-event';

import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UserEntry } from '../../users/entities/user.entry';

@Entity('community_event_rules')
@Check(
  'CHK_community_event_rules_xp',
  '"xpAmount" >= 0',
)
@Check(
  'CHK_community_event_rules_daily_limit',
  '"dailyRewardLimit" IS NULL OR "dailyRewardLimit" > 0',
)
@Check(
  'CHK_community_event_rules_context_limit',
  '"contextRewardLimit" IS NULL OR "contextRewardLimit" > 0',
)
@Check(
  'CHK_community_event_rules_cooldown',
  '"cooldownSeconds" IS NULL OR "cooldownSeconds" >= 0',
)
@Check(
  'CHK_community_event_rules_content_length',
  '"minimumContentLength" IS NULL OR "minimumContentLength" >= 0',
)
export class CommunityEventRuleEntry {
  @PrimaryColumn({
    type: 'varchar',
    length: 80,
  })
  eventType!: CommunityEventType;

  @Column({
    type: 'boolean',
    default: false,
  })
  enabled!: boolean;

  @Column({
    type: 'integer',
    default: 0,
  })
  xpAmount!: number;

  @Column({
    type: 'integer',
    nullable: true,
  })
  dailyRewardLimit!: number | null;

  @Column({
    type: 'integer',
    nullable: true,
  })
  contextRewardLimit!: number | null;

  @Column({
    type: 'integer',
    nullable: true,
  })
  cooldownSeconds!: number | null;

  @Column({
    type: 'integer',
    nullable: true,
  })
  minimumContentLength!: number | null;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  updatedByUserId!: string | null;

  @ManyToOne(() => UserEntry, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'updatedByUserId',
  })
  updatedByUser!: UserEntry | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt!: Date;
}
