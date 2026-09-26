import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { UserEntry } from '../../users/entities/user.entry';

@Entity('discord_membership_periods')
@Check(
  'CHK_discord_membership_periods_dates',
  '"leftAt" IS NULL OR "leftAt" >= "joinedAt"',
)
@Index(
  'IDX_discord_membership_periods_user_joined',
  ['userUuid', 'joinedAt'],
)
@Index(
  'UQ_discord_membership_periods_open',
  ['userUuid'],
  {
    unique: true,
    where: '"leftAt" IS NULL',
  },
)
export class DiscordMembershipPeriodEntry {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({
    type: 'uuid',
  })
  userUuid!: string;

  @ManyToOne(() => UserEntry, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userUuid',
  })
  user!: UserEntry;

  @Column({
    type: 'timestamptz',
  })
  joinedAt!: Date;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  leftAt!: Date | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;
}
