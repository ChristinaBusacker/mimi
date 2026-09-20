import type { AssetType } from '@shared/assets/asset';

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

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
    unique: true,
    length: 100,
  })
  storageKey!: string;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;
}
