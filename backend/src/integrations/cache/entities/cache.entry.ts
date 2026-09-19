import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('cache')
export class CacheEntry {
  @PrimaryColumn({
    length: 100,
  })
  key!: string;

  @Column({
    type: 'jsonb',
  })
  value!: unknown;

  @Column({
    type: 'timestamptz',
  })
  refreshedAt!: Date;
}
