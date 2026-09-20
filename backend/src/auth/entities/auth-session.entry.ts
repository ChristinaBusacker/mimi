import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('auth_sessions')
export class AuthSessionEntry {
  @PrimaryColumn({
    type: 'varchar',
    length: 64,
  })
  tokenHash!: string;

  @Column({
    type: 'uuid',
  })
  userUuid!: string;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;

  @Index()
  @Column({
    type: 'timestamptz',
  })
  expiresAt!: Date;
}
