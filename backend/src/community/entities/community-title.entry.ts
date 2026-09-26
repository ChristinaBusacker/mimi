import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('community_titles')
export class CommunityTitleEntry {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({
    type: 'varchar',
    length: 80,
    unique: true,
  })
  key!: string;

  @Column({
    type: 'boolean',
    default: true,
  })
  enabled!: boolean;

  @Column({
    type: 'varchar',
    length: 160,
  })
  nameDe!: string;

  @Column({
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  nameEn!: string | null;

  @Column({
    type: 'text',
    default: '',
  })
  descriptionDe!: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  descriptionEn!: string | null;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  updatedByUserId!: string | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt!: Date;
}
