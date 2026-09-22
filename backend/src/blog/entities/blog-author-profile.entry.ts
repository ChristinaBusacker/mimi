import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { AssetEntry } from '../../assets/entities/asset.entry';
import { UserEntry } from '../../users/entities/user.entry';

@Entity('blog_author_profiles')
export class BlogAuthorProfileEntry {
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
    unique: true,
    length: 160,
  })
  slug!: string;

  @Column({
    length: 255,
  })
  displayName!: string;

  @Column({
    type: 'text',
    default: '',
  })
  bio!: string;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  avatarAssetId!: string | null;

  @ManyToOne(() => AssetEntry, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'avatarAssetId',
  })
  avatarAsset!: AssetEntry | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt!: Date;
}
