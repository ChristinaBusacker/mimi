import type {
  NotificationLocale,
} from '@shared/notifications/notifications';

import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UserEntry } from '../../users/entities/user.entry';

@Entity('notification_preferences')
export class NotificationPreferenceEntry {
  @PrimaryColumn({
    type: 'uuid',
  })
  userUuid!: string;

  @OneToOne(() => UserEntry, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userUuid',
  })
  user!: UserEntry;

  @Column({
    type: 'boolean',
    default: false,
  })
  streams!: boolean;

  @Column({
    type: 'boolean',
    default: false,
  })
  music!: boolean;

  @Column({
    type: 'boolean',
    default: false,
  })
  blog!: boolean;

  @Column({
    type: 'boolean',
    default: false,
  })
  personal!: boolean;

  @Column({
    type: 'varchar',
    length: 5,
    default: 'de',
  })
  locale!: NotificationLocale;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt!: Date;
}
