import type {
  CommunityEventSource,
  CommunityEventType,
} from '@shared/community/community-event';

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { UserEntry } from '../../users/entities/user.entry';

@Entity('community_events')
@Index(
  'IDX_community_events_user_type_occurred',
  [
    'userUuid',
    'type',
    'occurredAt',
  ],
)
@Index(
  'IDX_community_events_type_occurred',
  [
    'type',
    'occurredAt',
  ],
)
@Index(
  'UQ_community_events_source_event',
  [
    'source',
    'sourceEventId',
  ],
  {
    unique: true,
    where:
      '"sourceEventId" IS NOT NULL',
  },
)
export class CommunityEventEntry {
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
    type: 'varchar',
    length: 80,
  })
  type!: CommunityEventType;

  @Column({
    type: 'varchar',
    length: 20,
  })
  source!: CommunityEventSource;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  sourceEventId!: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  contextId!: string | null;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  metadata!: Record<
    string,
    unknown
  > | null;

  @Column({
    type: 'timestamptz',
  })
  occurredAt!: Date;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;
}
