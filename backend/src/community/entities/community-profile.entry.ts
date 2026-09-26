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

@Entity('community_profiles')
export class CommunityProfileEntry {
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
    length: 255,
  })
  discordDisplayName!: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  discordAvatarHash!: string | null;

  @Column({
    type: 'boolean',
    default: false,
  })
  isDiscordMember!: boolean;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  firstKnownDiscordJoinAt!: Date | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  currentDiscordJoinAt!: Date | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt!: Date;
}
