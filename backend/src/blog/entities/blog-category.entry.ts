import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { BlogCategoryTranslationEntry } from './blog-category-translation.entry';

@Entity('blog_categories')
export class BlogCategoryEntry {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({
    unique: true,
    length: 160,
  })
  slug!: string;

  @OneToMany(
    () =>
      BlogCategoryTranslationEntry,
    (translation) =>
      translation.category,
  )
  translations!:
    BlogCategoryTranslationEntry[];
}
