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
import { BlogPostEntry } from './blog-post.entry';

@Entity('blog_comments')
@Index(
  'IDX_blog_comments_post_created',
  ['postUuid', 'createdAt'],
)
@Index(
  'IDX_blog_comments_user',
  ['userUuid'],
)
export class BlogCommentEntry {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({
    type: 'uuid',
  })
  postUuid!: string;

  @ManyToOne(
    () => BlogPostEntry,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'postUuid',
  })
  post!: BlogPostEntry;

  @Column({
    type: 'uuid',
  })
  userUuid!: string;

  @ManyToOne(
    () => UserEntry,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'userUuid',
  })
  user!: UserEntry;

  @Column({
    type: 'text',
  })
  content!: string;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt!: Date;
}
