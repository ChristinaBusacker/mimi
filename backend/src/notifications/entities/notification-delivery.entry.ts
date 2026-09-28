import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { UserEntry } from '../../users/entities/user.entry';
import { NotificationEventEntry } from './notification-event.entry';

export type NotificationDeliveryStatus =
  | 'pending'
  | 'completed';

@Entity('notification_deliveries')
@Unique(
  'UQ_notification_deliveries_event_user',
  [
    'eventKey',
    'userUuid',
  ],
)
@Index(
  'IDX_notification_deliveries_user',
  ['userUuid'],
)
@Index(
  'IDX_notification_deliveries_event_status',
  [
    'eventKey',
    'status',
  ],
)
export class NotificationDeliveryEntry {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  eventKey!: string;

  @ManyToOne(
    () => NotificationEventEntry,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'eventKey',
  })
  event!: NotificationEventEntry;

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
    length: 20,
    default: 'pending',
  })
  status!: NotificationDeliveryStatus;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  deliveredAt!: Date | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt!: Date;
}
