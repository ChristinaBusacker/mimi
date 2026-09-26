import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('community_levels')
export class CommunityLevelEntry {
  @PrimaryColumn({
    type: 'integer',
  })
  level!: number;

  @Column({
    type: 'boolean',
    default: true,
  })
  enabled!: boolean;

  @Column({
    type: 'integer',
    unique: true,
  })
  requiredXp!: number;

  @Column({
    type: 'varchar',
    length: 160,
  })
  nameDe!: string;

  @Column({
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  nameEn!: string | null;

  @Column({
    type: 'varchar',
    length: 7,
    nullable: true,
  })
  displayColor!: string | null;

  @Column({
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  discordRoleId!: string | null;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  badgeAssetId!: string | null;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  updatedByUserId!: string | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt!: Date;
}
