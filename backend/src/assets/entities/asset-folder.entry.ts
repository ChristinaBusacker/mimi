import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('asset_folders')
export class AssetFolderEntry {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({ type: 'uuid', nullable: true })
  parentId!: string | null;

  @Column({ type: 'varchar', length: 120 })
  name!: string;
}
