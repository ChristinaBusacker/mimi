import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('localizations')
export class LocalizationEntry {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({
    unique: true,
    length: 255,
  })
  key!: string;

  @Column({
    type: 'text',
  })
  de!: string;

  @Column({
    type: 'text',
  })
  en!: string;
}
