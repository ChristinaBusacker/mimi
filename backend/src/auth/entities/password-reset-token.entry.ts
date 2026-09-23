import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { UserEntry } from '../../users/entities/user.entry';

@Index(
  'IDX_password_reset_tokens_user_created',
  ['userUuid', 'createdAt'],
)
@Index(
  'IDX_password_reset_tokens_expires',
  ['expiresAt'],
)
@Entity('password_reset_tokens')
export class PasswordResetTokenEntry {
  @PrimaryColumn({
    type: 'varchar',
    length: 64,
  })
  tokenHash!: string;

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

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;

  @Column({
    type: 'timestamptz',
  })
  expiresAt!: Date;
}
