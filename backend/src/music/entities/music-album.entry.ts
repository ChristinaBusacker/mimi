import type { MusicPublicationStatus } from '@shared/music/music';

import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { AssetEntry } from '../../assets/entities/asset.entry';

@Entity('music_albums')
export class MusicAlbumEntry {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({
    unique: true,
    length: 160,
  })
  slug!: string;

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
    type: 'date',
    nullable: true,
  })
  releasedAt!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'draft',
  })
  status!: MusicPublicationStatus;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt!: Date;
}
