import type {
  CommunityEventType,
} from '@shared/community/community-event';
import type {
  CommunityAchievementMetric,
  CommunityAchievementOperator,
} from '@shared/community/community-progression';

import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('community_achievement_conditions')
@Index(
  'IDX_community_achievement_conditions_achievement',
  ['achievementUuid', 'sortOrder'],
)
export class CommunityAchievementConditionEntry {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({
    type: 'uuid',
  })
  achievementUuid!: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  metric!: CommunityAchievementMetric;

  @Column({
    type: 'varchar',
    length: 10,
  })
  operator!: CommunityAchievementOperator;

  @Column({
    type: 'integer',
  })
  threshold!: number;

  @Column({
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  eventType!: CommunityEventType | null;

  @Column({
    type: 'integer',
    default: 0,
  })
  sortOrder!: number;
}
