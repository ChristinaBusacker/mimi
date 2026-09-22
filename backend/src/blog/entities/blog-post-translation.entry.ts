import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { BlogLocale } from '../blog-locale';
import { BlogPostEntry } from './blog-post.entry';

@Index(
  ['postUuid', 'locale'],
  {
    unique: true,
  },
)
@Entity('blog_post_translations')
export class BlogPostTranslationEntry {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({
    type: 'uuid',
  })
  postUuid!: string;

  @ManyToOne(() => BlogPostEntry, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'postUuid',
  })
  post!: BlogPostEntry;

  @Column({
    type: 'varchar',
    length: 5,
  })
  locale!: BlogLocale;

  @Column({
    length: 255,
  })
  title!: string;

  @Column({
    type: 'text',
    default: '',
  })
  excerpt!: string;

  @Column({
    type: 'text',
    default: '',
  })
  contentMarkdown!: string;
}
