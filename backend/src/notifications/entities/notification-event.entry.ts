import type {
  NotificationType,
} from '@shared/notifications/notifications';

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('notification_events')
export class NotificationEventEntry {
  @PrimaryColumn({
    type: 'varchar',
    length: 255,
  })
  key!: string;

  @Column({
    type: 'varchar',
    length: 80,
  })
  type!: NotificationType;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  context!:
    Record<string, unknown> | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt!: Date;
}
