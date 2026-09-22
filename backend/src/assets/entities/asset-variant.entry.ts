import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import type {
  AssetImageVariantFormat,
  AssetImageVariantName,
} from '../asset-image-variant';
import { AssetEntry } from './asset.entry';

@Entity('asset_variants')
export class AssetVariantEntry {
  @PrimaryColumn({
    type: 'uuid',
  })
  assetUuid!: string;

  @ManyToOne(() => AssetEntry, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'assetUuid',
  })
  asset!: AssetEntry;

  @PrimaryColumn({
    type: 'varchar',
    length: 20,
  })
  name!: AssetImageVariantName;

  @PrimaryColumn({
    type: 'varchar',
    length: 20,
  })
  format!: AssetImageVariantFormat;

  @Column({
    length: 100,
  })
  mimeType!: string;

  @Column({
    type: 'integer',
  })
  width!: number;

  @Column({
    type: 'integer',
  })
  height!: number;

  @Column({
    type: 'integer',
  })
  sizeBytes!: number;

  @Column({
    unique: true,
    length: 100,
  })
  storageKey!: string;
}
