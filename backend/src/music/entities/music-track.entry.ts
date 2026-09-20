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
import { MusicAlbumEntry } from './music-album.entry';

@Entity('music_tracks')
export class MusicTrackEntry {
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
  albumUuid!: string | null;

  @ManyToOne(() => MusicAlbumEntry, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'albumUuid',
  })
  album!: MusicAlbumEntry | null;

  @Column({
    type: 'integer',
    nullable: true,
  })
  trackNumber!: number | null;

  @Column({
    type: 'integer',
    default: 0,
  })
  durationSeconds!: number;

  @Column({
    type: 'integer',
    default: 0,
  })
  previewDurationSeconds!: number;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  previewAssetId!: string | null;

  @ManyToOne(() => AssetEntry, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'previewAssetId',
  })
  previewAsset!: AssetEntry | null;

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
    type: 'text',
    nullable: true,
  })
  spotifyUrl!: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  deezerUrl!: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  supportUrl!: string | null;

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
