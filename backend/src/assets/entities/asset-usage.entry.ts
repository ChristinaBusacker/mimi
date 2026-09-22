import {
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { AssetEntry } from './asset.entry';

export type AssetUsageOwnerType =
  | 'blogAuthor'
  | 'blogPost'
  | 'musicAlbum'
  | 'musicTrack';

@Index(
  'IDX_asset_usages_owner',
  ['ownerType', 'ownerUuid'],
)
@Entity('asset_usages')
export class AssetUsageEntry {
  @PrimaryColumn({
    type: 'uuid',
  })
  assetUuid!: string;

  @ManyToOne(() => AssetEntry, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'assetUuid',
  })
  asset!: AssetEntry;

  @PrimaryColumn({
    type: 'varchar',
    length: 50,
  })
  ownerType!: AssetUsageOwnerType;

  @PrimaryColumn({
    type: 'uuid',
  })
  ownerUuid!: string;

  @PrimaryColumn({
    type: 'varchar',
    length: 50,
  })
  scope!: string;
}
