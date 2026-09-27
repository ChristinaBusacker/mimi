import {
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('community_discord_assigned_roles')
@Index(
  'IDX_community_discord_assigned_roles_role',
  ['roleId'],
)
export class CommunityDiscordAssignedRoleEntry {
  @PrimaryColumn({
    type: 'uuid',
  })
  userUuid!: string;

  @PrimaryColumn({
    type: 'varchar',
    length: 32,
  })
  roleId!: string;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  assignedAt!: Date;
}
