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
import type {
  MailDeliveryStatus,
  MailType,
} from '../mail.types';

@Index(
  'IDX_mail_deliveries_status_created',
  ['status', 'createdAt'],
)
@Index(
  'IDX_mail_deliveries_user_created',
  ['userUuid', 'createdAt'],
  {
    where: '"userUuid" IS NOT NULL',
  },
)
@Entity('mail_deliveries')
export class MailDeliveryEntry {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  type!: MailType;

  @Column({
    type: 'varchar',
    length: 320,
  })
  recipient!: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  subject!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status!: MailDeliveryStatus;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  userUuid!: string | null;

  @ManyToOne(() => UserEntry, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'userUuid',
  })
  user!: UserEntry | null;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  context!: Record<string, string> | null;

  @Column({
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  providerMessageId!: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  errorMessage!: string | null;

  @Column({
    type: 'integer',
    default: 1,
  })
  attempts!: number;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  sentAt!: Date | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  failedAt!: Date | null;
}
