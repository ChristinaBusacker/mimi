import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UserEntry } from '../../users/entities/user.entry';

@Entity('push_subscriptions')
@Index(
  'IDX_push_subscriptions_user',
  ['userUuid'],
)
@Index(
  'UQ_push_subscriptions_endpoint',
  ['endpoint'],
  {
    unique: true,
  },
)
export class PushSubscriptionEntry {
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
    length: 2048,
  })
  endpoint!: string;

  @Column({
    type: 'varchar',
    length: 512,
  })
  p256dh!: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  auth!: string;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  expiresAt!: Date | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt!: Date;
}
