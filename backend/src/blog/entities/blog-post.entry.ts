import type { BlogPublicationStatus } from '@shared/blog/blog';

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

import { AssetEntry } from '../../assets/entities/asset.entry';
import { UserEntry } from '../../users/entities/user.entry';

@Index(
  'IDX_blog_posts_publication',
  ['status', 'publishedAt'],
)
@Index(
  'IDX_blog_posts_author',
  ['authorUuid'],
)
@Entity('blog_posts')
export class BlogPostEntry {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({
    unique: true,
    length: 160,
  })
  slug!: string;

  @Column({
    type: 'uuid',
  })
  authorUuid!: string;

  @ManyToOne(() => UserEntry, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'authorUuid',
  })
  author!: UserEntry;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  coverAssetId!: string | null;

  @ManyToOne(() => AssetEntry, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'coverAssetId',
  })
  coverAsset!: AssetEntry | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'draft',
  })
  status!: BlogPublicationStatus;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  publishedAt!: Date | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt!: Date;
}
