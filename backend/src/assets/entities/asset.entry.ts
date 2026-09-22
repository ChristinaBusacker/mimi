import type { AssetType } from '@shared/assets/asset';

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Index('IDX_assets_contentHash_unique', ['contentHash'], {
  unique: true,
  where: '"contentHash" IS NOT NULL',
})
@Entity('assets')
export class AssetEntry {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({
    type: 'varchar',
    length: 20,
  })
  type!: AssetType;

  @Column({
    length: 255,
  })
  originalFilename!: string;

  @Column({
    length: 100,
  })
  mimeType!: string;

  @Column({
    type: 'integer',
  })
  sizeBytes!: number;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  contentHash!: string | null;

  @Column({
    type: 'integer',
    nullable: true,
  })
  width!: number | null;

  @Column({
    type: 'integer',
    nullable: true,
  })
  height!: number | null;

  @Column({
    unique: true,
    length: 100,
  })
  storageKey!: string;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;
}
