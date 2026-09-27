import type {
  CommunityDiscordRoleKind,
} from '@shared/community/community-discord';

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('community_discord_roles')
@Index(
  'IDX_community_discord_roles_kind',
  ['kind'],
)
@Index(
  'IDX_community_discord_roles_achievement',
  ['achievementUuid'],
)
@Index(
  'UQ_community_discord_roles_discord_role',
  ['discordRoleId'],
  {
    unique: true,
    where: '"discordRoleId" IS NOT NULL',
  },
)
@Index(
  'UQ_community_discord_roles_showcase_achievement',
  ['achievementUuid'],
  {
    unique: true,
    where:
      `"kind" = 'showcase' AND "achievementUuid" IS NOT NULL`,
  },
)
export class CommunityDiscordRoleEntry {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({
    type: 'varchar',
    length: 120,
    unique: true,
  })
  key!: string;

  @Column({
    type: 'varchar',
    length: 20,
  })
  kind!: CommunityDiscordRoleKind;

  @Column({
    type: 'varchar',
    length: 100,
  })
  name!: string;

  @Column({
    type: 'varchar',
    length: 7,
    nullable: true,
  })
  color!: string | null;

  @Column({
    type: 'boolean',
    default: true,
  })
  enabled!: boolean;

  @Column({
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  discordRoleId!: string | null;

  @Column({
    type: 'boolean',
    default: false,
  })
  provisionedByCommunity!: boolean;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  achievementUuid!: string | null;

  @Column({
    type: 'integer',
    nullable: true,
  })
  minimumLevel!: number | null;

  @Column({
    type: 'integer',
    nullable: true,
  })
  maximumLevel!: number | null;

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
