import type {
  CommunityAchievementConditionMode,
} from '@shared/community/community-progression';

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('community_achievements')
export class CommunityAchievementEntry {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({
    type: 'varchar',
    length: 80,
    unique: true,
  })
  key!: string;

  @Column({
    type: 'boolean',
    default: true,
  })
  enabled!: boolean;

  @Column({
    type: 'varchar',
    length: 160,
  })
  nameDe!: string;

  @Column({
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  nameEn!: string | null;

  @Column({
    type: 'text',
    default: '',
  })
  descriptionDe!: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  descriptionEn!: string | null;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  badgeAssetId!: string | null;

  @Column({
    type: 'varchar',
    length: 10,
  })
  conditionMode!:
    CommunityAchievementConditionMode;

  @Column({
    type: 'integer',
    default: 0,
  })
  xpReward!: number;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  unlockedTitleUuid!: string | null;

  @Column({
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  discordRoleId!: string | null;

  @Column({
    type: 'integer',
    default: 0,
  })
  sortOrder!: number;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  updatedByUserId!: string | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt!: Date;
}
