import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('community_twitch_link_states')
@Index(
  'IDX_community_twitch_link_states_user',
  ['userUuid'],
)
@Index(
  'IDX_community_twitch_link_states_expires',
  ['expiresAt'],
)
export class CommunityTwitchLinkStateEntry {
  @PrimaryColumn({
    type: 'varchar',
    length: 64,
  })
  stateHash!: string;

  @Column({
    type: 'uuid',
  })
  userUuid!: string;

  @Column({
    type: 'timestamptz',
  })
  expiresAt!: Date;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;
}
