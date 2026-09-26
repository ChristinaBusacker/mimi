import type {
  CommunityEventType,
} from '@shared/community/community-event';

import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { UserEntry } from '../../users/entities/user.entry';
import { CommunityEventEntry } from './community-event.entry';

@Entity('xp_transactions')
@Check(
  'CHK_xp_transactions_amount',
  '"amount" > 0',
)
@Index(
  'IDX_xp_transactions_user_type_day',
  [
    'userUuid',
    'eventType',
    'rewardDate',
  ],
)
@Index(
  'IDX_xp_transactions_user_type_context',
  [
    'userUuid',
    'eventType',
    'contextId',
  ],
)
@Index(
  'IDX_xp_transactions_user_type_occurred',
  [
    'userUuid',
    'eventType',
    'occurredAt',
  ],
)
export class XpTransactionEntry {
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
    type: 'uuid',
    unique: true,
  })
  eventUuid!: string;

  @OneToOne(
    () => CommunityEventEntry,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'eventUuid',
  })
  event!: CommunityEventEntry;

  @Column({
    type: 'varchar',
    length: 80,
  })
  eventType!: CommunityEventType;

  @Column({
    type: 'integer',
  })
  amount!: number;

  @Column({
    type: 'date',
  })
  rewardDate!: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  contextId!: string | null;

  @Column({
    type: 'timestamptz',
  })
  occurredAt!: Date;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;
}
