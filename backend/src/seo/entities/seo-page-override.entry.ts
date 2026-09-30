import type {
  SeoLocale,
  SeoStaticPageKey,
} from '@shared/seo/seo';

import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { AssetEntry } from '../../assets/entities/asset.entry';

@Entity('seo_page_overrides')
export class SeoPageOverrideEntry {
  @PrimaryColumn({
    type: 'varchar',
    length: 50,
  })
  pageKey!: SeoStaticPageKey;

  @PrimaryColumn({
    type: 'varchar',
    length: 5,
  })
  locale!: SeoLocale;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  title!: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  description!: string | null;

  @Column({
    name: 'socialImageAssetId',
    type: 'uuid',
    nullable: true,
  })
  imageAssetId!: string | null;

  @ManyToOne(() => AssetEntry, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'socialImageAssetId',
  })
  imageAsset!: AssetEntry | null;
}
