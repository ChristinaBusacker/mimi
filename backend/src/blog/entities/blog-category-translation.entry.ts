import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { BlogLocale } from '../blog-locale';
import { BlogCategoryEntry } from './blog-category.entry';

@Index(
  ['categoryUuid', 'locale'],
  {
    unique: true,
  },
)
@Entity('blog_category_translations')
export class BlogCategoryTranslationEntry {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({
    type: 'uuid',
  })
  categoryUuid!: string;

  @ManyToOne(
    () => BlogCategoryEntry,
    (category) =>
      category.translations,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'categoryUuid',
  })
  category!: BlogCategoryEntry;

  @Column({
    type: 'varchar',
    length: 5,
  })
  locale!: BlogLocale;

  @Column({
    length: 160,
  })
  name!: string;
}
