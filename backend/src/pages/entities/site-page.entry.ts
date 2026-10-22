import type { PageDocument } from '@shared/content/page-document';
import type { SitePageKind, SitePageMetadata } from '@shared/content/site-page';
import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('site_pages')
export class SitePageEntry {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  /** Immutable logical identifier, independent of database UUIDs. */
  @Column({ type: 'varchar', length: 200, unique: true })
  key!: string;

  /** Immutable public path segment. Changing slugs requires a later redirect workflow. */
  @Column({ type: 'varchar', length: 160, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 20 })
  kind!: SitePageKind;

  @Column({ type: 'jsonb' })
  draftMetadata!: SitePageMetadata;

  @Column({ type: 'jsonb', nullable: true })
  publishedMetadata!: SitePageMetadata | null;

  @Column({ type: 'jsonb', nullable: true })
  draft!: PageDocument | null;

  @Column({ type: 'jsonb', nullable: true })
  published!: PageDocument | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
