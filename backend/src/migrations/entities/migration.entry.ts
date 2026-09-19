import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('migrations')
export class MigrationEntry {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({
    unique: true,
  })
  name!: string;

  @CreateDateColumn()
  appliedAt!: Date;
}
