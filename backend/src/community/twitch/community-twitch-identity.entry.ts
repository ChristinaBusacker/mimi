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

@Entity('community_twitch_identities')
export class CommunityTwitchIdentityEntry {
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
    type: 'varchar',
    length: 64,
    unique: true,
  })
  twitchUserId!: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  login!: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  displayName!: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  profileImageUrl!: string | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  linkedAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt!: Date;
}
